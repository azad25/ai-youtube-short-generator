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
    
    // Add story text with narrative segments
    let storyText = '';
    const scene = scenes[i];
    
    if (scriptData.narration && SCENE_COUNT > 1) {
      // Split the full narration into story segments
      const sentences = scriptData.narration.split(/[.!?]+/).filter(s => s.trim().length > 10);
      const sentencesPerScene = Math.ceil(sentences.length / SCENE_COUNT);
      const sceneStart = i * sentencesPerScene;
      const sceneEnd = Math.min(sceneStart + sentencesPerScene, sentences.length);
      const sceneSentences = sentences.slice(sceneStart, sceneEnd);
      
      // Combine scene title with story segment
      if (scene?.caption) {
        storyText = scene.caption + ': ' + sceneSentences.join('. ').trim();
      } else {
        storyText = sceneSentences.join('. ').trim();
      }
    } else if (scene?.caption) {
      storyText = scene.caption;
    }
    
    if (storyText) {
      // Clean text first
      let cleanText = storyText
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Create multiple drawtext overlays for paragraph format
      const words = cleanText.split(' ');
      const maxWordsPerLine = 5;
      const maxLines = 4;
      
      for (let line = 0; line < maxLines && line * maxWordsPerLine < words.length; line++) {
        const startIndex = line * maxWordsPerLine;
        const endIndex = Math.min(startIndex + maxWordsPerLine, words.length);
        const lineText = words.slice(startIndex, endIndex).join(' ');
        
        if (lineText.trim()) {
          // Add separate drawtext for each line - PARAGRAPH FORMAT
          const yPosition = `h*0.6+${line * 70}`; // 70px spacing between lines
          filterComplex += `,drawtext=text='${lineText}':fontsize=55:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=${yPosition}`;
        }
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