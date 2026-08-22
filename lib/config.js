export function validateEnvironment() {
  const errors = [];
  const warnings = [];

  // Critical environment variables
  if (!process.env.OPENROUTER_API_KEY && !process.env.MISTRAL_API_KEY && !process.env.HF_API_KEY && !process.env.HF_TOKEN) {
    errors.push('At least one AI provider is required: OPENROUTER_API_KEY, MISTRAL_API_KEY, or HF_API_KEY/HF_TOKEN');
  }
  
  if (!process.env.OPENROUTER_MODEL) {
    warnings.push('OPENROUTER_MODEL not set, using default model');
  }

  if (!process.env.OPENROUTER_IMAGE_MODEL && !process.env.HF_API_KEY) {
    warnings.push('Either OPENROUTER_IMAGE_MODEL or HF_API_KEY needed for image generation');
  }

  // Hugging Face configuration
  if (process.env.HF_API_KEY) {
    if (!process.env.HF_TEXT_MODEL) {
      warnings.push('HF_TEXT_MODEL not set, using default model');
    }
    if (!process.env.HF_IMAGE_MODEL) {
      warnings.push('HF_IMAGE_MODEL not set, using default model');
    }
  }

  // Optional but recommended
  if (!process.env.DATABASE_URL) {
    warnings.push('DATABASE_URL not set, using in-memory storage (not production-safe)');
  }

  if (!process.env.REDIS_URL) {
    warnings.push('REDIS_URL not set, background processing disabled');
  }

  // YouTube integration
  if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET) {
    warnings.push('YouTube OAuth not configured, publishing disabled');
  }

  // TTS integration
  if (!process.env.TTS_PROVIDER || !process.env.TTS_API_KEY) {
    warnings.push('TTS not configured, audio generation disabled');
  }

  return { errors, warnings };
}

export function getConfig() {
  return {
    port: Number(process.env.PORT || 3000),
    nodeEnv: process.env.NODE_ENV || 'development',
    
    // AI Configuration
    openRouter: {
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL || 'qwen/qwen-2.5-72b-instruct',
      helperModel: process.env.OPENROUTER_HELPER_MODEL || 'bytedance/seed-2.0-mini',
      imageModel: process.env.OPENROUTER_IMAGE_MODEL
    },
    
    // Mistral Configuration
    mistral: {
      apiKey: process.env.MISTRAL_API_KEY,
      textModel: process.env.MISTRAL_TEXT_MODEL || 'ministral-3b-instruct',
      reasoningModel: process.env.MISTRAL_REASONING_MODEL || 'mistral-small-4'
    },

    // Hugging Face Configuration
    huggingFace: {
      apiKey: process.env.HF_TOKEN || process.env.HF_API_KEY,
      textModel: process.env.HF_TEXT_MODEL || 'Qwen/Qwen2.5-Coder-7B-Instruct',
      imageModel: process.env.HF_IMAGE_MODEL || 'black-forest-labs/FLUX.1-schnell'
    },
    
    // Database
    database: {
      url: process.env.DATABASE_URL
    },
    
    // Queue
    redis: {
      url: process.env.REDIS_URL
    },
    
    // Storage
    storage: {
      path: process.env.STORAGE_PATH || './storage'
    },
    
    // YouTube
    youtube: {
      clientId: process.env.YOUTUBE_CLIENT_ID,
      clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
      redirectUri: process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/api/youtube/callback'
    },
    
    // TTS
    tts: {
      provider: process.env.TTS_PROVIDER,
      apiKey: process.env.TTS_API_KEY,
      elevenlabs: {
        voiceId: process.env.ELEVENLABS_VOICE_ID,
        modelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2'
      },
      fish: {
        apiKey: process.env.FISH_AUDIO_API_KEY,
        voiceId: process.env.FISH_VOICE_ID || 'default'
      }
    },
    
    // Workers
    worker: {
      concurrency: Number(process.env.WORKER_CONCURRENCY || 1)
    },
    
    // Security
    auth: {
      apiToken: process.env.APP_API_TOKEN
    }
  };
}