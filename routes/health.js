import { json } from '../lib/middleware.js';

export function configured() {
  return {
    openRouter: Boolean(process.env.OPENROUTER_API_KEY),
    imageModel: Boolean(process.env.OPENROUTER_IMAGE_MODEL),
    helperModel: Boolean(process.env.OPENROUTER_HELPER_MODEL),
    tts: Boolean(process.env.TTS_PROVIDER && process.env.TTS_API_KEY),
    youtube: Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET),
    database: Boolean(process.env.DATABASE_URL),
    redis: Boolean(process.env.REDIS_URL),
    music: {
      aiEnabled: Boolean(process.env.AI_MUSIC_PROVIDER && process.env.AI_MUSIC_PROVIDER !== 'disabled'),
      provider: process.env.AI_MUSIC_PROVIDER || 'none',
      sunoConfigured: Boolean(process.env.SUNO_API_KEY),
      mubertConfigured: Boolean(process.env.MUBERT_API_KEY),
      libraryPath: process.env.MUSIC_LIBRARY_PATH || './storage/music-library'
    },
    ffmpeg: true
  };
}

export async function healthHandler(request, response) {
  return json(response, 200, { 
    service: 'Shorts Factory', 
    configured: configured(),
    timestamp: new Date().toISOString()
  });
}