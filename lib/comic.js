/**
 * Marvel Comic-Style Shorts Generator
 * 
 * Creates authentic Marvel comic book style video shorts with:
 * - 3 horizontal comic panels 
 * - Speech bubbles, thought bubbles, sound effects
 * - Marvel typography and styling
 * - Character-appropriate dialogue and actions
 */

import { storage } from './storage.js';
import path from 'node:path';

// Marvel comic style configuration
const COMIC_STYLES = {
  CLASSIC: {
    panelBorder: {
      width: 8,
      color: '#000000',
      style: 'solid'
    },
    background: {
      color: '#FFFFFF',
      texture: 'paper'
    },
    typography: {
      dialogue: { font: 'Comic Sans MS', size: 24, weight: 'bold' },
      narration: { font: 'Times New Roman', size: 22, style: 'italic' },
      soundEffect: { font: 'Impact', size: 36, weight: 'bold' },
      character: { font: 'Arial Black', size: 20, weight: 'bold' }
    },
    colors: {
      primary: '#FF0000',    // Marvel Red
      secondary: '#0066CC',  // Marvel Blue  
      accent: '#FFDD00',     // Marvel Yellow
      text: '#000000',
      bubble: '#FFFFFF'
    }
  },
  MODERN: {
    panelBorder: {
      width: 6,
      color: '#333333',
      style: 'solid'
    },
    background: {
      color: '#F8F8F8',
      texture: 'clean'
    },
    typography: {
      dialogue: { font: 'Arial', size: 22, weight: 'bold' },
      narration: { font: 'Georgia', size: 20, style: 'italic' },
      soundEffect: { font: 'Impact', size: 32, weight: 'bold' },
      character: { font: 'Helvetica Bold', size: 18, weight: 'bold' }
    },
    colors: {
      primary: '#E23636',
      secondary: '#1E88E5',
      accent: '#FFC107',
      text: '#212121',
      bubble: '#FFFFFF'
    }
  }
};

// Comic text element types
const TEXT_ELEMENTS = {
  SPEECH_BUBBLE: 'speech',
  THOUGHT_BUBBLE: 'thought', 
  NARRATION_BOX: 'narration',
  SOUND_EFFECT: 'sound',
  CHARACTER_NAME: 'character',
  LOCATION_CAPTION: 'location'
};

// Marvel sound effects library
const MARVEL_SOUND_EFFECTS = {
  // Spider-Man
  spiderman: ['THWIP!', 'THWAP!', 'SPLAT!', 'WHOOSH!'],
  
  // Iron Man
  ironman: ['REPULSOR BLAST!', 'CLANG!', 'WHIRRRR!', 'BOOM!'],
  
  // Captain America  
  captainamerica: ['CLANG!', 'THUD!', 'WHOOSH!', 'IMPACT!'],
  
  // Thor
  thor: ['CRACK-A-BOOM!', 'LIGHTNING!', 'CRASH!', 'THUNDER!'],
  
  // Hulk
  hulk: ['SMASH!', 'CRASH!', 'THOOM!', 'GRRRR!'],
  
  // Generic action
  action: ['BAM!', 'POW!', 'WHAM!', 'CRASH!', 'BOOM!', 'THUD!'],
  
  // Villains
  villain: ['MWAHAHAHA!', 'DOOM!', 'CRUSH!', 'DESTROY!']
};

export class ComicGenerator {
  constructor() {
    this.style = COMIC_STYLES.CLASSIC;
  }

  /**
   * Generate a complete Marvel comic-style short
   */
  async generateComicShort({
    character,
    villain = null,
    theme = 'action',
    duration = 24,
    style = 'CLASSIC'
  }) {
    this.style = COMIC_STYLES[style];
    
    console.log(`🎨 Generating Marvel comic short: ${character} vs ${villain || 'Unknown threat'}`);
    
    // Step 1: Generate comic story structure
    const storyStructure = await this.generateStoryStructure({
      character,
      villain,
      theme,
      duration
    });
    
    // Step 2: Generate comic panels
    const panels = await Promise.all(
      storyStructure.panels.map(async (panelData, index) => {
        return await this.generateComicPanel(panelData, index);
      })
    );
    
    // Step 3: Generate text overlays for each panel
    const textOverlays = await Promise.all(
      panels.map(async (panel, index) => {
        return await this.generatePanelText(panel, storyStructure.panels[index]);
      })
    );
    
    return {
      type: 'comic',
      character,
      villain,
      theme,
      duration,
      style,
      storyStructure,
      panels,
      textOverlays,
      metadata: {
        generatedAt: new Date().toISOString(),
        panelCount: panels.length,
        totalTextElements: textOverlays.reduce((sum, overlay) => sum + overlay.elements.length, 0)
      }
    };
  }

  /**
   * Generate the 3-panel comic story structure
   */
  async generateStoryStructure({ character, villain, theme, duration }) {
    // Use the main system's OpenRouter integration instead of separate AI service
    // This will be handled by the main shorts generation system
    
    // Return a basic structure that the main system can enhance
    return {
      character,
      villain,
      theme,
      panels: [
        {
          id: 'panel_1',
          type: 'setup',
          duration: 8,
          scene: `${character} discovers trouble brewing in the city`,
          mood: 'introduction',
          action_level: 30
        },
        {
          id: 'panel_2', 
          type: 'conflict',
          duration: 8,
          scene: `${character} confronts ${villain || 'the threat'} in epic battle`,
          mood: 'action',
          action_level: 90
        },
        {
          id: 'panel_3',
          type: 'resolution',
          duration: 8, 
          scene: `${character} emerges victorious but hints at future challenges`,
          mood: 'conclusion',
          action_level: 60
        }
      ],
      overallArc: `${character} faces ${villain || 'a new threat'} and uses their powers to save the day`,
      comicTitle: `${character} vs ${villain || 'Evil'}`
    };
  }

  createStoryPrompt(character, villain, theme) {
    return `Create a 3-panel Marvel comic story featuring ${character}${villain ? ` vs ${villain}` : ''}.

REQUIREMENTS:
- Theme: ${theme}
- Each panel is 8 seconds of video
- Classic Marvel comic book storytelling
- Panel 1: Setup/Introduction 
- Panel 2: Main action/conflict
- Panel 3: Resolution/cliffhanger

RESPONSE FORMAT:
{
  "title": "Comic Story Title",
  "arc": "Overall story description",
  "panel1": {
    "scene": "Detailed scene description",
    "action": "What's happening", 
    "dialogue": "Character dialogue",
    "soundEffect": "Comic sound effect",
    "mood": "Panel mood"
  },
  "panel2": {
    "scene": "Action scene description",
    "action": "Main conflict/fight",
    "dialogue": "Action dialogue", 
    "soundEffect": "Action sound effect",
    "mood": "Intense action mood"
  },
  "panel3": {
    "scene": "Resolution scene",
    "action": "How it ends",
    "dialogue": "Concluding dialogue",
    "soundEffect": "Final sound effect", 
    "mood": "Resolution mood"
  }
}

Make it authentic Marvel storytelling with proper character voice and comic book pacing.`;
  }

  parseStoryStructure(aiResponse, character, villain, theme) {
    try {
      // Try to parse JSON response
      const parsed = JSON.parse(aiResponse);
      return parsed;
    } catch (error) {
      console.warn('Failed to parse AI story structure, using template');
      
      // Fallback template
      return {
        title: `${character} Adventure`,
        arc: `${character} faces a new challenge and must use their powers to save the day.`,
        panel1: {
          scene: `${character} discovers trouble brewing in the city`,
          action: 'Investigation and discovery',
          dialogue: `"Something's not right here..."`,
          soundEffect: 'WHOOSH!',
          mood: 'mysterious'
        },
        panel2: {
          scene: `${character} confronts ${villain || 'the threat'} in epic battle`,
          action: 'Intense superhero combat',
          dialogue: `"It's time to end this!"`,
          soundEffect: 'BAM!',
          mood: 'action-packed'
        },
        panel3: {
          scene: `${character} emerges victorious but hints at future challenges`,
          action: 'Victory with lingering questions',
          dialogue: `"This isn't over..."`,
          soundEffect: 'THUD!',
          mood: 'triumphant'
        }
      };
    }
  }

  /**
   * Generate comic panel visual - integrates with main OpenRouter system
   */
  async generateComicPanel(panelData, panelIndex) {
    console.log(`🎨 Comic panel ${panelIndex + 1} prepared: ${panelData.scene.substring(0, 50)}...`);
    
    // Return panel data that can be used by the main image generation system
    return {
      id: panelData.id,
      index: panelIndex,
      imageUrl: null, // Will be generated by main system
      imageKey: null,  // Will be set by main system
      scene: panelData.scene,
      action: panelData.action,
      mood: panelData.mood,
      duration: panelData.duration,
      actionLevel: panelData.action_level,
      // Provide image prompt for main system to use
      imagePrompt: this.createPanelImagePrompt(panelData, panelIndex)
    };
  }

  createPanelImagePrompt(panelData, panelIndex) {
    const panelType = panelIndex === 0 ? 'establishing' : 
                     panelIndex === 1 ? 'action' : 'resolution';
    
    return `Marvel comic book panel artwork in classic comic style.
    
SCENE: ${panelData.scene}
ACTION: ${panelData.action}
MOOD: ${panelData.mood}
PANEL TYPE: ${panelType}

COMIC STYLE REQUIREMENTS:
- Bold, clean comic book art style like classic Marvel comics
- Strong black outline artwork
- Vibrant superhero colors
- Dynamic composition and perspective
- Comic book shading and highlights
- No speech bubbles or text overlays (text added separately)
- Horizontal panel format (16:9 aspect ratio)
- High contrast and bold visual impact
- Authentic Marvel comic book aesthetic

The art should look like it's from a professional Marvel comic book page.`;
  }

  /**
   * Generate comic text overlays for a panel
   */
  async generatePanelText(panel, panelData) {
    const elements = [];
    
    // Add character dialogue if present
    if (panelData.dialogue) {
      elements.push({
        type: TEXT_ELEMENTS.SPEECH_BUBBLE,
        text: panelData.dialogue,
        position: this.calculateBubblePosition(panel, 'speech'),
        style: this.style.typography.dialogue,
        bubbleStyle: 'speech'
      });
    }
    
    // Add sound effect
    if (panelData.soundEffect) {
      elements.push({
        type: TEXT_ELEMENTS.SOUND_EFFECT,
        text: panelData.soundEffect,
        position: this.calculateEffectPosition(panel),
        style: {
          ...this.style.typography.soundEffect,
          color: this.getSoundEffectColor(panelData.soundEffect),
          stroke: '#000000',
          strokeWidth: 2
        }
      });
    }
    
    // Add narration box for setup
    if (panel.index === 0) {
      elements.push({
        type: TEXT_ELEMENTS.NARRATION_BOX,
        text: `Meanwhile in ${this.getLocationFromScene(panelData.scene)}...`,
        position: { x: 50, y: 50 },
        style: this.style.typography.narration,
        boxStyle: 'narration'
      });
    }
    
    return {
      panelId: panel.id,
      panelIndex: panel.index,
      elements
    };
  }

  calculateBubblePosition(panel, bubbleType) {
    // Calculate optimal speech bubble placement
    const basePositions = {
      speech: { x: 200, y: 150 },
      thought: { x: 300, y: 100 }
    };
    
    // Add some variation based on panel index
    const variation = panel.index * 50;
    
    return {
      x: basePositions[bubbleType].x + variation,
      y: basePositions[bubbleType].y + (panel.index % 2) * 100
    };
  }

  calculateEffectPosition(panel) {
    // Sound effects typically go in action areas
    const actionPositions = [
      { x: 150, y: 200 }, // Panel 1
      { x: 400, y: 250 }, // Panel 2 (action)
      { x: 250, y: 180 }  // Panel 3
    ];
    
    return actionPositions[panel.index] || actionPositions[1];
  }

  getSoundEffectColor(soundEffect) {
    // Color code sound effects
    if (soundEffect.includes('BOOM') || soundEffect.includes('EXPLOSION')) return '#FF4444';
    if (soundEffect.includes('THWIP') || soundEffect.includes('WEB')) return '#0066CC';
    if (soundEffect.includes('CLANG') || soundEffect.includes('METAL')) return '#888888';
    if (soundEffect.includes('CRACK') || soundEffect.includes('LIGHTNING')) return '#FFFF00';
    
    return this.style.colors.accent;
  }

  getLocationFromScene(scene) {
    // Extract location context from scene description
    const locationKeywords = {
      'city': 'New York City',
      'building': 'Manhattan', 
      'street': 'the Streets',
      'sky': 'the Skies Above',
      'lab': 'the Laboratory',
      'school': 'Midtown High',
      'office': 'the Daily Bugle'
    };
    
    const sceneLower = scene.toLowerCase();
    for (const [keyword, location] of Object.entries(locationKeywords)) {
      if (sceneLower.includes(keyword)) {
        return location;
      }
    }
    
    return 'New York City';
  }

  /**
   * Get appropriate sound effects for a character
   */
  getCharacterSoundEffects(character) {
    const charLower = character.toLowerCase().replace(/\s+/g, '');
    
    if (charLower.includes('spider') || charLower.includes('spiderman')) {
      return MARVEL_SOUND_EFFECTS.spiderman;
    }
    if (charLower.includes('iron') || charLower.includes('stark')) {
      return MARVEL_SOUND_EFFECTS.ironman;
    }
    if (charLower.includes('captain') || charLower.includes('america')) {
      return MARVEL_SOUND_EFFECTS.captainamerica;
    }
    if (charLower.includes('thor')) {
      return MARVEL_SOUND_EFFECTS.thor;
    }
    if (charLower.includes('hulk')) {
      return MARVEL_SOUND_EFFECTS.hulk;
    }
    if (charLower.includes('doom')) {
      return MARVEL_SOUND_EFFECTS.villain;
    }
    
    return MARVEL_SOUND_EFFECTS.action;
  }

  /**
   * Validate comic data structure
   */
  validateComicStructure(comicData) {
    const required = ['panels', 'textOverlays', 'character', 'style'];
    
    for (const field of required) {
      if (!comicData[field]) {
        throw new Error(`Comic structure missing required field: ${field}`);
      }
    }
    
    if (!Array.isArray(comicData.panels) || comicData.panels.length !== 3) {
      throw new Error('Comic must have exactly 3 panels');
    }
    
    if (!Array.isArray(comicData.textOverlays) || comicData.textOverlays.length !== 3) {
      throw new Error('Comic must have text overlays for all 3 panels');
    }
    
    return true;
  }

  /**
   * Get comic generation statistics
   */
  getGenerationStats(comicData) {
    return {
      panelCount: comicData.panels?.length || 0,
      textElementCount: comicData.textOverlays?.reduce((sum, overlay) => 
        sum + (overlay.elements?.length || 0), 0) || 0,
      character: comicData.character,
      villain: comicData.villain,
      style: comicData.style,
      duration: comicData.duration,
      generatedAt: comicData.metadata?.generatedAt
    };
  }
}

// Export for use in other modules
export { COMIC_STYLES, TEXT_ELEMENTS, MARVEL_SOUND_EFFECTS };