import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { getShort, saveShort, recordBudgetUsage } from './lib/database.js';
import { generateEvidenceBoundScript, runAdversarialFactReview } from './lib/ai.js';
import { generateSceneImage, generateNarration, renderVerticalShort } from './lib/providers.js';
import { reviewScriptClaims } from './lib/factuality.js';
import { uploadYoutubeShort } from './lib/youtube.js';

if (!process.env.REDIS_URL) throw new Error('REDIS_URL is required to start the worker.');

const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });

const worker = new Worker('shorts-pipeline', async (job) => {
  const { shortId, automation, scheduledPublishAt, autoPublish } = job.data;
  
  try {
    let short = await getShort(shortId);
    if (!short) {
      throw new Error(`Short ${shortId} not found in database`);
    }

    await job.updateProgress({ stage: 'RESEARCHING', message: 'Loading short data...' });
    
    // Skip research if evidence already exists
    if (!short.facts || short.facts.length === 0) {
      short.status = 'FAILED';
      short.error = 'Evidence package required before generation';
      await saveShort(short);
      throw new Error('Evidence package required before generation');
    }

    // Generate script if not exists
    if (!short.script && short.status !== 'GENERATING_SCRIPT') {
      await job.updateProgress({ stage: 'GENERATING_SCRIPT', message: 'Generating evidence-based script...' });
      short.status = 'GENERATING_SCRIPT';
      await saveShort(short);

      // Import prompts to generate script
      const { PROMPT_TEMPLATES, renderPrompt } = await import('./lib/prompts.js');
      
      const global = PROMPT_TEMPLATES.find(p => p.id === 'global-system')?.content || '';
      const template = PROMPT_TEMPLATES.find(p => p.id === 'upcoming-movie')?.content || '';
      const variables = { 
        topic: short.topic, 
        content_type: short.contentType, 
        duration: short.duration, 
        channel_style: short.style, 
        language: short.language 
      };
      
      const evidence = JSON.stringify(short.facts.map(({ id, statement, classification, sourceIds, confidence }) => 
        ({ id, statement, classification, sourceIds, confidence })));
      
      const generated = await generateEvidenceBoundScript({ 
        system: global, 
        prompt: `${renderPrompt(template, variables)}\n\nEvidence package (the only factual source):\n${evidence}\n\nEvery factual statement must occur in claims with evidence IDs.` 
      });

      // Record usage
      await recordBudgetUsage('script_generation', 'openrouter', generated.usage.cost, {
        model: process.env.OPENROUTER_MODEL,
        inputTokens: generated.usage.inputTokens,
        outputTokens: generated.usage.outputTokens,
        shortId
      });

      const review = reviewScriptClaims(generated.object.claims, short.facts, short.minimumSources);
      if (!review.passed) {
        short.status = 'FAILED';
        short.error = `Factuality gate failed: ${review.failures.join(' ')}`;
        await saveShort(short);
        throw new Error(short.error);
      }

      const adversarial = await runAdversarialFactReview({ evidence: short.facts, script: generated.object });
      if (!adversarial.object.passed || adversarial.object.unsupportedClaims.length) {
        short.status = 'FAILED';
        short.error = `Adversarial factuality review failed: ${adversarial.object.unsupportedClaims.join(' ')}`;
        await saveShort(short);
        throw new Error(short.error);
      }

      short.script = generated.object;
      short.script.factuality = { ...review, adversarial: adversarial.object };
      short.script.usage = { writer: generated.usage, reviewer: adversarial.usage };
      short.status = 'GENERATING_SCENES';
      await saveShort(short);
    }

    // Generate images for scenes
    if (short.script && (!short.assets || short.assets.length === 0)) {
      await job.updateProgress({ stage: 'GENERATING_IMAGES', message: 'Generating scene images...' });
      short.status = 'GENERATING_IMAGES';
      await saveShort(short);

      const assets = [];
      for (let i = 0; i < short.script.scenes.length; i++) {
        const scene = short.script.scenes[i];
        await job.updateProgress({ 
          stage: 'GENERATING_IMAGES', 
          message: `Generating image ${i + 1}/${short.script.scenes.length}...`,
          progress: Math.round((i / short.script.scenes.length) * 100)
        });

        try {
          const asset = await generateSceneImage({
            prompt: scene.image_prompt,
            shortId: short.id,
            sceneNumber: scene.scene_number
          });

          await recordBudgetUsage('image_generation', 'openrouter', asset.cost, {
            model: process.env.OPENROUTER_IMAGE_MODEL,
            shortId,
            sceneNumber: scene.scene_number
          });

          assets.push({ ...asset, sceneNumber: scene.scene_number });
        } catch (error) {
          console.error(`Failed to generate image for scene ${scene.scene_number}:`, error);
          // Continue with other images instead of failing completely
        }
      }

      short.assets = assets;
      short.status = 'GENERATING_AUDIO';
      await saveShort(short);
    }

    // Generate narration audio
    if (short.script && !short.audio && process.env.TTS_PROVIDER) {
      await job.updateProgress({ stage: 'GENERATING_AUDIO', message: 'Generating narration...' });
      short.status = 'GENERATING_AUDIO';
      await saveShort(short);

      try {
        short.audio = await generateNarration({
          text: short.script.narration,
          shortId: short.id
        });
        short.status = 'RENDERING';
        await saveShort(short);
      } catch (error) {
        console.warn('TTS generation failed, continuing without audio:', error.message);
        short.status = 'RENDERING';
        await saveShort(short);
      }
    }

    // Render video
    if (short.assets && short.assets.length > 0 && !short.video) {
      await job.updateProgress({ stage: 'RENDERING', message: 'Rendering final video...' });
      short.status = 'RENDERING';
      await saveShort(short);

      const images = short.script.scenes.map(scene => 
        short.assets.find(asset => asset.sceneNumber === scene.scene_number)?.key
      ).filter(Boolean);

      if (images.length > 0) {
        short.video = await renderVerticalShort({
          imageKeys: images,
          audioKey: short.audio?.key,
          musicKey: short.music?.asset?.key || short.music?.track?.filePath,
          shortId: short.id,
          scenes: short.script.scenes || [],
          scriptData: {
            title: short.script.title,
            hook: short.script.hook,
            topic: short.topic,
            contentType: short.contentType
          }
        });
        short.status = 'QA';
        await saveShort(short);
      }
    }

    // Final QA
    if (short.script && short.status === 'QA') {
      await job.updateProgress({ stage: 'QA', message: 'Running final factuality check...' });
      
      const qa = reviewScriptClaims(short.script.claims, short.facts, short.minimumSources);
      short.qa = { 
        ...qa, 
        checkedAt: new Date().toISOString(), 
        status: qa.passed ? 'QA PASSED' : 'QA FAILED' 
      };

      short.status = qa.passed ? 'READY' : 'FAILED';
      if (!qa.passed) {
        short.error = `Final QA failed: ${qa.failures.join(' ')}`;
      }
      await saveShort(short);
    }

    // Auto-publish if scheduled and enabled
    if (autoPublish && scheduledPublishAt && short.video) {
      await job.updateProgress({ stage: 'PUBLISHING', message: 'Auto-publishing to YouTube...' });
      
      try {
        // Import YouTube service and get credentials
        const { YouTubeService } = await import('./routes/youtube.js');
        const { StateManager } = await import('./lib/services.js');
        
        // Initialize services to get YouTube credentials
        const stateManager = new StateManager('./data/runtime.json');
        const youtubeService = new YouTubeService(stateManager);
        
        const publishTime = new Date(scheduledPublishAt);
        const now = new Date();
        
        // Only publish if we're within 5 minutes of scheduled time or immediately for testing
        const timeDiff = Math.abs(publishTime - now);
        if (timeDiff <= 5 * 60 * 1000 || process.env.NODE_ENV === 'development') { // 5 minutes or dev mode
          
          // Get fresh YouTube credentials
          const credentials = await youtubeService.getUploadCredentials();
          
          const { uploadYoutubeShort } = await import('./lib/youtube.js');
          const { storage } = await import('./lib/storage.js');
          
          const upload = await uploadYoutubeShort({
            accessToken: credentials.accessToken,
            refreshToken: credentials.refreshToken,
            videoPath: storage.path(short.video.key),
            title: short.script.title,
            description: short.script.youtube_description || `${short.script.title} #Marvel #MCU`,
            tags: short.script.hashtags || ['Marvel', 'MCU'],
            privacyStatus: 'public', // Public for scheduled posts
            publishAt: scheduledPublishAt
          });
          
          short.youtube = {
            id: upload.id,
            url: `https://youtu.be/${upload.id}`,
            publishedAt: new Date().toISOString(),
            scheduledAt: scheduledPublishAt,
            status: 'published'
          };
          
          short.status = 'PUBLISHED';
          await saveShort(short);
          
          await job.updateProgress({ stage: 'PUBLISHED', message: `Published to YouTube: ${upload.id}` });
          
        } else {
          console.log(`⏰ Skipping publish - not within scheduled window. Scheduled: ${publishTime}, Now: ${now}`);
          short.status = 'READY'; // Ready for manual publish
          await saveShort(short);
        }
        
      } catch (publishError) {
        console.error('Auto-publish failed:', publishError);
        short.status = 'READY'; // Still ready, just failed to publish
        await saveShort(short);
      }
    }

    await job.updateProgress({ stage: 'COMPLETED', message: 'Short generation completed successfully.' });
    return { success: true, shortId, published: !!short.youtube };

  } catch (error) {
    console.error(`Job failed for short ${shortId}:`, error);
    
    // Update short status to failed
    try {
      const short = await getShort(shortId);
      if (short) {
        short.status = 'FAILED';
        short.error = error.message;
        await saveShort(short);
      }
    } catch (saveError) {
      console.error('Failed to update short status:', saveError);
    }
    
    throw error;
  }
}, { 
  connection, 
  concurrency: Number(process.env.WORKER_CONCURRENCY || 1),
  removeOnComplete: 100,
  removeOnFail: 50
});

worker.on('completed', (job) => {
  console.log(JSON.stringify({ 
    level: 'info', 
    service: 'shorts-factory-worker', 
    message: `Job ${job.id} completed successfully`,
    shortId: job.data.shortId
  }));
});

worker.on('failed', (job, error) => {
  console.log(JSON.stringify({ 
    level: 'error', 
    service: 'shorts-factory-worker', 
    message: `Job ${job?.id} failed: ${error.message}`,
    shortId: job?.data?.shortId
  }));
});

console.log(JSON.stringify({ 
  level: 'info', 
  service: 'shorts-factory-worker', 
  message: 'Worker listening for production jobs.' 
}));
