/**
 * Marvel Comic-Style Video Renderer
 * 
 * Renders 3-panel comic book style videos with:
 * - Horizontal comic panel layout
 * - Comic-style text overlays (speech bubbles, sound effects)
 * - Marvel typography and styling
 * - Proper comic book timing and transitions
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { storage } from './storage.js';
import path from 'node:path';

const COMIC_VIDEO_CONFIG = {
  width: 1080,
  height: 1920, // 9:16 for vertical video
  panelHeight: 640, // Each panel is 1/3 height
  fps: 30,
  bitrate: '2M',
  format: 'mp4'
};

const COMIC_TEXT_STYLES = {
  speech: {
    fontFamily: 'Comic Sans MS',
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000000',
    backgroundColor: '#FFFFFF',
    borderColor: '#000000',
    borderWidth: 3,
    padding: 15,
    bubbleShape: 'rounded'
  },
  thought: {
    fontFamily: 'Comic Sans MS', 
    fontSize: 28,
    fontWeight: 'normal',
    color: '#000000',
    backgroundColor: '#F0F0F0',
    borderColor: '#666666',
    borderWidth: 2,
    padding: 12,
    bubbleShape: 'cloud'
  },
  soundEffect: {
    fontFamily: 'Impact',
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 4,
    shadow: true,
    shadowColor: '#000000',
    shadowOffset: { x: 3, y: 3 }
  },
  narration: {
    fontFamily: 'Times New Roman',
    fontSize: 24,
    fontWeight: 'normal',
    fontStyle: 'italic',
    color: '#FFFFFF',
    backgroundColor: '#000000',
    padding: 10,
    boxShape: 'rectangle'
  },
  character: {
    fontFamily: 'Arial Black',
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    backgroundColor: '#FF0000',
    padding: 8,
    boxShape: 'rectangle'
  }
};

export class ComicRenderer {
  constructor() {
    this.tempDir = './storage/temp/comic-render';
    this.ensureTempDirectory();
  }

  ensureTempDirectory() {
    if (!existsSync(this.tempDir)) {
      mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Render complete comic-style video
   */
  async renderComicVideo(comicData, musicPath = null) {
    console.log(`🎬 Rendering Marvel comic video: ${comicData.character}`);
    
    try {
      // Step 1: Prepare panel images
      const panelImages = await this.preparePanelImages(comicData.panels);
      
      // Step 2: Create panel layout video
      const layoutVideo = await this.createPanelLayout(panelImages, comicData);
      
      // Step 3: Add text overlays
      const textVideo = await this.addTextOverlays(layoutVideo, comicData.textOverlays);
      
      // Step 4: Add comic-style effects
      const effectsVideo = await this.addComicEffects(textVideo, comicData);
      
      // Step 5: Add music and final processing
      const finalVideo = await this.addMusicAndFinalize(effectsVideo, musicPath, comicData);
      
      return {
        type: 'comic',
        videoPath: finalVideo,
        character: comicData.character,
        duration: comicData.duration,
        panels: comicData.panels.length,
        style: comicData.style,
        generatedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Comic video rendering failed:', error);
      throw new Error(`Comic rendering failed: ${error.message}`);
    }
  }

  /**
   * Prepare panel images (download and resize)
   */
  async preparePanelImages(panels) {
    console.log('📐 Preparing comic panel images...');
    
    const panelImages = [];
    
    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i];
      const panelPath = path.join(this.tempDir, `panel_${i + 1}.jpg`);
      
      if (panel.imageUrl && !panel.placeholder) {
        // Download panel image
        await this.downloadPanelImage(panel.imageUrl, panelPath);
      } else {
        // Create placeholder panel
        await this.createPlaceholderPanel(panelPath, panel, i);
      }
      
      // Resize to panel dimensions
      const resizedPath = await this.resizePanelImage(panelPath, i);
      panelImages.push(resizedPath);
    }
    
    return panelImages;
  }

  async downloadPanelImage(imageUrl, outputPath) {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      await import('node:fs/promises').then(fs => 
        fs.writeFile(outputPath, Buffer.from(buffer))
      );
      
      console.log(`✅ Downloaded panel image: ${path.basename(outputPath)}`);
    } catch (error) {
      console.warn(`⚠️ Failed to download panel image, creating placeholder`);
      await this.createPlaceholderPanel(outputPath, { scene: 'Marvel Action' }, 0);
    }
  }

  async createPlaceholderPanel(outputPath, panel, panelIndex) {
    // Create a colorful placeholder panel using FFmpeg
    const colors = ['#FF0000', '#0066CC', '#FFDD00']; // Marvel colors
    const color = colors[panelIndex % colors.length];
    
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-f', 'lavfi',
        '-i', `color=${color}:size=${COMIC_VIDEO_CONFIG.width}x${COMIC_VIDEO_CONFIG.panelHeight}:duration=1`,
        '-vf', `drawtext=text='${panel.scene?.substring(0, 30) || 'Marvel Panel'}':fontsize=36:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2`,
        '-frames:v', '1',
        outputPath
      ]);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ Created placeholder panel: ${path.basename(outputPath)}`);
          resolve(outputPath);
        } else {
          reject(new Error(`FFmpeg placeholder creation failed with code ${code}`));
        }
      });
      
      ffmpeg.on('error', reject);
    });
  }

  async resizePanelImage(inputPath, panelIndex) {
    const resizedPath = path.join(this.tempDir, `panel_${panelIndex + 1}_resized.jpg`);
    
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', inputPath,
        '-vf', `scale=${COMIC_VIDEO_CONFIG.width}:${COMIC_VIDEO_CONFIG.panelHeight}:force_original_aspect_ratio=decrease,pad=${COMIC_VIDEO_CONFIG.width}:${COMIC_VIDEO_CONFIG.panelHeight}:(ow-iw)/2:(oh-ih)/2:black`,
        '-q:v', '2', // High quality
        resizedPath
      ]);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(resizedPath);
        } else {
          reject(new Error(`Panel resize failed with code ${code}`));
        }
      });
      
      ffmpeg.on('error', reject);
    });
  }

  /**
   * Create the 3-panel vertical layout
   */
  async createPanelLayout(panelImages, comicData) {
    console.log('🎨 Creating comic panel layout...');
    
    const layoutPath = path.join(this.tempDir, 'comic_layout.mp4');
    const panelDuration = comicData.duration / 3; // 8 seconds each
    
    // Create filter complex for 3 horizontal panels stacked vertically
    const filterComplex = `
      [0:v]scale=${COMIC_VIDEO_CONFIG.width}:${COMIC_VIDEO_CONFIG.panelHeight},setpts=PTS-STARTPTS[panel1];
      [1:v]scale=${COMIC_VIDEO_CONFIG.width}:${COMIC_VIDEO_CONFIG.panelHeight},setpts=PTS-STARTPTS[panel2];
      [2:v]scale=${COMIC_VIDEO_CONFIG.width}:${COMIC_VIDEO_CONFIG.panelHeight},setpts=PTS-STARTPTS[panel3];
      
      color=black:${COMIC_VIDEO_CONFIG.width}x${COMIC_VIDEO_CONFIG.height}:d=${comicData.duration}[bg];
      
      [bg][panel1]overlay=0:0:enable='between(t,0,${panelDuration})'[temp1];
      [temp1][panel2]overlay=0:${COMIC_VIDEO_CONFIG.panelHeight}:enable='between(t,${panelDuration},${panelDuration * 2})'[temp2];
      [temp2][panel3]overlay=0:${COMIC_VIDEO_CONFIG.panelHeight * 2}:enable='between(t,${panelDuration * 2},${panelDuration * 3})'[out]
    `.replace(/\s+/g, ' ').trim();
    
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-loop', '1', '-t', panelDuration.toString(), '-i', panelImages[0],
        '-loop', '1', '-t', panelDuration.toString(), '-i', panelImages[1], 
        '-loop', '1', '-t', panelDuration.toString(), '-i', panelImages[2],
        '-filter_complex', filterComplex,
        '-map', '[out]',
        '-c:v', 'libx264',
        '-r', COMIC_VIDEO_CONFIG.fps.toString(),
        '-pix_fmt', 'yuv420p',
        layoutPath
      ]);
      
      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Created comic panel layout');
          resolve(layoutPath);
        } else {
          console.error('FFmpeg stderr:', stderr);
          reject(new Error(`Panel layout creation failed with code ${code}`));
        }
      });
      
      ffmpeg.on('error', reject);
    });
  }

  /**
   * Add comic-style text overlays
   */
  async addTextOverlays(videoPath, textOverlays) {
    console.log('💬 Adding comic text overlays...');
    
    const textVideoPath = path.join(this.tempDir, 'comic_with_text.mp4');
    
    // Build drawtext filters for all text elements
    const textFilters = [];
    const panelDuration = 8; // seconds per panel
    
    textOverlays.forEach((overlay, panelIndex) => {
      const startTime = panelIndex * panelDuration;
      const endTime = (panelIndex + 1) * panelDuration;
      const panelOffset = panelIndex * COMIC_VIDEO_CONFIG.panelHeight;
      
      overlay.elements.forEach((element, elementIndex) => {
        const filter = this.createTextFilter(element, startTime, endTime, panelOffset);
        if (filter) {
          textFilters.push(filter);
        }
      });
    });
    
    if (textFilters.length === 0) {
      console.log('⚠️ No text overlays to add, using original video');
      return videoPath;
    }
    
    const drawTextFilter = textFilters.join(',');
    
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', videoPath,
        '-vf', drawTextFilter,
        '-c:v', 'libx264',
        '-c:a', 'copy', // Preserve audio if present
        textVideoPath
      ]);
      
      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Added comic text overlays');
          resolve(textVideoPath);
        } else {
          console.error('Text overlay FFmpeg stderr:', stderr);
          reject(new Error(`Text overlay failed with code ${code}`));
        }
      });
      
      ffmpeg.on('error', reject);
    });
  }

  createTextFilter(element, startTime, endTime, panelOffset) {
    const style = COMIC_TEXT_STYLES[element.type] || COMIC_TEXT_STYLES.speech;
    
    // Calculate position within the panel
    const x = element.position?.x || 100;
    const y = (element.position?.y || 100) + panelOffset;
    
    // Escape text for FFmpeg
    const escapedText = element.text.replace(/'/g, "\\'").replace(/:/g, "\\:");
    
    let filter = `drawtext=text='${escapedText}'`;
    filter += `:fontfile=/System/Library/Fonts/Arial.ttf`; // macOS system font
    filter += `:fontsize=${style.fontSize}`;
    filter += `:fontcolor=${style.color}`;
    filter += `:x=${x}:y=${y}`;
    filter += `:enable='between(t,${startTime},${endTime})'`;
    
    // Add background box for speech bubbles and narration
    if (element.type === 'speech' || element.type === 'narration') {
      filter += `:box=1:boxcolor=${style.backgroundColor}@0.8`;
      filter += `:boxborderw=${style.padding || 10}`;
    }
    
    // Add shadow for sound effects
    if (element.type === 'sound' && style.shadow) {
      filter += `:shadowcolor=${style.shadowColor}`;
      filter += `:shadowx=${style.shadowOffset?.x || 2}`;
      filter += `:shadowy=${style.shadowOffset?.y || 2}`;
    }
    
    return filter;
  }

  /**
   * Add comic-style visual effects
   */
  async addComicEffects(videoPath, comicData) {
    console.log('✨ Adding comic visual effects...');
    
    const effectsVideoPath = path.join(this.tempDir, 'comic_with_effects.mp4');
    
    // Add comic-style effects: panel borders, color enhancement
    const effectsFilter = [
      // Enhanced colors and contrast for comic look
      'eq=contrast=1.2:brightness=0.05:saturation=1.3',
      
      // Add subtle comic book style filter
      'unsharp=5:5:1.0:5:5:0.0',
      
      // Panel borders (drawn as rectangles)
      `drawbox=x=0:y=0:w=${COMIC_VIDEO_CONFIG.width}:h=${COMIC_VIDEO_CONFIG.panelHeight}:color=black@0.8:t=8`,
      `drawbox=x=0:y=${COMIC_VIDEO_CONFIG.panelHeight}:w=${COMIC_VIDEO_CONFIG.width}:h=${COMIC_VIDEO_CONFIG.panelHeight}:color=black@0.8:t=8`,
      `drawbox=x=0:y=${COMIC_VIDEO_CONFIG.panelHeight * 2}:w=${COMIC_VIDEO_CONFIG.width}:h=${COMIC_VIDEO_CONFIG.panelHeight}:color=black@0.8:t=8`
    ].join(',');
    
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', videoPath,
        '-vf', effectsFilter,
        '-c:v', 'libx264',
        '-c:a', 'copy',
        effectsVideoPath
      ]);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Added comic visual effects');
          resolve(effectsVideoPath);
        } else {
          reject(new Error(`Comic effects failed with code ${code}`));
        }
      });
      
      ffmpeg.on('error', reject);
    });
  }

  /**
   * Add music and create final video
   */
  async addMusicAndFinalize(videoPath, musicPath, comicData) {
    console.log('🎵 Adding music and finalizing comic video...');
    
    const finalPath = path.join(this.tempDir, `comic_${Date.now()}.mp4`);
    
    const ffmpegArgs = [
      '-y',
      '-i', videoPath
    ];
    
    let filterComplex = '';
    let audioMap = '';
    
    if (musicPath && existsSync(musicPath)) {
      // Add music input
      ffmpegArgs.push('-i', musicPath);
      
      // Mix audio (video might not have audio initially)
      filterComplex = `[1:a]volume=0.7,aloop=loop=-1:size=2e+09[music];[music]atrim=duration=${comicData.duration}[audio]`;
      audioMap = '[audio]';
      
      ffmpegArgs.push('-filter_complex', filterComplex);
      ffmpegArgs.push('-map', '0:v');
      ffmpegArgs.push('-map', audioMap);
    } else {
      console.log('⚠️ No music provided, creating video without audio');
    }
    
    // Final encoding settings
    ffmpegArgs.push(
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
      '-maxrate', COMIC_VIDEO_CONFIG.bitrate,
      '-bufsize', '4M',
      '-pix_fmt', 'yuv420p',
      '-r', COMIC_VIDEO_CONFIG.fps.toString(),
      finalPath
    );
    
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      
      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Comic video finalized successfully');
          resolve(finalPath);
        } else {
          console.error('Final encoding FFmpeg stderr:', stderr);
          reject(new Error(`Final encoding failed with code ${code}`));
        }
      });
      
      ffmpeg.on('error', reject);
    });
  }

  /**
   * Clean up temporary files
   */
  async cleanup() {
    try {
      const { unlink, readdir } = await import('node:fs/promises');
      
      const files = await readdir(this.tempDir);
      for (const file of files) {
        if (file.includes('comic_') || file.includes('panel_')) {
          await unlink(path.join(this.tempDir, file));
        }
      }
      
      console.log('🧹 Cleaned up comic rendering temp files');
    } catch (error) {
      console.warn('⚠️ Failed to cleanup temp files:', error.message);
    }
  }
}