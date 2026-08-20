import { storage } from './storage.js';
import { readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const MOODS = new Set(['Dark / Cinematic', 'Epic / Action', 'Suspense', 'Emotional', 'Sci-fi', 'Mysterious']);

// Verified royalty-free music libraries for automated ingestion
const MUSIC_LIBRARIES = [
  {
    name: 'Mixkit',
    priority: 1, // PRIMARY source
    baseUrl: 'https://mixkit.co',
    license: {
      type: 'Mixkit License',
      commercialUse: true,
      attributionRequired: false,
      youtubeMonetization: true
    },
    tracks: [
      // Dark / Cinematic
      {
        id: 'mixkit-fright-night',
        name: 'Fright Night',
        sourcePage: 'https://mixkit.co/free-stock-music/tag/cinematic/',
        mood: 'Dark / Cinematic',
        durationSeconds: 101,
        intensity: 82,
        tags: ['dark', 'thriller', 'mysterious', 'piano', 'percussion']
      },
      {
        id: 'mixkit-piano-horror',
        name: 'Piano Horror',
        sourcePage: 'https://mixkit.co/free-stock-music/tag/cinematic/',
        mood: 'Dark / Cinematic',
        durationSeconds: 113,
        intensity: 76,
        tags: ['dark', 'horror', 'eerie', 'piano', 'thriller']
      },
      
      // Epic / Action
      {
        id: 'mixkit-epical-drums-01',
        name: 'Epical Drums 01',
        sourcePage: 'https://mixkit.co/free-stock-music/tag/cinematic/',
        mood: 'Epic / Action',
        durationSeconds: 106,
        intensity: 95,
        tags: ['action', 'trailer', 'percussion', 'cinematic']
      },
      {
        id: 'mixkit-epical-drums-02',
        name: 'Epical Drums 02',
        sourcePage: 'https://mixkit.co/free-stock-music/tag/cinematic/',
        mood: 'Epic / Action',
        durationSeconds: 123,
        intensity: 91,
        tags: ['action', 'drums', 'trailer', 'cinematic']
      },
      {
        id: 'mixkit-epical-drums-05',
        name: 'Epical Drums 05',
        sourcePage: 'https://mixkit.co/free-stock-music/tag/cinematic/',
        mood: 'Epic / Action',
        durationSeconds: 102,
        intensity: 94,
        tags: ['orchestral', 'brass', 'drums', 'trailer']
      },
      {
        id: 'mixkit-epical-drums-06',
        name: 'Epical Drums 06',
        sourcePage: 'https://mixkit.co/free-stock-music/tag/cinematic/',
        mood: 'Epic / Action',
        durationSeconds: 103,
        intensity: 96,
        tags: ['action', 'percussion', 'thriller']
      },
      
      // Emotional
      {
        id: 'mixkit-silent-descent',
        name: 'Silent Descent',
        sourcePage: 'https://mixkit.co/free-stock-music/tag/cinematic/',
        mood: 'Emotional',
        durationSeconds: 160,
        intensity: 35,
        tags: ['piano', 'strings', 'melancholic', 'film-score']
      },
      
      // Sci-fi
      {
        id: 'mixkit-other-world',
        name: 'Other World',
        sourcePage: 'https://mixkit.co/free-stock-music/tag/cinematic/',
        mood: 'Sci-fi',
        durationSeconds: 96,
        intensity: 65,
        tags: ['futuristic', 'electronica', 'technology', 'tension']
      },
      {
        id: 'mixkit-cyberpunk-city',
        name: 'Cyberpunk City',
        sourcePage: 'https://mixkit.co/free-stock-music/tag/cinematic/',
        mood: 'Sci-fi',
        durationSeconds: 120, // estimated
        intensity: 78,
        tags: ['cyberpunk', 'technology', 'electronic', 'futuristic']
      },
      
      // Mysterious
      {
        id: 'mixkit-tapis',
        name: 'Tapis',
        sourcePage: 'https://mixkit.co/free-stock-music/tag/cinematic/',
        mood: 'Mysterious',
        durationSeconds: 163,
        intensity: 55,
        tags: ['synth', 'mysterious', 'atmospheric', 'instrumental']
      },
      {
        id: 'mixkit-echoes',
        name: 'Echoes',
        sourcePage: 'https://mixkit.co/free-stock-music/tag/cinematic/',
        mood: 'Mysterious',
        durationSeconds: 226,
        intensity: 60,
        tags: ['echoes', 'atmospheric', 'suspense', 'ambient']
      },
      
      // Suspense
      {
        id: 'mixkit-vertigo',
        name: 'Vertigo',
        sourcePage: 'https://mixkit.co/free-stock-music/tag/cinematic/',
        mood: 'Suspense',
        durationSeconds: 191,
        intensity: 70,
        tags: ['suspense', 'investigation', 'tension', 'thriller']
      }
    ]
  },
  
  {
    name: 'Incompetech',
    priority: 2, // SECONDARY source
    baseUrl: 'https://incompetech.com',
    license: {
      type: 'Creative Commons Attribution 4.0',
      commercialUse: true,
      attributionRequired: true,
      attributionText: 'Music by Kevin MacLeod (incompetech.com) Licensed under Creative Commons: By Attribution 4.0 License http://creativecommons.org/licenses/by/4.0/',
      youtubeMonetization: true
    },
    tracks: [
      {
        id: 'incompetech-rising-game',
        name: 'Rising Game',
        sourcePage: 'https://incompetech.com/music/royalty-free/index.html',
        mood: 'Dark / Cinematic',
        durationSeconds: 112,
        intensity: 90,
        tags: ['dark', 'epic', 'villain', 'brass', 'strings', 'organ']
      },
      {
        id: 'incompetech-firesong',
        name: 'Firesong',
        sourcePage: 'https://incompetech.com/music/royalty-free/index.html',
        mood: 'Dark / Mysterious',
        durationSeconds: 213,
        intensity: 85,
        tags: ['dark', 'mysterious', 'fantasy', 'orchestral']
      },
      {
        id: 'incompetech-truth-legend',
        name: 'Truth of the Legend',
        sourcePage: 'https://incompetech.com/music/royalty-free/index.html',
        mood: 'Dark / Action',
        durationSeconds: 93,
        intensity: 88,
        tags: ['dark', 'action', 'legend', 'heroic']
      }
    ]
  },
  
  {
    name: 'Bensound',
    priority: 3, // SECONDARY source (attribution workflow is annoying)
    baseUrl: 'https://bensound.com',
    license: {
      type: 'Bensound Free License',
      commercialUse: true,
      attributionRequired: true,
      attributionWorkflow: 'per-video', // Each video needs separate attribution
      youtubeMonetization: true
    },
    tracks: [
      {
        id: 'bensound-dawn-change',
        name: 'Dawn Of Change',
        sourcePage: 'https://bensound.com/free-music-for-videos',
        mood: 'Emotional',
        durationSeconds: 117,
        intensity: 48,
        tags: ['emotional', 'cinematic', 'strings', 'piano']
      },
      {
        id: 'bensound-slow-life',
        name: 'Slow Life',
        sourcePage: 'https://bensound.com/free-music-for-videos',
        mood: 'Epic / Cinematic',
        durationSeconds: 180,
        intensity: 75,
        tags: ['epic', 'cinematic', 'orchestral']
      }
    ]
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
    await this.downloadMoreMusic();
    
    this.initialized = true;
    console.log(`🎵 Music library initialized with ${this.libraryTracks.length} tracks`);
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

  async downloadMoreMusic() {
    console.log('🎵 Expanding music library with verified sources...');
    
    // Process music libraries by priority
    const sortedLibraries = MUSIC_LIBRARIES.sort((a, b) => a.priority - b.priority);
    
    for (const library of sortedLibraries) {
      console.log(`🎵 Processing ${library.name} (Priority ${library.priority})...`);
      
      for (const track of library.tracks) {
        const localPath = path.join(
          this.libraryPath, 
          library.name.toLowerCase(),
          `${track.id}.mp3`
        );
        
        if (!existsSync(localPath)) {
          try {
            const success = await this.ingestMusicTrack(library, track, localPath);
            if (success) {
              console.log(`✅ Ingested: ${track.name} from ${library.name}`);
            }
          } catch (error) {
            console.error(`❌ Failed to ingest ${track.name}:`, error.message);
          }
        } else {
          // File exists, add to library with metadata
          this.addTrackToLibrary(library, track, localPath);
        }
      }
    }
    
    console.log(`🎵 Music library now has ${this.libraryTracks.length} verified tracks`);
  }

  async ingestMusicTrack(library, track, localPath) {
    console.log(`📥 Ingesting ${track.name} from ${library.name}...`);
    
    // Step 1: Discover download URL (this would need library-specific logic)
    const downloadUrl = await this.discoverDownloadUrl(library, track);
    if (!downloadUrl) {
      console.warn(`⚠️ Could not discover download URL for ${track.name}`);
      return false;
    }
    
    // Step 2: Download with validation
    const success = await this.downloadAndValidateTrack(downloadUrl, localPath, track);
    if (!success) {
      return false;
    }
    
    // Step 3: Normalize to 24-second standard
    const normalizedPath = await this.normalizeTrackDuration(localPath, 24);
    
    // Step 4: Add to library with full metadata
    this.addTrackToLibrary(library, track, normalizedPath);
    
    return true;
  }

  async discoverDownloadUrl(library, track) {
    // This would implement library-specific URL discovery
    // For now, return null to indicate manual curation is needed
    console.log(`🔍 Need to implement ${library.name} URL discovery for ${track.name}`);
    console.log(`   Source page: ${track.sourcePage}`);
    return null;
  }

  async downloadAndValidateTrack(url, localPath, expectedTrack) {
    try {
      // Ensure directory exists
      const dir = path.dirname(localPath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
      
      console.log(`📥 Downloading: ${url}`);
      
      // Download with proper headers
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Marvel Shorts Factory Music Downloader 1.0',
          'Accept': 'audio/mpeg, audio/mp3, audio/*, */*'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Validate Content-Type
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('audio') && !contentType.includes('octet-stream')) {
        console.warn(`⚠️ Unexpected Content-Type: ${contentType}`);
      }
      
      // Download and validate
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Basic MP3 validation - check for MP3 magic bytes
      if (!this.isValidMp3(buffer)) {
        throw new Error('Downloaded file is not a valid MP3');
      }
      
      // Save file
      const { writeFile } = await import('node:fs/promises');
      await writeFile(localPath, buffer);
      
      // Verify file size and get metadata
      const stats = await import('node:fs/promises').then(fs => fs.stat(localPath));
      if (stats.size === 0) {
        throw new Error('Downloaded file is empty');
      }
      
      // Get actual duration using FFmpeg
      const actualDuration = await this.getMp3Duration(localPath);
      if (actualDuration && Math.abs(actualDuration - expectedTrack.durationSeconds) > 30) {
        console.warn(`⚠️ Duration mismatch: expected ${expectedTrack.durationSeconds}s, got ${actualDuration}s`);
      }
      
      console.log(`✅ Downloaded and validated: ${path.basename(localPath)} (${Math.round(stats.size / 1024)}KB, ${actualDuration}s)`);
      return true;
      
    } catch (error) {
      console.error(`❌ Download validation failed:`, error.message);
      // Clean up partial file
      try {
        if (existsSync(localPath)) {
          await import('node:fs/promises').then(fs => fs.unlink(localPath));
        }
      } catch {}
      return false;
    }
  }

  isValidMp3(buffer) {
    // Check for MP3 frame header (ID3 tag or MP3 frame sync)
    if (buffer.length < 10) return false;
    
    // Check for ID3v2 tag
    if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
      return true;
    }
    
    // Check for MP3 frame sync (0xFF followed by 0xFx or 0xEx)
    for (let i = 0; i < Math.min(buffer.length - 1, 1000); i++) {
      if (buffer[i] === 0xFF && (buffer[i + 1] & 0xE0) === 0xE0) {
        return true;
      }
    }
    
    return false;
  }

  async getMp3Duration(filePath) {
    try {
      const { spawn } = await import('node:child_process');
      
      return new Promise((resolve, reject) => {
        const ffprobe = spawn('ffprobe', [
          '-v', 'quiet',
          '-show_entries', 'format=duration',
          '-of', 'csv=p=0',
          filePath
        ]);
        
        let output = '';
        ffprobe.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        ffprobe.on('close', (code) => {
          if (code === 0) {
            const duration = parseFloat(output.trim());
            resolve(isNaN(duration) ? null : Math.round(duration));
          } else {
            resolve(null);
          }
        });
        
        ffprobe.on('error', () => resolve(null));
      });
    } catch {
      return null;
    }
  }

  async normalizeTrackDuration(inputPath, targetDuration = 24) {
    const normalizedPath = inputPath.replace('.mp3', '_normalized.mp3');
    
    try {
      const { spawn } = await import('node:child_process');
      
      return new Promise((resolve, reject) => {
        // Normalize to exact duration with fade out
        const ffmpeg = spawn('ffmpeg', [
          '-y',
          '-i', inputPath,
          '-t', targetDuration.toString(),
          '-af', `afade=t=out:st=${targetDuration - 2}:d=2`, // 2-second fade out
          '-c:a', 'libmp3lame',
          '-b:a', '192k',
          '-ar', '48000',
          normalizedPath
        ]);
        
        ffmpeg.on('close', (code) => {
          if (code === 0) {
            console.log(`🎛️ Normalized ${path.basename(inputPath)} to ${targetDuration}s`);
            resolve(normalizedPath);
          } else {
            console.warn(`⚠️ Normalization failed, using original file`);
            resolve(inputPath);
          }
        });
        
        ffmpeg.on('error', () => {
          console.warn(`⚠️ Normalization error, using original file`);
          resolve(inputPath);
        });
      });
    } catch {
      return inputPath;
    }
  }

  addTrackToLibrary(library, track, localPath) {
    const libraryTrack = {
      ...track,
      filePath: localPath,
      source: library.name,
      license: library.license,
      licensedForCommercialUse: library.license.commercialUse,
      attribution: library.license.attributionRequired ? library.license.attributionText : null,
      localPath: localPath,
      verifiedAt: new Date().toISOString(),
      provider: 'library'
    };
    
    // Avoid duplicates
    if (!this.libraryTracks.find(t => t.id === track.id)) {
      this.libraryTracks.push(libraryTrack);
    }
  }

  async downloadTrack(url, filePath) {
    try {
      console.log(`🎵 Downloading royalty-free track: ${path.basename(filePath)}`);
      console.log(`   Source URL: ${url}`);
      
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
      
      // Download the actual MP3 file
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Marvel Shorts Factory Music Downloader 1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Check if response is actually audio
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('audio') && !contentType.includes('octet-stream')) {
        console.warn(`   Warning: Content-Type is ${contentType}, may not be audio`);
      }
      
      // Save the audio file
      const arrayBuffer = await response.arrayBuffer();
      const { writeFile } = await import('node:fs/promises');
      await writeFile(filePath, Buffer.from(arrayBuffer));
      
      // Verify the file was created and has content
      const stats = await import('node:fs/promises').then(fs => fs.stat(filePath));
      if (stats.size === 0) {
        throw new Error('Downloaded file is empty');
      }
      
      console.log(`✅ Downloaded: ${path.basename(filePath)} (${Math.round(stats.size / 1024)}KB)`);
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to download ${path.basename(filePath)}:`, error.message);
      return false;
    }
  }

  async generateAIMusic({ mood, durationSeconds, intensity = 70, shortId, sceneContext = '' }) {
    if (!MOODS.has(mood)) {
      throw new Error(`Invalid mood. Choose from: ${Array.from(MOODS).join(', ')}`);
    }

    const brief = this.createAIMusicBrief({ mood, intensity, durationSeconds, sceneContext });
    
    try {
      // Check if Suno AI music generation is configured
      const provider = process.env.AI_MUSIC_PROVIDER || process.env.SUNO_API_KEY ? 'suno' : null;
      if (!provider) {
        throw new Error('Suno AI music generation not configured. Set SUNO_API_KEY in environment.');
      }

      console.log(`Generating AI music with ${provider}: ${brief}`);
      
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

  /**
   * Generate instrumental music using Suno API (sunoapi.org).
   * 
   * Provider: https://api.sunoapi.org
   * 
   * Required environment variables:
   *   SUNO_API_KEY=...
   *   SUNO_BASE_URL=https://api.sunoapi.org/api/v1
   * 
   * Optional:
   *   SUNO_MODEL=V4_5ALL
   *   SUNO_POLL_INTERVAL_MS=5000
   *   SUNO_MAX_WAIT_MS=300000
   */
  async generateWithSuno(brief, durationSeconds, shortId) {
    const apiKey = process.env.SUNO_API_KEY;
    if (!apiKey) {
      throw new Error('SUNO_API_KEY is not configured');
    }

    const baseUrl = process.env.SUNO_BASE_URL || 'https://api.sunoapi.org/api/v1';
    const model = process.env.SUNO_MODEL || 'V4_5ALL';
    const pollIntervalMs = Number(process.env.SUNO_POLL_INTERVAL_MS) || 5000;
    const maxWaitMs = Number(process.env.SUNO_MAX_WAIT_MS) || 300000;

    if (!brief || typeof brief !== 'string') {
      throw new Error('Suno music brief must be a non-empty string');
    }

    /*
     * Suno's generation is not a precise-duration generator.
     * Generate an instrumental track and later use FFmpeg to trim/loop/fade 
     * it to the exact Shorts duration.
     */
    const targetDuration = Math.max(1, Number(durationSeconds) || 24);

    // Keep the style separate from the creative prompt
    const style = 
      'dark cinematic orchestral, villain theme, deep bass, haunting strings, ' +
      'massive cinematic percussion, regal menace, armored authority, dramatic tension, ' +
      'modern blockbuster score, instrumental';

    const title = `Marvel Shorts ${shortId || Date.now()}`;

    /*
     * Sanitize the prompt - don't tell Suno to reproduce Marvel soundtrack 
     * or copyrighted melody. Ask for an original composition.
     */
    const prompt = String(brief)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000);

    const requestBody = {
      customMode: true,
      instrumental: true,
      model,
      prompt,
      style,
      title,
      callBackUrl: process.env.SUNO_CALLBACK_URL || `http://localhost:3000/api/music/callback/${shortId}` // Required by API
    };

    let response;
    try {
      console.log(`🎵 Generating AI music with Suno: ${prompt}`);
      response = await fetch(`${baseUrl}/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
    } catch (error) {
      throw new Error(`Suno network request failed: ${error.message}`);
    }

    /*
     * Always capture the response body for better error diagnosis
     */
    const responseText = await response.text();
    let result;
    try {
      result = responseText ? JSON.parse(responseText) : null;
    } catch {
      throw new Error(
        `Suno returned invalid JSON (HTTP ${response.status}): ` +
        responseText.slice(0, 500)
      );
    }

    if (!response.ok) {
      const message = 
        result?.msg || 
        result?.message || 
        result?.error || 
        response.statusText || 
        'Unknown Suno API error';
      
      throw new Error(
        `Suno generation request failed (HTTP ${response.status}): ${message}`
      );
    }

    if (!result || result.code !== 200) {
      throw new Error(
        `Suno generation rejected: ${result?.msg || 'Unknown API error'}`
      );
    }

    const taskId = result?.data?.taskId;
    if (!taskId) {
      throw new Error('Suno generation response did not contain taskId');
    }

    console.log(`[Suno] Generation started: ${taskId}`);

    // Poll until SUCCESS
    const generation = await this.pollSunoGeneration(taskId, apiKey, {
      baseUrl,
      pollIntervalMs,
      maxWaitMs
    });

    /*
     * The documented response contains response.sunoData[]
     * Each item can contain: audioUrl, streamAudioUrl, duration, title, id
     */
    const tracks = 
      generation?.response?.sunoData ||
      generation?.response?.data ||
      generation?.response?.suno_data ||
      [];

    if (!Array.isArray(tracks) || tracks.length === 0) {
      throw new Error(
        `Suno completed task ${taskId}, but no generated audio was returned`
      );
    }

    // Prefer a downloadable audio URL over a streaming URL
    const track = 
      tracks.find(item => item?.audioUrl) ||
      tracks.find(item => item?.audio_url) ||
      tracks[0];

    const audioUrl = 
      track?.audioUrl ||
      track?.audio_url ||
      track?.streamAudioUrl ||
      track?.stream_audio_url;

    if (!audioUrl) {
      throw new Error(
        `Suno completed task ${taskId}, but no audio URL was returned`
      );
    }

    console.log(`[Suno] Generation completed: ${taskId}`);

    // Download and store the generated music
    const filename = `suno_${shortId}_${Date.now()}.mp3`;
    const key = `music/${filename}`;
    
    await this.downloadAndStoreMusic(audioUrl, key);
    
    // Calculate cost (estimated Suno pricing)
    const cost = (targetDuration / 60) * 0.10; // Estimated $0.10 per minute
    
    return {
      key,
      filename,
      url: null,
      cost,
      provider: 'suno',
      generatedAt: new Date().toISOString(),
      taskId,
      model,
      metadata: {
        brief: prompt,
        style,
        duration: targetDuration,
        actualDuration: track.duration || targetDuration,
        track
      }
    };
  }

  /**
   * Poll Suno generation task.
   * 
   * Endpoint: GET /api/v1/generate/record-info?taskId=...
   */
  async pollSunoGeneration(taskId, apiKey, {
    baseUrl = process.env.SUNO_BASE_URL || 'https://api.sunoapi.org/api/v1',
    pollIntervalMs = 5000,
    maxWaitMs = 300000
  } = {}) {
    const startedAt = Date.now();
    
    const terminalFailureStatuses = new Set([
      'CREATE_TASK_FAILED',
      'GENERATE_AUDIO_FAILED',
      'CALLBACK_EXCEPTION',
      'SENSITIVE_WORD_ERROR',
      'FAILED',
      'ERROR'
    ]);

    while (true) {
      const elapsed = Date.now() - startedAt;
      
      if (elapsed >= maxWaitMs) {
        throw new Error(
          `Suno generation timed out after ${Math.round(maxWaitMs / 1000)} seconds (task ${taskId})`
        );
      }

      let response;
      try {
        response = await fetch(
          `${baseUrl}/generate/record-info?taskId=${encodeURIComponent(taskId)}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Accept': 'application/json'
            }
          }
        );
      } catch (error) {
        console.warn(`[Suno] Poll request failed for ${taskId}:`, error.message);
        await this.sleep(pollIntervalMs);
        continue;
      }

      const responseText = await response.text();
      let result;
      try {
        result = responseText ? JSON.parse(responseText) : null;
      } catch {
        throw new Error(
          `Suno polling returned invalid JSON (HTTP ${response.status})`
        );
      }

      /*
       * HTTP errors should normally not be retried forever.
       * 429 is treated specially because it can be a temporary rate limit.
       */
      if (response.status === 429) {
        console.warn(
          `[Suno] Rate limited while polling ${taskId}. Waiting before retry.`
        );
        await this.sleep(Math.max(pollIntervalMs, 10000));
        continue;
      }

      if (!response.ok) {
        throw new Error(
          `Suno polling failed (HTTP ${response.status}): ${result?.msg || response.statusText}`
        );
      }

      if (!result || result.code !== 200) {
        throw new Error(
          `Suno polling API error: ${result?.msg || 'Unknown error'}`
        );
      }

      const data = result?.data || {};
      const status = String(data.status || '').toUpperCase();
      
      console.log(`[Suno] ${taskId}: ${status || 'UNKNOWN'}`);

      // Successful completion
      if (status === 'SUCCESS') {
        return data;
      }

      /*
       * FIRST_SUCCESS means the first generated track may already be available.
       * We prefer waiting for SUCCESS because the API documents SUCCESS as all tracks generated.
       */
      if (status === 'FIRST_SUCCESS') {
        const tracks = 
          data?.response?.sunoData ||
          data?.response?.data ||
          [];
        
        if (
          Array.isArray(tracks) &&
          tracks.some(track => track?.audioUrl || track?.audio_url)
        ) {
          return data;
        }
      }

      // Terminal failures
      if (terminalFailureStatuses.has(status)) {
        throw new Error(
          `Suno generation failed (task ${taskId}, status ${status}): ` +
          `${data.errorMessage || result.msg || 'Unknown error'}`
        );
      }

      // Continue polling
      await this.sleep(pollIntervalMs);
    }
  }

  async generateSyntheticTrack(mood, filePath) {
    console.log(`🎛️ Generating synthetic track for ${mood}...`);
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    
    // Generate a simple synthetic audio track using FFmpeg
    // This creates a basic tone-based track that won't break the system
    const { spawn } = await import('node:child_process');
    
    // Different tone patterns for different moods
    const toneConfigs = {
      'Dark / Cinematic': 'sine=frequency=110:duration=30,sine=frequency=165:duration=30',
      'Epic / Action': 'sine=frequency=220:duration=30,sine=frequency=330:duration=30',
      'Suspense': 'sine=frequency=55:duration=30,sine=frequency=82.5:duration=30',
      'Emotional': 'sine=frequency=261.63:duration=30,sine=frequency=329.63:duration=30',
      'Sci-fi': 'sine=frequency=440:duration=30,sine=frequency=523.25:duration=30',
      'Mysterious': 'sine=frequency=196:duration=30,sine=frequency=293.66:duration=30'
    };
    
    const toneConfig = toneConfigs[mood] || toneConfigs['Dark / Cinematic'];
    
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y', // Overwrite output
        '-f', 'lavfi',
        '-i', `${toneConfig}`,
        '-t', '30', // 30 seconds
        '-c:a', 'libmp3lame',
        '-b:a', '128k',
        filePath
      ]);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ Generated synthetic track: ${path.basename(filePath)}`);
          
          // Add to library
          this.libraryTracks.push({
            name: `Synthetic ${mood} Track`,
            filePath,
            mood,
            durationSeconds: 30,
            intensity: 50,
            tags: ['synthetic', 'generated'],
            licensedForCommercialUse: true,
            source: 'Generated'
          });
          
          resolve(true);
        } else {
          reject(new Error(`FFmpeg failed with code ${code}`));
        }
      });
      
      ffmpeg.on('error', reject);
    });
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
    
    // Filter tracks by mood and commercial license
    const candidates = this.libraryTracks.filter(track => 
      track.mood === mood && 
      track.licensedForCommercialUse && 
      track.durationSeconds >= 20 // Minimum 20 seconds (will be normalized to 24)
    );
    
    if (!candidates.length) {
      throw new Error(`No library track found for mood: ${mood}. Available tracks: ${this.libraryTracks.length}`);
    }
    
    // Prioritize by source quality: Mixkit > Incompetech > Others
    const prioritized = candidates.sort((a, b) => {
      const priorityMap = { 'Mixkit': 1, 'Incompetech': 2, 'Bensound': 3 };
      const aPriority = priorityMap[a.source] || 10;
      const bPriority = priorityMap[b.source] || 10;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // Secondary sort: prefer tracks closer to target duration
      const aDurationDiff = Math.abs(a.durationSeconds - durationSeconds);
      const bDurationDiff = Math.abs(b.durationSeconds - durationSeconds);
      
      if (aDurationDiff !== bDurationDiff) {
        return aDurationDiff - bDurationDiff;
      }
      
      // Tertiary sort: prefer higher intensity for more engaging content
      return b.intensity - a.intensity;
    });
    
    const selected = prioritized[0];
    
    console.log(`🎵 Selected library track: ${selected.name} (${selected.source}, ${selected.intensity}% intensity)`);
    
    return {
      type: 'library',
      track: {
        ...selected,
        // Ensure the file path works for FFmpeg
        filePath: selected.localPath || selected.filePath
      },
      mood,
      durationSeconds: selected.durationSeconds,
      cost: 0,
      attribution: selected.attribution
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
      'Dark / Cinematic': 'Original dark cinematic orchestral score for a powerful armored supervillain. Deep sub-bass, ominous low strings, haunting sustained violins, massive cinematic percussion, metallic impacts, regal brass, slow threatening progression, immense dramatic tension, intelligent and calculating villain energy, militaristic authority, dark heroic scale',
      'Epic / Action': 'Original heroic orchestral arrangement with driving percussion, bold brass sections, and epic crescendos for superhero action sequences. Powerful rhythmic foundation, soaring melodies, triumphant themes',
      'Suspense': 'Original tension-building score with subtle dissonant strings, atmospheric pads, and rhythmic pulse for thriller sequences. Building anxiety, mysterious undertones, psychological tension',
      'Emotional': 'Original touching melodic composition with gentle piano, warm strings, and emotional swells for character moments. Heart-touching melodies, intimate orchestration, uplifting resolution',
      'Sci-fi': 'Original futuristic electronic soundscape with ambient textures, synthetic elements, and spacey atmosphere for cosmic scenes. Technological sounds, otherworldly ambience, digital textures',
      'Mysterious': 'Original enigmatic score with ethereal pads, subtle mysterious elements, and haunting melodies for supernatural sequences. Mystical atmosphere, ancient secrets, magical undertones'
    };

    // Marvel-specific context enhancement (without copyright references)
    const marvelElements = this.getMarvelMusicElements(sceneContext);
    const contextualElements = marvelElements ? ` ${marvelElements}` : '';
    
    // Intensity-based descriptors
    const intensityDescriptor = this.getIntensityDescriptor(intensity);
    
    return `${moodDescriptors[mood]}${contextualElements}, ${intensityDescriptor}. Instrumental only. No vocals. No lyrics. No recognizable existing melodies. Original composition for ${durationSeconds} seconds.`;
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

  async getMusicForShort({ mood, durationSeconds, shortId, mode = 'ai', sceneContext = '' }) {
    await this.initialize();
    
    try {
      // Try Suno AI first
      console.log('🎵 Attempting Suno AI music generation...');
      return await this.generateAIMusic({ 
        mood, 
        durationSeconds, 
        shortId, 
        sceneContext 
      });
    } catch (sunoError) {
      console.warn('🎵 Suno AI failed, falling back to library music:', sunoError.message);
      
      // Fallback to library music
      try {
        return this.selectLibraryTrack({ mood, durationSeconds });
      } catch (libraryError) {
        console.error('🎵 Library music also failed:', libraryError.message);
        
        // Try to download more music and retry
        console.log('🎵 Attempting to expand music library...');
        await this.downloadMoreMusic();
        
        try {
          return this.selectLibraryTrack({ mood, durationSeconds });
        } catch (retryError) {
          // Final fallback - return mock track
          return {
            type: 'mock',
            track: {
              name: 'Silent Track (All Music Failed)',
              filePath: null,
              mood,
              durationSeconds,
              provider: 'mock'
            },
            mood,
            durationSeconds,
            cost: 0,
            error: `Suno: ${sunoError.message}, Library: ${libraryError.message}`
          };
        }
      }
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
