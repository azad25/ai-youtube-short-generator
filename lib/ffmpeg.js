export function buildRenderArgs({
  imagePaths,
  audioPath = null,
  musicPath = null,
  outputPath,
  scenes = [],
  scriptData = {},
  width = 1440,
  height = 2560,
  fps = 30,
}) {
  const SCENE_COUNT = imagePaths.length;
  const SCENE_DURATION = 8; // Fixed 8 seconds per scene for better pacing
  const TOTAL_DURATION = SCENE_COUNT * SCENE_DURATION; // Total duration based on scene count

  console.log(`🎬 WORKING VERSION: ${SCENE_COUNT} images, ${SCENE_DURATION}s each = ${TOTAL_DURATION}s total`);

  if (!Array.isArray(imagePaths) || imagePaths.length === 0) {
    throw new Error('At least 1 image required');
  }

  const args = ["-y"];

  // Add each image as input
  for (let i = 0; i < SCENE_COUNT; i++) {
    args.push("-loop", "1", "-t", SCENE_DURATION.toString(), "-i", imagePaths[i]);
  }

  // Add audio input - either music or silent audio
  if (musicPath && typeof musicPath === 'string' && musicPath.trim()) {
    // Add music file as audio input - will be trimmed to exact duration
    console.log(`🎵 Adding music input: ${musicPath}`);
    args.push('-i', musicPath);
  } else {
    // Add silent audio with matching duration as fallback
    console.log(`🔇 No music provided, using silent audio`);
    args.push('-f', 'lavfi', '-i', `anullsrc=channel_layout=stereo:sample_rate=44100:duration=${TOTAL_DURATION}`);
  }

  // WORKING APPROACH: Simple concat with multi-line text
  let filterComplex = '';
  
  // Process each input: scale + story text
  for (let i = 0; i < SCENE_COUNT; i++) {
    if (i > 0) filterComplex += ';';
    
    filterComplex += `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
    
    // Add story text with comic book narrative  
    let storyText = '';
    const scene = scenes[i];
    
    // Try to get meaningful comic book story content
    // Try to get meaningful comic book story content
    // Priority 1: Parse narration from scriptData if available
    if (scriptData && scriptData.narration) {
      try {
        // If narration is a JSON string, parse it
        let narrationData = scriptData.narration;
        if (typeof narrationData === 'string') {
          try {
            narrationData = JSON.parse(narrationData);
          } catch (parseError) {
            // If JSON parsing fails, treat as regular text and split into sentences
            const sentences = narrationData.split(/[.!?]+/).filter(s => s.trim().length > 0);
            if (sentences[i] && sentences[i].trim().length > 0) {
              storyText = sentences[i].trim() + '.';
            }
          }
        }
        
        // Extract story text for this scene from parsed narration
        if (narrationData && typeof narrationData === 'object' && narrationData.scenes) {
          const narrativeScene = narrationData.scenes.find(s => s.scene_number === (i + 1)) || narrationData.scenes[i];
          if (narrativeScene) {
            // Use dialogue first, then caption, then other fields
            if (narrativeScene.dialogue) {
              storyText = narrativeScene.dialogue;
            } else if (narrativeScene.caption) {
              storyText = narrativeScene.caption;
            } else if (narrativeScene.panel_title) {
              storyText = narrativeScene.panel_title;
            }
          }
        }
      } catch (error) {
        console.warn('Failed to parse script narration:', error);
      }
    }
    
    // Priority 2: Use scene-specific content
    if (!storyText && scene) {
      if (scene.dialogue) {
        storyText = scene.dialogue;
      } else if (scene.caption) {
        storyText = scene.caption;
      } else if (scene.panel_title) {
        storyText = scene.panel_title;
      } else if (scene.visual_description) {
        // Use first sentence of visual description
        const firstSentence = scene.visual_description.split(/[.!?]/)[0];
        storyText = firstSentence.length > 80 ? firstSentence.substring(0, 77) + '...' : firstSentence + '.';
      }
    }
    
    // Priority 3: Fallback to scene number
    if (!storyText) {
      storyText = `Scene ${i + 1}`;
    }
    
    if (storyText && storyText.trim()) {
      // Clean text for FFmpeg - be very aggressive to avoid filter errors
      let cleanText = storyText
        .replace(/[{}"\[\]]/g, '') // Remove JSON brackets and quotes
        .replace(/[^a-zA-Z0-9\s.,!?'-]/g, ' ') // Keep only safe characters
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      // Limit length for readability
      if (cleanText.length > 50) {
        // Find a good breaking point
        const words = cleanText.split(' ');
        let shortText = '';
        for (const word of words) {
          if ((shortText + ' ' + word).length > 47) break;
          shortText += (shortText ? ' ' : '') + word;
        }
        cleanText = shortText + '...';
      }
      
      // Comic book style text overlay with simple styling to avoid filter errors
      if (cleanText.length > 0) {
        // Position text at bottom with comic book styling
        const yPos = 'h*0.85'; // Bottom area  
        const fontSize = 38; // Readable size
        // Simple white text with black border - avoid complex effects that cause errors
        filterComplex += `,drawtext=text='${cleanText}':fontsize=${fontSize}:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=${yPos}`;
      }
    }
    
    filterComplex += `[v${i}]`;
  }

  // Simple concatenation of all scenes
  filterComplex += ';';
  for (let i = 0; i < SCENE_COUNT; i++) {
    filterComplex += `[v${i}]`;
  }
  filterComplex += `concat=n=${SCENE_COUNT}:v=1:a=0[video]`;

  // Handle audio mapping based on music availability
  const audioInputIndex = SCENE_COUNT; // Audio is added after all images
  
  args.push('-filter_complex', filterComplex);
  args.push('-map', '[video]');
  
  if (musicPath && typeof musicPath === 'string' && musicPath.trim()) {
    // Map music audio with exact trimming and fade out
    console.log(`🎵 Mapping music audio from input ${audioInputIndex} with ${TOTAL_DURATION}s duration`);
    args.push('-map', `${audioInputIndex}:a`);
    args.push('-af', `atrim=duration=${TOTAL_DURATION},afade=t=out:st=${TOTAL_DURATION-2}:d=2`); // Trim and fade out last 2 seconds
  } else {
    // Map silent audio
    console.log(`🔇 Mapping silent audio from input ${audioInputIndex}`);
    args.push('-map', `${audioInputIndex}:a`);
  }
  args.push('-t', TOTAL_DURATION.toString());
  args.push('-c:v', 'libx264');
  args.push('-preset', 'ultrafast');
  args.push('-crf', '28');
  args.push('-c:a', 'aac');
  args.push('-movflags', '+faststart');
  args.push(outputPath);

  console.log('🎬 WORKING FILTER SUCCESS');

  return args;
}

export async function renderVideoWithEffects({
  imagePaths,
  audioPath,
  musicPath,
  scenes = [],
  scriptData = {},
  outputPath,
  style = 'cinematic',
  onProgress = null
}) {
  const args = buildRenderArgs({
    imagePaths,
    audioPath,
    musicPath,
    outputPath,
    scenes,
    scriptData,
    style
  });
  
  console.log('🎬 WORKING render started:', {
    scenes: imagePaths.length,
    hasAudio: Boolean(audioPath),
    hasMusic: Boolean(musicPath),
    style,
    title: scriptData.title
  });
  
  try {
    const { spawn } = await import('node:child_process');
    
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', args);
      let errorOutput = '';
      
      ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();
        errorOutput += output;
        // Reduced logging for cleaner output
        if (output.includes('frame=')) {
          console.log('📹 Rendering:', output.substring(0, 80));
        }
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('✅ WORKING RENDER SUCCESS');
          resolve({ success: true, outputPath });
        } else {
          console.error('❌ Render failed:', errorOutput.slice(-300));
          reject(new Error(`FFmpeg failed: ${errorOutput.slice(-200)}`));
        }
      });
      
      ffmpeg.on('error', (error) => {
        reject(new Error(`FFmpeg spawn failed: ${error.message}`));
      });
    });
  } catch (error) {
    throw new Error(`Video rendering failed: ${error.message}`);
  }
}