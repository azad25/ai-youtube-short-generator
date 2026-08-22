/**
 * Marvel Comic-Style Shorts API
 * 
 * Endpoints for generating comic book style Marvel video shorts with:
 * - 3-panel horizontal comic layout
 * - Speech bubbles, sound effects, comic typography
 * - Character-specific storylines
 * - Marvel-authentic visual style
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ComicGenerator } from '../lib/comic.js';
import { ComicRenderer } from '../lib/comic-renderer.js';
import { MusicService } from '../lib/music.js';
import { storage } from '../lib/storage.js';

const router = express.Router();
const comicGenerator = new ComicGenerator();
const comicRenderer = new ComicRenderer();
const musicService = new MusicService();

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
 * Create a new comic-style short
 * POST /api/comic-shorts/create
 */
router.post('/create', async (req, res) => {
  try {
    const {
      character = 'spider-man',
      villain = null,
      theme = 'action',
      style = 'CLASSIC',
      duration = 24,
      includeMusic = true
    } = req.body;

    console.log(`🎨 Creating comic short: ${character} ${villain ? `vs ${villain}` : 'adventure'}`);

    // Validate character
    const characterConfig = MARVEL_CHARACTERS[character.toLowerCase()];
    if (!characterConfig) {
      return res.status(400).json({
        error: 'Invalid character',
        availableCharacters: Object.keys(MARVEL_CHARACTERS)
      });
    }

    // Generate unique ID
    const shortId = uuidv4();

    // Select villain if not specified
    const selectedVillain = villain || 
      characterConfig.commonVillains[Math.floor(Math.random() * characterConfig.commonVillains.length)];

    // Generate comic structure
    const comicData = await comicGenerator.generateComicShort({
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

    res.json({
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
    res.status(500).json({
      error: 'Comic creation failed',
      message: error.message
    });
  }
});

/**
 * Render comic-style video
 * POST /api/comic-shorts/:shortId/render
 */
router.post('/:shortId/render', async (req, res) => {
  try {
    const { shortId } = req.params;
    const { includeMusic = true, musicMood = null } = req.body;

    console.log(`🎬 Rendering comic video: ${shortId}`);

    // Load comic data
    const comicKey = `comics/${shortId}/comic-data.json`;
    const comicDataBuffer = await storage.get(comicKey);
    
    if (!comicDataBuffer) {
      return res.status(404).json({
        error: 'Comic not found',
        shortId
      });
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
        
        const musicResult = await musicService.getMusicForShort({
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
    const renderResult = await comicRenderer.renderComicVideo(comicData, musicPath);

    // Store final video
    const videoKey = `comics/${shortId}/final-comic-${Date.now()}.mp4`;
    const videoBuffer = await import('node:fs/promises')
      .then(fs => fs.readFile(renderResult.videoPath));
    
    await storage.put(videoKey, videoBuffer, 'video/mp4');

    // Clean up temp files
    await comicRenderer.cleanup();

    console.log(`✅ Comic video rendered: ${shortId}`);

    res.json({
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
    res.status(500).json({
      error: 'Comic rendering failed',
      message: error.message,
      shortId: req.params.shortId
    });
  }
});

/**
 * Get comic data
 * GET /api/comic-shorts/:shortId
 */
router.get('/:shortId', async (req, res) => {
  try {
    const { shortId } = req.params;
    
    const comicKey = `comics/${shortId}/comic-data.json`;
    const comicDataBuffer = await storage.get(comicKey);
    
    if (!comicDataBuffer) {
      return res.status(404).json({
        error: 'Comic not found',
        shortId
      });
    }

    const comicData = JSON.parse(comicDataBuffer.toString());

    res.json({
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
    res.status(500).json({
      error: 'Failed to get comic data',
      message: error.message
    });
  }
});

/**
 * List available Marvel characters
 * GET /api/comic-shorts/characters
 */
router.get('/characters', (req, res) => {
  const characters = Object.entries(MARVEL_CHARACTERS).map(([key, config]) => ({
    id: key,
    name: config.name,
    alias: config.alias,
    powers: config.powers,
    commonVillains: config.commonVillains,
    settings: config.settings,
    musicMood: config.musicMood
  }));

  res.json({
    characters,
    total: characters.length,
    styles: ['CLASSIC', 'MODERN'],
    themes: ['action', 'mystery', 'origin', 'team-up', 'villain']
  });
});

/**
 * Generate comic story preview
 * POST /api/comic-shorts/preview
 */
router.post('/preview', async (req, res) => {
  try {
    const {
      character = 'spider-man',
      villain = null,
      theme = 'action'
    } = req.body;

    const characterConfig = MARVEL_CHARACTERS[character.toLowerCase()];
    if (!characterConfig) {
      return res.status(400).json({
        error: 'Invalid character',
        availableCharacters: Object.keys(MARVEL_CHARACTERS)
      });
    }

    const selectedVillain = villain || 
      characterConfig.commonVillains[Math.floor(Math.random() * characterConfig.commonVillains.length)];

    // Generate just the story structure (no images)
    const storyStructure = await comicGenerator.generateStoryStructure({
      character: characterConfig.name,
      villain: selectedVillain,
      theme,
      duration: 24
    });

    res.json({
      character: characterConfig.name,
      villain: selectedVillain,
      theme,
      story: storyStructure,
      preview: true,
      estimatedRenderTime: '2-3 minutes'
    });

  } catch (error) {
    console.error('Story preview failed:', error);
    res.status(500).json({
      error: 'Story preview failed',
      message: error.message
    });
  }
});

export default router;