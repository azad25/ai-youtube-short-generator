/**
 * Comic-style shorts route handlers
 * Individual handler functions that integrate with the existing server pattern
 */

import { v4 as uuidv4 } from 'uuid';
import { storage } from '../lib/storage.js';

// Marvel characters configuration
const MARVEL_CHARACTERS = {
  'spider-man': {
    name: 'Spider-Man',
    alias: 'Peter Parker',
    powers: ['web-slinging', 'spider-sense', 'superhuman strength'],
    commonVillains: ['Green Goblin', 'Venom', 'Doctor Octopus', 'Sandman'],
    settings: ['New York City', 'Daily Bugle', 'Queens', 'Manhattan'],
    musicMood: 'Epic / Action',
    soundEffects: ['THWIP!', 'THWAP!', 'SPLAT!']
  },
  'iron-man': {
    name: 'Iron Man', 
    alias: 'Tony Stark',
    powers: ['arc reactor', 'repulsors', 'flight', 'AI assistance'],
    commonVillains: ['Mandarin', 'Iron Monger', 'Whiplash', 'Ultron'],
    settings: ['Stark Tower', 'Workshop', 'Malibu Mansion', 'New York'],
    musicMood: 'Sci-fi',
    soundEffects: ['REPULSOR BLAST!', 'CLANG!', 'WHIRRRR!']
  },
  'captain-america': {
    name: 'Captain America',
    alias: 'Steve Rogers',
    powers: ['super soldier serum', 'shield mastery', 'leadership'],
    commonVillains: ['Red Skull', 'Winter Soldier', 'Baron Zemo', 'Hydra'],
    settings: ['Brooklyn', 'S.H.I.E.L.D. Headquarters', 'Avengers Compound'],
    musicMood: 'Epic / Action',
    soundEffects: ['CLANG!', 'THUD!', 'SHIELD THROW!']
  },
  'thor': {
    name: 'Thor',
    alias: 'God of Thunder',
    powers: ['Mjolnir', 'lightning', 'superhuman strength', 'flight'],
    commonVillains: ['Loki', 'Hela', 'Malekith', 'Destroyer'],
    settings: ['Asgard', 'New York', 'Rainbow Bridge', 'Earth'],
    musicMood: 'Epic / Action',
    soundEffects: ['CRACK-A-BOOM!', 'LIGHTNING!', 'THUNDER!']
  },
  'hulk': {
    name: 'Hulk',
    alias: 'Bruce Banner',
    powers: ['superhuman strength', 'regeneration', 'gamma radiation'],
    commonVillains: ['Abomination', 'Leader', 'General Ross', 'Absorbing Man'],
    settings: ['New York', 'Laboratory', 'Desert', 'City Streets'],
    musicMood: 'Dark / Cinematic',
    soundEffects: ['SMASH!', 'CRASH!', 'THOOM!', 'GRRRR!']
  },
  'doctor-doom': {
    name: 'Doctor Doom',
    alias: 'Victor Von Doom',
    powers: ['mystical armor', 'genius intellect', 'sorcery', 'technology'],
    commonVillains: ['Fantastic Four', 'Reed Richards', 'Galactus'],
    settings: ['Latveria', 'Doom Castle', 'Laboratory', 'Doomstadt'],
    musicMood: 'Dark / Cinematic',
    soundEffects: ['DOOM!', 'CRUSH!', 'MAGIC BLAST!']
  }
};

/**
 * Parse request body helper
 */
async function parseRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => {
      body += chunk.toString();
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error('Invalid JSON in request body'));
      }
    });
    request.on('error', reject);
  });
}

/**
 * Send JSON response helper
 */
function sendJson(response, data, statusCode = 200) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  response.end(JSON.stringify(data));
}

/**
 * Create a new comic-style short
 */
export async function createComicHandler(request, response, context) {
  try {
    const body = await parseRequestBody(request);
    const {
      character = 'spider-man',
      villain = null,
      theme = 'action',
      style = 'CLASSIC',
      duration = 24,
      includeMusic = true
    } = body;

    console.log(`🎨 Creating comic short: ${character} ${villain ? `vs ${villain}` : 'adventure'}`);

    // Validate character
    const characterConfig = MARVEL_CHARACTERS[character.toLowerCase()];
    if (!characterConfig) {
      return sendJson(response, {
        error: 'Invalid character',
        availableCharacters: Object.keys(MARVEL_CHARACTERS)
      }, 400);
    }

    // Generate unique ID
    const shortId = uuidv4();

    // Select villain if not specified
    const selectedVillain = villain || 
      characterConfig.commonVillains[Math.floor(Math.random() * characterConfig.commonVillains.length)];

    // Generate comic structure
    const comicData = await context.comicGenerator.generateComicShort({
      character: characterConfig.name,
      villain: selectedVillain,
      theme,
      duration,
      style
    });

    // Store comic data
    const comicKey = `comics/${shortId}/comic-data.json`;
    await storage.put(comicKey, JSON.stringify(comicData, null, 2), 'application/json');

    console.log(`✅ Created comic structure for ${character}`);

    sendJson(response, {
      shortId,
      character: characterConfig.name,
      villain: selectedVillain,
      theme,
      style,
      duration,
      panels: comicData.panels.length,
      textElements: comicData.textOverlays?.reduce((sum, overlay) => 
        sum + (overlay.elements?.length || 0), 0) || 0,
      createdAt: new Date().toISOString(),
      status: 'created',
      comicKey
    });

  } catch (error) {
    console.error('Comic creation failed:', error);
    sendJson(response, {
      error: 'Comic creation failed',
      message: error.message
    }, 500);
  }
}

/**
 * Render comic-style video
 */
export async function renderComicHandler(request, response, context) {
  try {
    const { shortId } = context.params;
    const body = await parseRequestBody(request);
    const { includeMusic = true, musicMood = null } = body;

    console.log(`🎬 Rendering comic video: ${shortId}`);

    // Load comic data
    const comicKey = `comics/${shortId}/comic-data.json`;
    const comicDataBuffer = await storage.get(comicKey);
    
    if (!comicDataBuffer) {
      return sendJson(response, {
        error: 'Comic not found',
        shortId
      }, 404);
    }

    const comicData = JSON.parse(comicDataBuffer.toString());

    // Generate music if requested
    let musicPath = null;
    if (includeMusic) {
      try {
        const characterConfig = Object.values(MARVEL_CHARACTERS)
          .find(char => char.name === comicData.character);
        
        const mood = musicMood || characterConfig?.musicMood || 'Dark / Cinematic';
        
        console.log(`🎵 Generating music for comic: ${mood}`);
        
        const musicResult = await context.musicService.getMusicForShort({
          mood,
          durationSeconds: comicData.duration,
          shortId,
          sceneContext: `${comicData.character} vs ${comicData.villain} comic story`
        });

        if (musicResult.track?.filePath) {
          musicPath = musicResult.track.filePath;
        }
        
      } catch (musicError) {
        console.warn('Music generation failed, continuing without music:', musicError.message);
      }
    }

    // Render comic video
    const renderResult = await context.comicRenderer.renderComicVideo(comicData, musicPath);

    // Store final video
    const videoKey = `comics/${shortId}/final-comic-${Date.now()}.mp4`;
    const videoBuffer = await import('node:fs/promises')
      .then(fs => fs.readFile(renderResult.videoPath));
    
    await storage.put(videoKey, videoBuffer, 'video/mp4');

    // Clean up temp files
    await context.comicRenderer.cleanup();

    console.log(`✅ Comic video rendered: ${shortId}`);

    sendJson(response, {
      shortId,
      video: {
        key: videoKey,
        format: 'mp4',
        width: 1080,
        height: 1920,
        duration: comicData.duration,
        style: 'comic',
        character: comicData.character,
        villain: comicData.villain,
        panels: comicData.panels.length,
        createdAt: new Date().toISOString()
      },
      music: musicPath ? {
        included: true,
        mood: musicMood || 'Dark / Cinematic'
      } : {
        included: false
      },
      renderTime: renderResult.generatedAt
    });

  } catch (error) {
    console.error('Comic rendering failed:', error);
    sendJson(response, {
      error: 'Comic rendering failed',
      message: error.message,
      shortId: context.params.shortId
    }, 500);
  }
}

/**
 * Get comic data
 */
export async function getComicHandler(request, response, context) {
  try {
    const { shortId } = context.params;
    
    const comicKey = `comics/${shortId}/comic-data.json`;
    const comicDataBuffer = await storage.get(comicKey);
    
    if (!comicDataBuffer) {
      return sendJson(response, {
        error: 'Comic not found',
        shortId
      }, 404);
    }

    const comicData = JSON.parse(comicDataBuffer.toString());

    sendJson(response, {
      shortId,
      ...comicData,
      stats: {
        panels: comicData.panels?.length || 0,
        textElements: comicData.textOverlays?.reduce((sum, overlay) => 
          sum + (overlay.elements?.length || 0), 0) || 0,
        character: comicData.character,
        villain: comicData.villain,
        duration: comicData.duration
      }
    });

  } catch (error) {
    console.error('Failed to get comic data:', error);
    sendJson(response, {
      error: 'Failed to get comic data',
      message: error.message
    }, 500);
  }
}

/**
 * List available Marvel characters
 */
export async function getComicCharactersHandler(request, response, context) {
  const characters = Object.entries(MARVEL_CHARACTERS).map(([key, config]) => ({
    id: key,
    name: config.name,
    alias: config.alias,
    powers: config.powers,
    commonVillains: config.commonVillains,
    settings: config.settings,
    musicMood: config.musicMood
  }));

  sendJson(response, {
    characters,
    total: characters.length,
    styles: ['CLASSIC', 'MODERN'],
    themes: ['action', 'mystery', 'origin', 'team-up', 'villain']
  });
}

/**
 * Generate comic story preview
 */
export async function previewComicHandler(request, response, context) {
  try {
    const body = await parseRequestBody(request);
    const {
      character = 'spider-man',
      villain = null,
      theme = 'action'
    } = body;

    const characterConfig = MARVEL_CHARACTERS[character.toLowerCase()];
    if (!characterConfig) {
      return sendJson(response, {
        error: 'Invalid character',
        availableCharacters: Object.keys(MARVEL_CHARACTERS)
      }, 400);
    }

    const selectedVillain = villain || 
      characterConfig.commonVillains[Math.floor(Math.random() * characterConfig.commonVillains.length)];

    // Generate just the story structure (no images)
    const storyStructure = await context.comicGenerator.generateStoryStructure({
      character: characterConfig.name,
      villain: selectedVillain,
      theme,
      duration: 24
    });

    sendJson(response, {
      character: characterConfig.name,
      villain: selectedVillain,
      theme,
      story: storyStructure,
      preview: true,
      estimatedRenderTime: '2-3 minutes'
    });

  } catch (error) {
    console.error('Story preview failed:', error);
    sendJson(response, {
      error: 'Story preview failed',
      message: error.message
    }, 500);
  }
}