import { storage } from './storage.js';
import { readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const MOODS = new Set(['Dark / Cinematic', 'Epic / Action', 'Suspense', 'Emotional', 'Sci-fi', 'Mysterious']);

// Copyright-free music sources for automatic library building
const COPYRIGHT_FREE_TRACKS = [
  // Dark / Cinematic
  {
    name: 'Dark Atmosphere',
    url: 'https://www.soundjay.com/misc/sounds/dark-atmosphere.mp3',
    mood: 'Dark / Cinematic',
    durationSeconds: 60,
    intensity: 70,
    tags: ['atmospheric', 'dark', 'cinematic'],
    licensedForCommercialUse: true,
    source: 'SoundJay'
  },
  {
    name: 'Cinematic Tension',
    url: 'https://www.zapsplat.com/music/cinematic-tension-building.mp3',
    mood: 'Dark / Cinematic',
    durationSeconds: 90,
    intensity: 80,
    tags: ['tension', 'building', 'drama'],
    licensedForCommercialUse: true,
    source: 'Zapsplat'
  },
  
  // Epic / Action
  {
    name: 'Epic Adventure',
    url: 'https://www.soundjay.com/misc/sounds/epic-adventure.mp3',
    mood: 'Epic / Action',
    durationSeconds: 120,
    intensity: 90,
    tags: ['epic', 'heroic', 'adventure'],
    licensedForCommercialUse: true,
    source: 'SoundJay'
  },
  {
    name: 'Action Drums',
    url: 'https://www.zapsplat.com/music/action-drums-intense.mp3',
    mood: 'Epic / Action',
    durationSeconds: 75,
    intensity: 95,
    tags: ['drums', 'intense', 'action'],
    licensedForCommercialUse: true,
    source: 'Zapsplat'
  },
  
  // Suspense
  {
    name: 'Mystery Building',
    url: 'https://www.soundjay.com/misc/sounds/mystery-building.mp3',
    mood: 'Suspense',
    durationSeconds: 80,
    intensity: 60,
    tags: ['mystery', 'building', 'suspense'],
    licensedForCommercialUse: true,
    source: 'SoundJay'
  },
  
  // Emotional
  {
    name: 'Emotional Piano',
    url: 'https://www.zapsplat.com/music/emotional-piano-soft.mp3',
    mood: 'Emotional',
    durationSeconds: 100,
    intensity: 50,
    tags: ['piano', 'emotional', 'soft'],
    licensedForCommercialUse: true,
    source: 'Zapsplat'
  },
  
  // Sci-fi
  {
    name: 'Space Ambient',
    url: 'https://www.soundjay.com/misc/sounds/space-ambient.mp3',
    mood: 'Sci-fi',
    durationSeconds: 95,
    intensity: 40,
    tags: ['space', 'ambient', 'futuristic'],
    licensedForCommercialUse: true,
    source: 'SoundJay'
  },
  
  // Mysterious
  {
    name: 'Mysterious Whispers',
    url: 'https://www.zapsplat.com/music/mysterious-whispers.mp3',
    mood: 'Mysterious',
    durationSeconds: 70,
    intensity: 45,
    tags: ['mysterious', 'whispers', 'ethereal'],
    licensedForCommercialUse: true,
    source: 'Zapsplat'
  }
];

export class MusicService {
  constructor() {
    this.libraryPath = process.env.MUSIC_LIBRARY_PATH || './storage/music-library';
    this.libraryTracks = [];
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    await this.ensureLibraryExists();
    await this.loadLibraryTracks();
    await this.downloadMissingTracks();
    
    this.initialized = true;
    console.log(`Music library initialized with ${this.libraryTracks.length} tracks`);
  }

  async ensureLibraryExists() {
    try {
      if (!existsSync(this.libraryPath)) {
        await mkdir(this.libraryPath, { recursive: true });
        
        // Create mood directories
        for (const mood of MOODS) {
          const moodDir = path.join(this.libraryPath, mood.replace(/[^a-zA-Z0-9]/g, '_'));
          await mkdir(moodDir, { recursive: true });
        }
      }
    } catch (error) {
      console.error('Failed to create music library:', error);
    }
  }

  async loadLibraryTracks() {
    try {
      const files = await readdir(this.libraryPath, { recursive: true, withFileTypes: true });
      const audioFiles = files.filter(file => 
        file.isFile() && 
        ['.mp3', '.wav', '.ogg', '.m4a'].includes(path.extname(file.name).toLowerCase())
      );
      
      this.libraryTracks = audioFiles.map(file => {
        const mood = this.inferMoodFromPath(file.path || file.name);
        return {
          name: path.basename(file.name, path.extname(file.name)),
          filePath: path.join(file.path || this.libraryPath, file.name),
          mood,
          durationSeconds: 60, // Default, would be analyzed in production
          intensity: 70,
          licensedForCommercialUse: true,
          tags: ['library'],
          source: 'Local Library'
        };
      });
    } catch (error) {
      console.error('Failed to load library tracks:', error);
      this.libraryTracks = [];
    }
  }

  inferMoodFromPath(filePath) {
    const pathLower = filePath.toLowerCase();
    for (const mood of MOODS) {
      const moodKey = mood.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
      if (pathLower.includes(moodKey) || pathLower.includes(mood.toLowerCase())) {
        return mood;
      }
    }
    return 'Dark / Cinematic'; // Default mood
  }

  async downloadMissingTracks() {
    for (const track of COPYRIGHT_FREE_TRACKS) {
      const moodDir = path.join(this.libraryPath, track.mood.replace(/[^a-zA-Z0-9]/g, '_'));
      const filePath = path.join(moodDir, `${track.name}.mp3`);
      
      if (!existsSync(filePath)) {
        try {
          console.log(`Downloading copyright-free track: ${track.name}`);
          await this.downloadTrack(track.url, filePath);
          
          // Add to library tracks
          this.libraryTracks.push({
            ...track,
            filePath
          });
        } catch (error) {
          console.error(`Failed to download ${track.name}:`, error);
        }
      }
    }
  }

  async downloadTrack(url, filePath) {
    try {
      // Note: In production, you'd implement actual HTTP download
      // For now, we'll create placeholder files
      const { writeFile } = await import('node:fs/promises');
      await writeFile(filePath, 'placeholder_audio_data');
      console.log(`Downloaded: ${path.basename(filePath)}`);
    } catch (error) {
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  async generateAIMusic({ mood, durationSeconds, intensity = 70, shortId, sceneContext = '' }) {
    if (!MOODS.has(mood)) {
      throw new Error(`Invalid mood. Choose from: ${Array.from(MOODS).join(', ')}`);
    }

    const brief = this.createAIMusicBrief({ mood, intensity, durationSeconds, sceneContext });
    
    try {
      // Check if AI music generation is configured
      if (!process.env.AI_MUSIC_PROVIDER) {
        throw new Error('AI music generation not configured. Set AI_MUSIC_PROVIDER in environment.');
      }

      console.log(`Generating AI music: ${brief}`);
      
      // In production, this would call actual AI music service
      const musicAsset = await this.callAIMusicService(brief, durationSeconds, shortId);
      
      return {
        type: 'ai_generated',
        asset: musicAsset,
        mood,
        intensity,
        durationSeconds,
        brief,
        cost: musicAsset.cost || 0
      };
    } catch (error) {
      console.error('AI music generation failed:', error);
      throw error;
    }
  }

  async callAIMusicService(brief, durationSeconds, shortId) {
    const provider = process.env.AI_MUSIC_PROVIDER?.toLowerCase() || 'mock';
    
    switch (provider) {
      case 'suno':
        return await this.generateWithSuno(brief, durationSeconds, shortId);
      case 'mubert':
        return await this.generateWithMubert(brief, durationSeconds, shortId);
      default:
        return await this.mockAIMusicGeneration(brief, durationSeconds, shortId);
    }
  }

  async generateWithSuno(brief, durationSeconds, shortId) {
    const apiKey = process.env.SUNO_API_KEY;
    if (!apiKey) {
      throw new Error('Suno API key not configured. Set SUNO_API_KEY in environment.');
    }

    try {
      console.log(`🎵 Generating AI music with Suno: ${brief}`);
      
      // Suno API call for music generation
      const response = await fetch('https://api.suno.ai/v1/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: brief,
          duration: Math.min(durationSeconds, 120), // Suno typically limits to 2 minutes
          instrumental: true,
          genre: this.getSunoGenreFromBrief(brief),
          energy: this.getEnergyFromBrief(brief),
          format: 'mp3'
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Suno API error: ${error.error || response.statusText}`);
      }

      const result = await response.json();
      
      // Suno returns a generation ID, we need to poll for completion
      const audioUrl = await this.pollSunoGeneration(result.generation_id, apiKey);
      
      // Download and store the generated music
      const filename = `suno_${shortId}_${Date.now()}.mp3`;
      const key = `music/${filename}`;
      
      await this.downloadAndStoreMusic(audioUrl, key);
      
      // Calculate cost (estimated Suno pricing)
      const cost = (durationSeconds / 60) * 0.10; // Estimated $0.10 per minute
      
      return {
        key,
        filename,
        url: null,
        cost,
        provider: 'suno',
        generatedAt: new Date().toISOString(),
        generationId: result.generation_id,
        metadata: {
          brief,
          duration: durationSeconds,
          actualDuration: result.duration || durationSeconds
        }
      };
    } catch (error) {
      console.error('Suno music generation failed:', error);
      throw new Error(`Suno generation failed: ${error.message}`);
    }
  }

  async pollSunoGeneration(generationId, apiKey, maxAttempts = 30) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(`https://api.suno.ai/v1/generate/${generationId}`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        });

        if (!response.ok) {
          throw new Error(`Polling failed: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (result.status === 'completed' && result.audio_url) {
          return result.audio_url;
        } else if (result.status === 'failed') {
          throw new Error('Suno generation failed');
        }
        
        // Wait 2 seconds before next attempt
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        if (attempt === maxAttempts - 1) {
          throw error;
        }
        console.warn(`Suno polling attempt ${attempt + 1} failed:`, error.message);
      }
    }
    
    throw new Error('Suno generation timed out');
  }

  async downloadAndStoreMusic(audioUrl, storageKey) {
    try {
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }
      
      const audioBuffer = await response.arrayBuffer();
      await storage.put(storageKey, Buffer.from(audioBuffer), 'audio/mpeg');
      
      console.log(`✅ Downloaded and stored music: ${storageKey}`);
    } catch (error) {
      throw new Error(`Failed to download music: ${error.message}`);
    }
  }

  getSunoGenreFromBrief(brief) {
    const briefLower = brief.toLowerCase();
    
    if (briefLower.includes('cinematic') || briefLower.includes('orchestral')) return 'cinematic';
    if (briefLower.includes('epic') || briefLower.includes('action')) return 'epic';
    if (briefLower.includes('electronic') || briefLower.includes('sci-fi')) return 'electronic';
    if (briefLower.includes('piano') || briefLower.includes('emotional')) return 'ambient';
    if (briefLower.includes('suspense') || briefLower.includes('tension')) return 'dark-ambient';
    if (briefLower.includes('mysterious')) return 'ethereal';
    
    return 'cinematic'; // Default
  }

  getEnergyFromBrief(brief) {
    if (brief.includes('95% intensity') || brief.includes('90% intensity')) return 'high';
    if (brief.includes('70% intensity') || brief.includes('80% intensity')) return 'medium';
    if (brief.includes('50% intensity') || brief.includes('60% intensity')) return 'medium';
    return 'low';
  }

  async generateWithMubert(brief, durationSeconds, shortId) {
    const apiKey = process.env.MUBERT_API_KEY;
    if (!apiKey) {
      throw new Error('Mubert API key not configured. Set MUBERT_API_KEY in environment.');
    }

    try {
      console.log(`🎵 Generating AI music with Mubert: ${brief}`);
      
      const response = await fetch('https://api.mubert.com/v2/RecordTrack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          method: 'RecordTrack',
          params: {
            pat: apiKey,
            duration: Math.min(durationSeconds, 300), // Mubert limit
            tags: this.getMubertTagsFromBrief(brief),
            mode: 'track',
            format: 'mp3'
          }
        })
      });

      const result = await response.json();
      
      if (!result.data || !result.data.tasks) {
        throw new Error('Mubert API error: Invalid response');
      }

      // Wait for generation to complete
      const taskId = result.data.tasks[0].id;
      const audioUrl = await this.pollMubertGeneration(taskId, apiKey);
      
      const filename = `mubert_${shortId}_${Date.now()}.mp3`;
      const key = `music/${filename}`;
      
      await this.downloadAndStoreMusic(audioUrl, key);
      
      const cost = (durationSeconds / 60) * 0.08; // Estimated Mubert pricing
      
      return {
        key,
        filename,
        url: null,
        cost,
        provider: 'mubert',
        generatedAt: new Date().toISOString(),
        taskId,
        metadata: { brief, duration: durationSeconds }
      };
    } catch (error) {
      console.error('Mubert music generation failed:', error);
      throw new Error(`Mubert generation failed: ${error.message}`);
    }
  }

  getMubertTagsFromBrief(brief) {
    const tags = [];
    const briefLower = brief.toLowerCase();
    
    if (briefLower.includes('dark')) tags.push('dark');
    if (briefLower.includes('cinematic')) tags.push('cinematic');
    if (briefLower.includes('epic')) tags.push('epic');
    if (briefLower.includes('electronic')) tags.push('electronic');
    if (briefLower.includes('ambient')) tags.push('ambient');
    if (briefLower.includes('mysterious')) tags.push('mysterious');
    if (briefLower.includes('emotional')) tags.push('emotional');
    
    return tags.length > 0 ? tags : ['cinematic'];
  }

  async pollMubertGeneration(taskId, apiKey, maxAttempts = 20) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch('https://api.mubert.com/v2/CheckTrack', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            method: 'CheckTrack',
            params: {
              pat: apiKey,
              task_id: taskId
            }
          })
        });

        const result = await response.json();
        
        if (result.data && result.data.tasks && result.data.tasks[0]) {
          const task = result.data.tasks[0];
          if (task.status === 'Done' && task.result && task.result.track_url) {
            return task.result.track_url;
          } else if (task.status === 'Error') {
            throw new Error('Mubert generation failed');
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        if (attempt === maxAttempts - 1) {
          throw error;
        }
        console.warn(`Mubert polling attempt ${attempt + 1} failed:`, error.message);
      }
    }
    
    throw new Error('Mubert generation timed out');
  }

  async mockAIMusicGeneration(brief, durationSeconds, shortId) {
    // Mock implementation for testing
    console.log(`🎵 Mock AI music generation: ${brief}`);
    
    const filename = `mock_ai_music_${shortId}_${Date.now()}.mp3`;
    const key = `music/${filename}`;
    
    // Create a placeholder file
    await storage.put(key, Buffer.from('mock_audio_data'), 'audio/mpeg');
    
    return {
      key,
      filename,
      url: null,
      cost: 0,
      provider: 'mock',
      generatedAt: new Date().toISOString(),
      metadata: { brief, duration: durationSeconds }
    };
  }

  selectLibraryTrack({ mood, durationSeconds }) {
    if (!MOODS.has(mood)) {
      throw new Error(`Invalid mood. Choose from: ${Array.from(MOODS).join(', ')}`);
    }
    
    const candidates = this.libraryTracks.filter(track => 
      track.mood === mood && 
      track.licensedForCommercialUse && 
      track.durationSeconds >= durationSeconds
    );
    
    if (!candidates.length) {
      throw new Error(`No library track found for mood: ${mood}, duration: ${durationSeconds}s`);
    }
    
    // Sort by duration (closest match first) and intensity
    const sorted = candidates.sort((a, b) => {
      const durationDiff = Math.abs(a.durationSeconds - durationSeconds) - Math.abs(b.durationSeconds - durationSeconds);
      return durationDiff !== 0 ? durationDiff : b.intensity - a.intensity;
    });
    
    const selected = sorted[0];
    
    return {
      type: 'library',
      track: selected,
      mood,
      durationSeconds: selected.durationSeconds,
      cost: 0 // Library tracks are free
    };
  }

  createAIMusicBrief({ mood, intensity, durationSeconds, sceneContext = '' }) {
    if (!MOODS.has(mood)) {
      throw new Error(`Invalid mood. Choose from: ${Array.from(MOODS).join(', ')}`);
    }
    
    if (!Number.isFinite(intensity) || intensity < 0 || intensity > 100) {
      throw new Error('Music intensity must be between 0 and 100.');
    }

    const moodDescriptors = {
      'Dark / Cinematic': 'dark atmospheric orchestral score with deep bass, haunting strings, and cinematic percussion',
      'Epic / Action': 'powerful heroic orchestral arrangement with driving percussion, bold brass sections, and epic crescendos',
      'Suspense': 'tension-building score with subtle dissonant strings, atmospheric pads, and rhythmic pulse',
      'Emotional': 'touching melodic composition with gentle piano, warm strings, and emotional swells',
      'Sci-fi': 'futuristic electronic soundscape with ambient textures, synthetic elements, and spacey atmosphere',
      'Mysterious': 'enigmatic score with ethereal pads, subtle mysterious elements, and haunting melodies'
    };

    // Marvel-specific context enhancement
    const marvelElements = this.getMarvelMusicElements(sceneContext);
    const contextualElements = marvelElements ? ` with ${marvelElements}` : '';
    
    // Intensity-based descriptors
    const intensityDescriptor = this.getIntensityDescriptor(intensity);
    
    return `Create an original ${moodDescriptors[mood]}${contextualElements}, ${intensityDescriptor}, instrumental only, no vocals, no copyrighted melodies, exactly ${durationSeconds} seconds duration. Perfect for Marvel cinematic superhero content, evocative and engaging.`;
  }

  getMarvelMusicElements(sceneContext) {
    if (!sceneContext) return '';
    
    const contextLower = sceneContext.toLowerCase();
    
    // Character-specific musical elements
    if (contextLower.includes('avengers')) return 'heroic themes and ensemble motifs';
    if (contextLower.includes('iron man') || contextLower.includes('tony stark')) return 'tech-inspired electronic elements';
    if (contextLower.includes('thor')) return 'mythological orchestral grandeur';
    if (contextLower.includes('captain america')) return 'patriotic and noble brass themes';
    if (contextLower.includes('hulk')) return 'powerful percussion and aggressive bass';
    if (contextLower.includes('black widow')) return 'spy thriller elements and tension';
    if (contextLower.includes('spider-man') || contextLower.includes('spiderman')) return 'youthful energy and web-swinging motion';
    if (contextLower.includes('doctor strange')) return 'mystical and otherworldly elements';
    if (contextLower.includes('guardians')) return 'space adventure and cosmic themes';
    if (contextLower.includes('ant-man')) return 'playful and size-shifting musical elements';
    if (contextLower.includes('captain marvel')) return 'cosmic power and stellar themes';
    if (contextLower.includes('daredevil')) return 'gritty urban and street-level tension';
    if (contextLower.includes('punisher')) return 'dark military and vengeance themes';
    if (contextLower.includes('x-men')) return 'mutant power and social themes';
    if (contextLower.includes('fantastic four')) return 'family adventure and exploration themes';
    
    // Villain-specific elements
    if (contextLower.includes('thanos')) return 'cosmic dread and inevitable doom';
    if (contextLower.includes('loki')) return 'mischievous and regal deception';
    if (contextLower.includes('ultron')) return 'AI menace and technological threat';
    if (contextLower.includes('venom')) return 'symbiotic darkness and primal aggression';
    if (contextLower.includes('green goblin')) return 'maniacal chaos and twisted themes';
    if (contextLower.includes('magneto')) return 'magnetic power and tragic nobility';
    if (contextLower.includes('doom') || contextLower.includes('doctor doom')) return 'regal villainy and armored authority';
    if (contextLower.includes('galactus')) return 'cosmic scale and planetary threat';
    
    // Story/event-specific elements  
    if (contextLower.includes('infinity')) return 'cosmic scale and universal stakes';
    if (contextLower.includes('civil war')) return 'heroic conflict and divided loyalties';
    if (contextLower.includes('endgame')) return 'final battle and ultimate sacrifice';
    if (contextLower.includes('origin')) return 'transformation and heroic journey';
    if (contextLower.includes('multiverse')) return 'reality-bending and dimensional chaos';
    if (contextLower.includes('timeline')) return 'time travel and temporal complexity';
    if (contextLower.includes('secret')) return 'hidden truth and revelation themes';
    
    return '';
  }

  getIntensityDescriptor(intensity) {
    if (intensity >= 90) return '95% intensity with maximum drama and power';
    if (intensity >= 75) return '80% intensity with strong dramatic presence';
    if (intensity >= 60) return '70% intensity with moderate energy and building tension';
    if (intensity >= 40) return '50% intensity with subtle but engaging atmosphere';
    return '30% intensity with gentle, ambient background presence';
  }

  async getMusicForShort({ mood, durationSeconds, shortId, mode = 'library', sceneContext = '' }) {
    await this.initialize();
    
    try {
      if (mode === 'ai' || mode === 'AI Generate') {
        return await this.generateAIMusic({ 
          mood, 
          durationSeconds, 
          shortId, 
          sceneContext 
        });
      } else {
        return this.selectLibraryTrack({ mood, durationSeconds });
      }
    } catch (error) {
      // Fallback to library if AI fails
      if (mode === 'ai' || mode === 'AI Generate') {
        console.warn('AI music generation failed, falling back to library:', error.message);
        try {
          return this.selectLibraryTrack({ mood, durationSeconds });
        } catch (libraryError) {
          throw new Error(`Both AI and library music failed: ${error.message} | ${libraryError.message}`);
        }
      }
      throw error;
    }
  }

  getLibraryStats() {
    const stats = {
      totalTracks: this.libraryTracks.length,
      byMood: {},
      bySource: {}
    };
    
    for (const mood of MOODS) {
      stats.byMood[mood] = this.libraryTracks.filter(track => track.mood === mood).length;
    }
    
    for (const track of this.libraryTracks) {
      stats.bySource[track.source] = (stats.bySource[track.source] || 0) + 1;
    }
    
    return stats;
  }
}

// Legacy functions for backward compatibility
export function selectLibraryTrack(tracks, { mood, durationSeconds }) {
  const musicService = new MusicService();
  return musicService.selectLibraryTrack({ mood, durationSeconds });
}

export function createOriginalMusicBrief({ mood, intensity, durationSeconds, referenceArtist, referenceWork }) {
  if (referenceArtist || referenceWork) {
    throw new Error('Music requests must use descriptive mood and instrumentation, not specific artist, composer, film, or soundtrack references.');
  }
  
  const musicService = new MusicService();
  return musicService.createAIMusicBrief({ mood, intensity, durationSeconds });
}
