import { json } from '../lib/middleware.js';
import { MusicService } from '../lib/music.js';

export class MusicRouteService {
  constructor() {
    this.musicService = new MusicService();
  }

  async initialize() {
    await this.musicService.initialize();
  }

  async getLibraryStatus() {
    await this.musicService.initialize();
    const stats = this.musicService.getLibraryStats();
    
    return {
      initialized: this.musicService.initialized,
      libraryPath: this.musicService.libraryPath,
      stats,
      aiMusicEnabled: Boolean(process.env.AI_MUSIC_PROVIDER && process.env.AI_MUSIC_PROVIDER !== 'disabled'),
      provider: process.env.AI_MUSIC_PROVIDER || 'none'
    };
  }

  async generateMusic({ mood, durationSeconds, shortId, sceneContext = '', intensity = 70 }) {
    await this.musicService.initialize();
    
    return await this.musicService.generateAIMusic({
      mood,
      durationSeconds,
      shortId,
      sceneContext,
      intensity
    });
  }

  async getLibraryMusic({ mood, durationSeconds }) {
    await this.musicService.initialize();
    
    return this.musicService.selectLibraryTrack({ mood, durationSeconds });
  }

  async getMusicForShort({ mood, durationSeconds, shortId, mode = 'library', sceneContext = '' }) {
    await this.musicService.initialize();
    
    return await this.musicService.getMusicForShort({
      mood,
      durationSeconds,
      shortId,
      mode,
      sceneContext
    });
  }

  async refreshLibrary() {
    this.musicService.initialized = false;
    await this.musicService.initialize();
    return this.getLibraryStatus();
  }
}

// Route handlers
export async function getMusicLibraryStatusHandler(request, response, { musicService }) {
  try {
    const status = await musicService.getLibraryStatus();
    return json(response, 200, status);
  } catch (error) {
    return json(response, 500, { error: error.message });
  }
}

export async function generateMusicHandler(request, response, { musicService }) {
  try {
    const { searchParams } = new URL(request.url, `http://${request.headers.host}`);
    const mood = searchParams.get('mood') || 'Dark / Cinematic';
    const durationSeconds = parseInt(searchParams.get('duration')) || 60;
    const shortId = searchParams.get('shortId') || 'preview';
    const sceneContext = searchParams.get('context') || '';
    const intensity = parseInt(searchParams.get('intensity')) || 70;

    const result = await musicService.generateMusic({
      mood,
      durationSeconds,
      shortId,
      sceneContext,
      intensity
    });

    return json(response, 201, result);
  } catch (error) {
    return json(response, error.message.includes('not configured') ? 503 : 500, { 
      error: error.message 
    });
  }
}

export async function getLibraryMusicHandler(request, response, { musicService }) {
  try {
    const { searchParams } = new URL(request.url, `http://${request.headers.host}`);
    const mood = searchParams.get('mood') || 'Dark / Cinematic';
    const durationSeconds = parseInt(searchParams.get('duration')) || 60;

    const result = await musicService.getLibraryMusic({ mood, durationSeconds });
    return json(response, 200, result);
  } catch (error) {
    return json(response, 404, { error: error.message });
  }
}

export async function getMusicForShortHandler(request, response, { musicService, params }) {
  try {
    const { shortId } = params;
    const { searchParams } = new URL(request.url, `http://${request.headers.host}`);
    const mood = searchParams.get('mood') || 'Dark / Cinematic';
    const durationSeconds = parseInt(searchParams.get('duration')) || 60;
    const mode = searchParams.get('mode') || 'library';
    const sceneContext = searchParams.get('context') || '';

    const result = await musicService.getMusicForShort({
      mood,
      durationSeconds,
      shortId,
      mode,
      sceneContext
    });

    return json(response, 200, result);
  } catch (error) {
    return json(response, 500, { error: error.message });
  }
}

export async function refreshMusicLibraryHandler(request, response, { musicService }) {
  try {
    const status = await musicService.refreshLibrary();
    return json(response, 200, {
      message: 'Music library refreshed successfully',
      status
    });
  } catch (error) {
    return json(response, 500, { error: error.message });
  }
}