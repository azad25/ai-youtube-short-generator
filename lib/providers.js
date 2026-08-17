import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { buildRenderArgs, renderVideoWithEffects } from './ffmpeg.js';
import { storage } from './storage.js';

function required(name) { 
  if (!process.env[name]) throw new Error(`${name} is required.`); 
  return process.env[name]; 
}

export async function generateSceneImage({ prompt, shortId, sceneNumber, width = 1440, height = 2560 }) {
  const model = process.env.OPENROUTER_IMAGE_MODEL;
  if (!model) throw new Error('OPENROUTER_IMAGE_MODEL is not configured.');
  
  const response = await fetch('https://openrouter.ai/api/v1/images/generations', { 
    method: 'POST', 
    headers: { 
      Authorization: `Bearer ${required('OPENROUTER_API_KEY')}`, 
      'Content-Type': 'application/json' 
    }, 
    body: JSON.stringify({ 
      model, 
      prompt, 
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
    prompt, 
    cost, 
    provider: 'openrouter',
    width,
    height,
    sceneNumber,
    createdAt: new Date().toISOString()
  };
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
  const voiceId = process.env.FISH_VOICE_ID || 'default';
  
  console.log('🐟 Using Fish Audio for TTS generation...');
  
  const response = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text,
      voice: voiceId,
      format: 'mp3',
      speed: 1.0,
      emotion: 'neutral'
    })
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
    voice: voiceId,
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
      musicPath: musicKey ? storage.path(musicKey) : null,
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
    return await renderBasicVideo({ imageKeys, audioKey, shortId });
  }
}

// Fallback basic rendering
async function renderBasicVideo({ imageKeys, audioKey, shortId }) {
  const outputKey = `generated/${shortId}/final-basic-${Date.now()}.mp4`;
  const args = buildRenderArgs({ 
    imagePaths: imageKeys.map((key) => storage.path(key)), 
    audioPath: audioKey ? storage.path(audioKey) : null, 
    outputPath: storage.path(outputKey) 
  });
  
  await new Promise((resolve, reject) => { 
    const process = spawn('ffmpeg', args, { stdio: 'pipe' }); 
    let stderr = '';
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
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
