import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { buildRenderArgs, renderVideoWithEffects } from './ffmpeg.js';
import { storage } from './storage.js';
import { huggingFaceProvider } from './huggingface.js';
import { mistralProvider } from './mistral.js';

function required(name) { 
  if (!process.env[name]) throw new Error(`${name} is required.`); 
  return process.env[name]; 
}

/**
 * Generate scene images using the three-tier fallback system
 * Flow: OpenRouter → Mistral (with agents!) → HuggingFace
 */
export async function generateSceneImage({ prompt, shortId, sceneNumber, width = 1440, height = 2560, style = 'cinematic' }) {
  const openRouterModel = process.env.OPENROUTER_IMAGE_MODEL;
  const hasOpenRouter = process.env.OPENROUTER_API_KEY && openRouterModel;
  
  console.log('🎨 Starting image generation for scene', sceneNumber);
  console.log('   OpenRouter available:', hasOpenRouter, 'Model:', openRouterModel);
  console.log('   Mistral available:', mistralProvider.isAvailable());
  console.log('   HuggingFace available:', huggingFaceProvider.isAvailable());
  
  // Try OpenRouter first (primary image provider)
  if (hasOpenRouter) {
    try {
      console.log('🚀 Trying OpenRouter image generation...');
      return await generateSceneImageOpenRouter({ prompt, shortId, sceneNumber, width, height, style });
    } catch (error) {
      console.error('❌ OpenRouter image failed:', error.message);
      console.warn('⚠️ OpenRouter image failed, falling back to Mistral:', error.message);
    }
  } else {
    console.log('⏭️ Skipping OpenRouter (not configured)');
  }

  // Try Mistral second (NOW WITH IMAGE GENERATION via agents!)
  if (mistralProvider.isAvailable()) {
    try {
      console.log('🎯 Trying Mistral agent image generation...');
      return await mistralProvider.generateImage({ prompt, shortId, sceneNumber, width, height, style });
    } catch (error) {
      console.error('❌ Mistral image failed:', error.message);
      console.warn('⚠️ Mistral image failed, falling back to HuggingFace:', error.message);
    }
  } else {
    console.log('⏭️ Skipping Mistral (not configured)');
  }
  
  // Final fallback to HuggingFace
  if (huggingFaceProvider.isAvailable()) {
    console.log('🤖 Trying HuggingFace fallback image generation...');
    try {
      return await huggingFaceProvider.generateImage({ prompt, shortId, sceneNumber, width, height, style });
    } catch (error) {
      console.error('❌ HuggingFace image failed:', error.message);
    }
  } else {
    console.log('⏭️ Skipping HuggingFace (not configured)');
  }

  // Ultimate fallback: Generate a placeholder image with scene information
  console.log('🎭 All providers failed - generating placeholder image for development');
  return await generatePlaceholderImage({ prompt, shortId, sceneNumber, width, height, style });
}

/**
 * Generate text/scripts using the three-tier fallback system
 * Flow: OpenRouter → Mistral → HuggingFace
 */
export async function generateText({ prompt, maxTokens = 1000, temperature = 0.8, useReasoning = false }) {
  // Try OpenRouter first
  if (process.env.OPENROUTER_API_KEY) {
    try {
      console.log('🚀 Generating text with OpenRouter...');
      // OpenRouter text generation logic would go here
      // For now, fall through to Mistral
    } catch (error) {
      console.warn('⚠️ OpenRouter text failed, trying Mistral:', error.message);
    }
  }

  // Try Mistral (excellent for text, JSON generation, reasoning)
  if (mistralProvider.isAvailable()) {
    try {
      console.log('🎯 Generating text with Mistral...');
      return await mistralProvider.generateText({ prompt, maxTokens, temperature, useReasoning });
    } catch (error) {
      console.warn('⚠️ Mistral text failed, trying Hugging Face:', error.message);
    }
  }

  // Final fallback to Hugging Face
  if (huggingFaceProvider.isAvailable()) {
    console.log('🤖 Generating text with Hugging Face fallback...');
    return await huggingFaceProvider.generateText({ prompt, maxTokens, temperature });
  }

  throw new Error('No text generation providers available. Configure OPENROUTER_API_KEY, MISTRAL_API_KEY, or HF_API_KEY.');
}

async function generateSceneImageOpenRouter({ prompt, shortId, sceneNumber, width = 1440, height = 2560, style = 'cinematic' }) {
  const model = process.env.OPENROUTER_IMAGE_MODEL;
  if (!model) throw new Error('OPENROUTER_IMAGE_MODEL is not configured.');
  
  // Enhanced comic-style prompt for Marvel comic book artwork
  let enhancedPrompt = prompt;
  
  if (style === 'comic' || style === 'marvel-comic') {
    enhancedPrompt = buildMarvelComicPrompt(prompt);
    console.log('🦸 Generating Marvel comic-style image');
  }
  
  const response = await fetch('https://openrouter.ai/api/v1/images/generations', { 
    method: 'POST', 
    headers: { 
      Authorization: `Bearer ${required('OPENROUTER_API_KEY')}`, 
      'Content-Type': 'application/json' 
    }, 
    body: JSON.stringify({ 
      model, 
      prompt: enhancedPrompt, 
      size: `${width}x${height}`, 
      n: 1, 
      response_format: 'b64_json' 
    }) 
  });
  
  const payload = await response.json();
  if (!response.ok || !payload.data?.[0]?.b64_json) {
    throw new Error(payload.error?.message || 'Image provider returned no image.');
  }
  
  const cost = Number(payload.usage?.cost || 0);
  const key = `generated/${shortId}/scene-${sceneNumber}-${Date.now()}.png`;
  await storage.put(key, Buffer.from(payload.data[0].b64_json, 'base64'));
  
  return { 
    key, 
    model, 
    prompt: enhancedPrompt, 
    originalPrompt: prompt,
    cost, 
    provider: 'openrouter',
    width,
    height,
    sceneNumber,
    style,
    createdAt: new Date().toISOString()
  };
}

function buildMarvelComicPrompt(basePrompt) {
  // Transform any prompt into authentic Marvel comic book style with storytelling depth
  const marvelComicStyle = `
Professional Marvel Comics illustration, authentic comic book art style, 
Jack Kirby and John Romita Sr. artwork style, Stan Lee era Marvel Comics,
dynamic wide shot composition with storytelling depth, detailed comic book panel,
bold black ink lines, vibrant Marvel comic book colors, classic comic book shading,
dramatic comic book perspective, cinematic comic book framing,
detailed background environments, multiple story elements in single panel,
comic book speech bubbles and dialogue integrated, thought bubbles ready,
classic Marvel superhero proportions and anatomy, iconic costume details,
comic book action lines and motion effects, halftone dot patterns,
professional comic book coloring and cell-shading techniques,
wide establishing shot showing full scene context and environment,
Marvel Comics house style from 1960s-1980s golden age,
NO photorealism, NO realistic photography, YES authentic comic book illustration,
storytelling composition that conveys narrative through visual elements,
`.trim().replace(/\s+/g, ' ');

  // Clean and enhance the base prompt for comic style
  const cleanedPrompt = basePrompt
    .replace(/photorealistic|realistic|photography|photo|movie quality|cinematic lighting/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Combine for authentic Marvel comic look with storytelling depth
  return `${marvelComicStyle}, ${cleanedPrompt}, wide shot panel showing complete scene with environmental context and story details`;
}

export async function generateScriptWithFallback({ topic, contentType, duration, sources, facts, language = 'English' }) {
  // Try OpenRouter first, then fallback to Hugging Face
  const hasOpenRouter = process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_MODEL;
  
  if (hasOpenRouter) {
    try {
      console.log('📝 Attempting script generation with OpenRouter...');
      // This would call the existing OpenRouter script generation
      // For now, we'll skip to test the Hugging Face fallback
      throw new Error('Testing Hugging Face fallback');
    } catch (error) {
      console.warn('⚠️ OpenRouter script failed, falling back to Hugging Face:', error.message);
    }
  }

  // Fallback to Hugging Face
  if (huggingFaceProvider.isAvailable()) {
    console.log('🤖 Generating script with Hugging Face fallback...');
    
    const evidence = facts?.map(fact => `${fact.statement} [${fact.sourceIds?.join(', ') || 'Unknown'}]`).join('\n') || '';
    
    return await huggingFaceProvider.generateComicScript({
      topic,
      contentType,
      duration,
      evidence,
      language
    });
  }

  throw new Error('No script generation providers available. Configure OPENROUTER_API_KEY or HF_API_KEY.');
}

export async function generateNarration({ text, shortId }) {
  const provider = process.env.TTS_PROVIDER;
  
  if (provider === 'fish') {
    return await generateFishAudioNarration({ text, shortId });
  } else if (provider === 'elevenlabs') {
    return await generateElevenLabsNarration({ text, shortId });
  } else {
    throw new Error(`Unsupported TTS provider: ${provider}. Use 'fish' or 'elevenlabs'`);
  }
}

async function generateFishAudioNarration({ text, shortId }) {
  const apiKey = required('FISH_AUDIO_API_KEY');
  const referenceId = process.env.FISH_VOICE_ID || null; // Use null for default voice
  
  console.log('🐟 Using Fish Audio for TTS generation...');
  
  const requestBody = {
    text: text,
    temperature: 0.7,
    top_p: 0.7,
    prosody: {
      speed: 1.0,
      volume: 0,
      normalize_loudness: true
    },
    chunk_length: 300,
    normalize: true,
    format: 'mp3',
    sample_rate: 44100,
    mp3_bitrate: 128,
    latency: 'normal',
    max_new_tokens: 1024,
    repetition_penalty: 1.2,
    min_chunk_length: 50,
    condition_on_previous_chunks: true,
    early_stop_threshold: 1
  };

  // Only add reference_id if we have a custom voice
  if (referenceId) {
    requestBody.reference_id = referenceId;
  }
  
  const response = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'model': 's2.1-pro-free' // Use the free tier
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Fish Audio API error:', errorText);
    throw new Error(`Fish Audio TTS failed: ${response.status} ${errorText}`);
  }
  
  const key = `generated/${shortId}/narration-fish-${Date.now()}.mp3`;
  await storage.put(key, Buffer.from(await response.arrayBuffer()));
  
  console.log('✅ Fish Audio narration generated successfully');
  
  return {
    key,
    provider: 'fish',
    voice: referenceId || 'default',
    text,
    duration: estimateAudioDuration(text),
    createdAt: new Date().toISOString()
  };
}

async function generateElevenLabsNarration({ text, shortId }) {
  const voiceId = required('ELEVENLABS_VOICE_ID');
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, { 
    method: 'POST', 
    headers: { 
      'xi-api-key': required('TTS_API_KEY'), 
      'Content-Type': 'application/json', 
      Accept: 'audio/mpeg' 
    }, 
    body: JSON.stringify({ 
      text, 
      model_id: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2' 
    }) 
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs TTS failed: ${errorText}`);
  }
  
  const key = `generated/${shortId}/narration-${Date.now()}.mp3`;
  await storage.put(key, Buffer.from(await response.arrayBuffer()));
  
  return { 
    key, 
    provider: 'elevenlabs', 
    model: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2', 
    voice: voiceId,
    text,
    duration: estimateAudioDuration(text),
    createdAt: new Date().toISOString()
  };
}

function estimateAudioDuration(text) {
  // Rough estimate: 150 words per minute
  const words = text.split(/\s+/).length;
  return Math.ceil((words / 150) * 60);
}

export async function renderVerticalShort({ 
  imageKeys, 
  audioKey, 
  musicKey,
  shortId, 
  scenes = [],
  scriptData = {},
  style = 'cinematic',
  onProgress = null
}) {
  const outputKey = `generated/${shortId}/final-${Date.now()}.mp4`;
  
  // Check if this is comic style rendering
  if (style === 'comic' || style === 'marvel-comic') {
    console.log('📚 Starting comic book render:', {
      panels: imageKeys.length,
      hasAudio: Boolean(audioKey),
      hasMusic: Boolean(musicKey),
      style: style,
      title: scriptData.title
    });
    
    try {
      // Use comic-specific rendering
      const result = await renderComicVideoWithEffects({
        imagePaths: imageKeys.map((key) => storage.path(key)),
        audioPath: audioKey ? storage.path(audioKey) : null,
        musicPath: musicKey,
        scenes,
        scriptData,
        outputPath: storage.path(outputKey),
        onProgress
      });
      
      return {
        key: outputKey,
        format: 'mp4',
        width: 1440,
        height: 2560,
        style: 'comic',
        effects: [
          'comic_panel_layout',
          'comic_borders',
          'comic_text_overlays',
          'speech_bubbles',
          'comic_sound_effects',
          'comic_transitions'
        ],
        panels: scenes.length,
        hasEffects: true,
        renderTime: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Comic render failed:', error);
      throw error;
    }
  }
  
  // Original cinematic rendering
  console.log('🎬 Starting cinematic render:', {
    scenes: imageKeys.length,
    hasAudio: Boolean(audioKey),
    hasMusic: Boolean(musicKey),
    style: style,
    title: scriptData.title
  });
  
  try {
    // Use enhanced rendering with cinematic effects
    const result = await renderVideoWithEffects({
      imagePaths: imageKeys.map((key) => storage.path(key)),
      audioPath: audioKey ? storage.path(audioKey) : null,
      musicPath: musicKey, // Don't apply storage.path() if musicKey is already a full path
      scenes,
      scriptData,
      outputPath: storage.path(outputKey),
      style,
      onProgress
    });
    
    return {
      key: outputKey,
      format: 'mp4',
      width: 1080,
      height: 1920,
      style,
      effects: [
        'ken_burns_zoom',
        'cinematic_color_grading', 
        'animated_text_overlays',
        'cross_fade_transitions',
        'audio_mixing',
        'vignette_effect'
      ],
      scenes: scenes.length,
      hasEffects: true,
      renderTime: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Enhanced render failed, falling back to basic render:', error);
    
    // Fallback to basic rendering if enhanced fails
    return await renderBasicVideo({ imageKeys, audioKey, shortId, scenes, scriptData });
  }
}

// Comic book video rendering with panel layout
async function renderComicVideoWithEffects({
  imagePaths,
  audioPath,
  musicPath,
  scenes = [],
  scriptData = {},
  outputPath,
  onProgress = null
}) {
  const args = buildComicRenderArgs({
    imagePaths,
    audioPath,
    musicPath,
    outputPath,
    scenes,
    scriptData
  });
  
  console.log('📚 Comic book rendering started with enhanced effects');
  
  try {
    const { spawn } = await import('node:child_process');
    
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', args);
      let errorOutput = '';
      
      ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();
        errorOutput += output;
        
        if (output.includes('frame=')) {
          console.log('📚 Comic rendering:', output.substring(0, 80));
        }
        
        // Progress tracking
        if (onProgress && output.includes('time=')) {
          const timeMatch = output.match(/time=(\d+):(\d+):(\d+\.\d+)/);
          if (timeMatch) {
            const seconds = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseFloat(timeMatch[3]);
            onProgress(seconds);
          }
        }
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('✅ COMIC BOOK RENDER SUCCESS');
          resolve({ 
            success: true, 
            outputPath,
            style: 'comic',
            panels: imagePaths.length
          });
        } else {
          console.error('❌ Comic render failed:', errorOutput.slice(-500));
          reject(new Error(`Comic FFmpeg failed: ${errorOutput.slice(-300)}`));
        }
      });
      
      ffmpeg.on('error', (error) => {
        reject(new Error(`Comic FFmpeg spawn failed: ${error.message}`));
      });
    });
  } catch (error) {
    throw new Error(`Comic video rendering failed: ${error.message}`);
  }
}

// Import the comic rendering functions
function buildComicRenderArgs({
  imagePaths,
  audioPath = null,
  musicPath = null,
  outputPath,
  scenes = [],
  scriptData = {},
  width = 1440,
  height = 2560,
  fps = 30,
}) {
  const SCENE_COUNT = imagePaths.length;
  const PANEL_DURATION = 8; // 8 seconds per panel for reading time
  const TOTAL_DURATION = SCENE_COUNT * PANEL_DURATION;

  console.log(`📚 COMIC RENDER: ${SCENE_COUNT} panels, ${PANEL_DURATION}s each = ${TOTAL_DURATION}s total`);

  if (!Array.isArray(imagePaths) || imagePaths.length === 0) {
    throw new Error('At least 1 comic panel required');
  }

  const args = ["-y"];

  // Add each comic panel as input
  for (let i = 0; i < SCENE_COUNT; i++) {
    args.push("-loop", "1", "-t", PANEL_DURATION.toString(), "-i", imagePaths[i]);
  }

  // Add audio input
  if (musicPath && typeof musicPath === 'string' && musicPath.trim()) {
    console.log(`🎵 Adding comic soundtrack: ${musicPath}`);
    args.push('-i', musicPath);
  } else {
    console.log(`🔇 No music, using silent audio for comic`);
    args.push('-f', 'lavfi', '-i', `anullsrc=channel_layout=stereo:sample_rate=44100:duration=${TOTAL_DURATION}`);
  }

// Create 3-panel comic book layout for composite images
  let filterComplex = '';
  
  // For comic style with exactly 3 composite images
  if (SCENE_COUNT === 3) {
    // Scale each composite image to fit in 1/3 of the height
    const panelHeight = Math.floor(height / 3);
    
    for (let i = 0; i < 3; i++) {
      if (i > 0) filterComplex += ';';
      
      // Scale and add comic book border for composite image
      filterComplex += `[${i}:v]scale=${width}:${panelHeight}:force_original_aspect_ratio=increase,crop=${width}:${panelHeight}`;
      
      // Add comic book panel border
      filterComplex += `,pad=${width}:${panelHeight + 20}:0:10:color=white`;
      filterComplex += `,drawbox=x=8:y=8:w=${width-16}:h=${panelHeight + 4}:color=black:thickness=6`;
      
      // Add composite image text overlays based on scene data
      // Find scenes that belong to this composite image (3 scenes per image)
      const compositeScenes = scenes.filter(scene => 
        scene.composite_image === (i + 1) || 
        (scene.scene_number >= (i * 3) + 1 && scene.scene_number <= (i + 1) * 3)
      );
      
      if (compositeScenes.length > 0) {
        // Add chapter title for the composite image
        const firstScene = compositeScenes[0];
        if (firstScene && (firstScene.panel_title || firstScene.caption)) {
          const titleText = (firstScene.panel_title || firstScene.caption)
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 50); // Limit length for composite
          
          // Chapter title box
          filterComplex += `,drawbox=x=20:y=25:w=${width-40}:h=40:color=yellow@0.9:thickness=fill`;
          filterComplex += `,drawbox=x=20:y=25:w=${width-40}:h=40:color=black:thickness=3`;
          filterComplex += `,drawtext=text='${titleText}':fontsize=24:fontcolor=black:x=(w-text_w)/2:y=30:font=Arial-Bold`;
        }
        
        // Add main dialogue from key scenes in the composite
        const mainDialogue = compositeScenes
          .map(scene => scene.dialogue)
          .filter(d => d)
          .join(' • ') // Separate multiple dialogues
          .replace(/[^\w\s•]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 80); // Limit for composite
        
        if (mainDialogue) {
          // Main dialogue bubble
          const bubbleY = panelHeight - 50;
          filterComplex += `,drawbox=x=30:y=${bubbleY}:w=${width-60}:h=35:color=white@0.95:thickness=fill`;
          filterComplex += `,drawbox=x=30:y=${bubbleY}:w=${width-60}:h=35:color=black:thickness=3`;
          filterComplex += `,drawtext=text='${mainDialogue}':fontsize=20:fontcolor=black:x=(w-text_w)/2:y=${bubbleY + 8}:font=Arial-Bold`;
        }
        
        // Add primary sound effects
        const mainSoundEffect = compositeScenes
          .map(scene => scene.sound_effect)
          .filter(se => se)
          .slice(0, 2) // Max 2 sound effects per composite
          .join(' ')
          .toUpperCase()
          .replace(/[^\w\s]/g, '');
        
        if (mainSoundEffect) {
          filterComplex += `,drawtext=text='${mainSoundEffect}!':fontsize=36:fontcolor=red:borderw=3:bordercolor=yellow:x=(w-text_w)/2:y=${panelHeight/2}:font=Arial-Black`;
        }
      }
      
      filterComplex += `[panel${i}]`;
    }
    
    // Stack all 3 composite images vertically
    filterComplex += ';[panel0][panel1][panel2]vstack=inputs=3:shortest=0[video]';
  } else {
    // Handle other counts with simpler layout
    for (let i = 0; i < SCENE_COUNT; i++) {
      if (i > 0) filterComplex += ';';
      filterComplex += `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}[v${i}]`;
    }
    
    filterComplex += ';';
    for (let i = 0; i < SCENE_COUNT; i++) {
      filterComplex += `[v${i}]`;
    }
    filterComplex += `concat=n=${SCENE_COUNT}:v=1:a=0[video]`;
  }

  // Audio mapping
  const audioInputIndex = SCENE_COUNT;
  
  args.push('-filter_complex', filterComplex);
  args.push('-map', '[video]');
  
  if (musicPath && typeof musicPath === 'string' && musicPath.trim()) {
    args.push('-map', `${audioInputIndex}:a`);
    args.push('-af', `atrim=duration=${TOTAL_DURATION},afade=t=out:st=${TOTAL_DURATION-2}:d=2`);
  } else {
    args.push('-map', `${audioInputIndex}:a`);
  }
  
  args.push('-t', TOTAL_DURATION.toString());
  args.push('-c:v', 'libx264');
  args.push('-preset', 'ultrafast');
  args.push('-crf', '28');
  args.push('-c:a', 'aac');
  args.push('-movflags', '+faststart');
  args.push(outputPath);

  console.log('📚 Comic filter complex ready');
  return args;
}

// Fallback basic rendering
async function renderBasicVideo({ imageKeys, audioKey, shortId, scenes = [], scriptData = {} }) {
  console.log('🔧 FALLBACK: Using basic render with proper scenes and scriptData');
  const outputKey = `generated/${shortId}/final-basic-${Date.now()}.mp4`;
  const args = buildRenderArgs({ 
    imagePaths: imageKeys.map((key) => storage.path(key)), 
    audioPath: audioKey ? storage.path(audioKey) : null, 
    outputPath: storage.path(outputKey),
    scenes,
    scriptData
  });
  
  await new Promise((resolve, reject) => { 
    const process = spawn('ffmpeg', args, { stdio: 'pipe' }); 
    let stderr = '';
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log('📹 Basic FFmpeg stderr:', data.toString().substring(0, 200));
    });
    
    process.once('error', reject); 
    process.once('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}. Error: ${stderr}`));
      }
    });
  });
  
  return { 
    key: outputKey, 
    format: 'mp4', 
    width: 1080, 
    height: 1920,
    style: 'basic',
    hasEffects: false,
    fallback: true,
    createdAt: new Date().toISOString()
  };
}

/**
 * Generate a placeholder image for development when all AI providers fail
 * Creates a simple colored rectangle with scene information overlay
 */
async function generatePlaceholderImage({ prompt, shortId, sceneNumber, width = 1440, height = 2560, style = 'cinematic' }) {
  console.log(`🎭 Creating placeholder image for scene ${sceneNumber}: "${prompt}"`);
  
  // Create a simple SVG placeholder
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
  const color = colors[(sceneNumber - 1) % colors.length];
  
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2C3E50;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  
  <!-- Scene Number -->
  <text x="${width/2}" y="200" text-anchor="middle" font-family="Arial, sans-serif" 
        font-size="120" font-weight="bold" fill="white">SCENE ${sceneNumber}</text>
  
  <!-- Marvel Style Title -->
  <text x="${width/2}" y="400" text-anchor="middle" font-family="Arial, sans-serif" 
        font-size="60" font-weight="bold" fill="white">THANOS</text>
  <text x="${width/2}" y="480" text-anchor="middle" font-family="Arial, sans-serif" 
        font-size="40" fill="#FFD700">MARVEL COMICS</text>
  
  <!-- Prompt Text (truncated) -->
  <text x="${width/2}" y="650" text-anchor="middle" font-family="Arial, sans-serif" 
        font-size="32" fill="white">${prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt}</text>
  
  <!-- Development Notice -->
  <text x="${width/2}" y="${height-200}" text-anchor="middle" font-family="Arial, sans-serif" 
        font-size="32" fill="#FFD700">PLACEHOLDER - DEV MODE</text>
  <text x="${width/2}" y="${height-150}" text-anchor="middle" font-family="Arial, sans-serif" 
        font-size="24" fill="white">AI providers temporarily unavailable</text>
</svg>`;

  // Convert SVG to buffer
  const svgBuffer = Buffer.from(svg);
  const svgKey = `generated/${shortId}/scene-${sceneNumber}-placeholder-${Date.now()}.svg`;
  await storage.put(svgKey, svgBuffer);

  return {
    key: svgKey,
    model: 'placeholder-generator',
    provider: 'development-fallback',
    cost: 0,
    width,
    height,
    prompt: prompt,
    originalPrompt: prompt,
    style,
    createdAt: new Date().toISOString(),
    sceneNumber,
    isPlaceholder: true,
    note: 'Placeholder image generated due to AI provider issues. Replace with real images when providers are available.'
  };
}