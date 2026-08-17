export function buildRenderArgs({ 
  imagePaths, 
  audioPath, 
  musicPath,
  outputPath, 
  scenes = [],
  scriptData = {},
  width = 1080, 
  height = 1920, 
  fps = 30,
  style = 'cinematic'
}) {
  if (!Array.isArray(imagePaths) || imagePaths.length === 0) {
    throw new Error('At least one scene image is required.');
  }
  if (![width, height, fps].every(Number.isInteger)) {
    throw new Error('Render dimensions and frame rate must be integers.');
  }
  
  const args = ['-y']; // Overwrite output file
  
  // Add each image as input
  for (const imagePath of imagePaths) {
    args.push('-loop', '1', '-t', '6', '-i', imagePath);
  }
  
  // Add audio inputs and track their positions
  let audioInputIndex = imagePaths.length;
  let musicInputIndex = null;
  let silentInputIndex = null;
  
  if (audioPath) {
    args.push('-i', audioPath);
    if (musicPath) {
      musicInputIndex = audioInputIndex + 1;
      args.push('-i', musicPath);
    }
  } else if (musicPath) {
    args.push('-i', musicPath);
    musicInputIndex = audioInputIndex;
  } else {
    // Add silent audio as an input
    args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');
    silentInputIndex = audioInputIndex;
  }
  
  // Build complex filter with cinematic effects
  const filterComplex = buildCinematicFilter({
    imageCount: imagePaths.length,
    scenes,
    scriptData,
    width,
    height,
    fps,
    style,
    hasAudio: Boolean(audioPath),
    hasMusic: Boolean(musicPath)
  });
  
  args.push('-filter_complex', filterComplex);
  
  // Map outputs
  args.push('-map', '[final_video]');
  
  if (audioPath && musicPath) {
    args.push('-map', '[final_audio]');
  } else if (audioPath) {
    args.push('-map', `${audioInputIndex}:a`);
  } else if (musicPath) {
    args.push('-map', `${musicInputIndex}:a`);
  } else {
    // Map the silent audio
    args.push('-map', `${silentInputIndex}:a`);
    args.push('-t', String(imagePaths.length * 6));
  }
  
  // High-quality encoding for YouTube
  args.push('-c:v', 'libx264');
  args.push('-pix_fmt', 'yuv420p');
  args.push('-preset', 'medium');
  args.push('-crf', '20'); // Higher quality for YouTube
  args.push('-c:a', 'aac');
  args.push('-b:a', '128k');
  args.push('-ar', '44100');
  
  // YouTube optimization
  args.push('-movflags', '+faststart');
  args.push('-maxrate', '8000k');
  args.push('-bufsize', '12000k');
  
  args.push(outputPath);
  return args;
}

function buildCinematicFilter({ 
  imageCount, 
  scenes, 
  scriptData, 
  width, 
  height, 
  fps, 
  style,
  hasAudio,
  hasMusic
}) {
  const filters = [];
  const sceneDuration = 6; // seconds per scene
  
  // Process each image with cinematic effects
  for (let i = 0; i < imageCount; i++) {
    const scene = scenes[i] || {};
    const sceneFilter = createSceneEffects({
      index: i,
      scene,
      width,
      height,
      fps,
      duration: sceneDuration,
      style
    });
    filters.push(sceneFilter);
  }
  
  // Add text overlays for captions
  const textOverlayFilter = createTextOverlays({
    scenes,
    width,
    height,
    imageCount,
    scriptData
  });
  
  // Concatenate all scenes with transitions
  const transitionFilter = createTransitions({
    imageCount,
    style
  });
  
  // Add opening and closing effects
  const titleEffects = createTitleEffects({
    scriptData,
    width,
    height,
    fps
  });
  
  // Audio mixing
  const audioFilter = hasAudio && hasMusic 
    ? createAudioMix(imageCount)
    : '';
  
  // Combine all filters
  let filterComplex = [
    ...filters,
    textOverlayFilter,
    transitionFilter,
    titleEffects,
    audioFilter
  ].filter(Boolean).join(';');
  
  return filterComplex;
}

function createSceneEffects({ index, scene, width, height, fps, duration, style }) {
  const effects = [];
  
  // Base scaling and positioning with ken burns effect
  const kenBurns = `scale=${width * 1.2}:${height * 1.2},` +
    `zoompan=z='if(lte(zoom,1.0),1.2,max(1.001,zoom-0.0015))':d=${duration * fps}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}`;
  
  // Add motion blur for dynamic scenes (using compatible filter)
  const motionBlur = style === 'action' ? ',unsharp=5:5:-1.0:5:5:-1.0' : '';
  
  // Color grading based on Marvel style
  const colorGrade = getMarvelColorGrade(scene.mood || 'neutral');
  
  // Vignette effect for cinematic look
  const vignette = `,vignette=angle=PI/4:mode=forward:eval=frame`;
  
  return `[${index}:v]${kenBurns}${motionBlur}${colorGrade}${vignette}[scene${index}]`;
}

function getMarvelColorGrade(mood) {
  const grades = {
    'dark': ',curves=vintage,eq=brightness=0.05:contrast=1.2:saturation=0.8',
    'heroic': ',curves=lighter,eq=brightness=0.1:contrast=1.1:saturation=1.2',
    'action': ',curves=strong_contrast,eq=contrast=1.3:saturation=1.1',
    'mysterious': ',curves=darker,eq=brightness=-0.05:contrast=1.15:gamma=1.1',
    'cosmic': ',curves=vintage,eq=saturation=1.3:gamma=0.9,hue=h=+30',
    'neutral': ',eq=brightness=0.02:contrast=1.05:saturation=1.0'
  };
  return grades[mood] || grades.neutral;
}

function createTextOverlays({ scenes, width, height, imageCount, scriptData }) {
  const overlays = [];
  const fontPath = '/System/Library/Fonts/Arial.ttc'; // System font path
  
  for (let i = 0; i < imageCount; i++) {
    const scene = scenes[i] || {};
    const caption = scene.caption || '';
    const startTime = i * 6;
    const endTime = (i + 1) * 6;
    
    if (caption) {
      // Split long captions into multiple lines
      const lines = splitTextIntoLines(caption, 40);
      const fontSize = Math.floor(height * 0.04); // Responsive font size
      const yPosition = height * 0.8; // Bottom third
      
      // Create animated text with typewriter effect
      const textFilter = `drawtext=fontfile='${fontPath}':text='${lines.join('\\n')}':` +
        `fontsize=${fontSize}:fontcolor=white:x=(w-text_w)/2:y=${yPosition}:` +
        `enable='between(t,${startTime},${endTime})':` +
        `borderw=2:bordercolor=black:alpha='if(lt(t,${startTime + 0.5}),0,if(lt(t,${startTime + 1}),(t-${startTime})*2,1))'`;
      
      overlays.push(textFilter);
    }
  }
  
  // Add title overlay if provided
  if (scriptData.title) {
    const titleFont = Math.floor(height * 0.06);
    const titleFilter = `drawtext=fontfile='${fontPath}':text='${scriptData.title}':` +
      `fontsize=${titleFont}:fontcolor=white:x=(w-text_w)/2:y=h*0.1:` +
      `enable='between(t,0,3)':borderw=3:bordercolor=black:` +
      `alpha='if(lt(t,0.5),0,if(lt(t,1.5),(t-0.5),if(lt(t,2.5),1,if(lt(t,3),(3-t)*2,0))))'`;
    
    overlays.push(titleFilter);
  }
  
  return overlays.length > 0 
    ? `[scene_concat]${overlays.map(f => ',' + f).join('')}[text_overlay]`
    : '';
}

function splitTextIntoLines(text, maxLength) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  
  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxLength) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  
  return lines;
}

function createTransitions({ imageCount, style }) {
  const transitionEffects = {
    'cinematic': 'fade',
    'action': 'wipeleft',
    'dramatic': 'dissolve',
    'modern': 'slideright'
  };
  
  const transition = transitionEffects[style] || 'fade';
  const transitionDuration = 0.5;
  
  // Build xfade transitions between scenes
  let transitionFilter = '';
  if (imageCount > 1) {
    transitionFilter = `[scene0][scene1]xfade=transition=${transition}:duration=${transitionDuration}:offset=5.5[t01];`;
    
    for (let i = 2; i < imageCount; i++) {
      const prevTransition = i === 2 ? 't01' : `t${String(i-1).padStart(2, '0')}`;
      const currentTransition = `t${String(i).padStart(2, '0')}`;
      const offset = (i * 6) - transitionDuration;
      
      transitionFilter += `[${prevTransition}][scene${i}]xfade=transition=${transition}:duration=${transitionDuration}:offset=${offset}[${currentTransition}];`;
    }
    
    const finalTransition = imageCount > 2 
      ? `t${String(imageCount-1).padStart(2, '0')}`
      : 't01';
    
    return `${transitionFilter}[${finalTransition}]fps=${30}[scene_concat]`;
  } else {
    return `[scene0]fps=${30}[scene_concat]`;
  }
}

function createTitleEffects({ scriptData, width, height, fps }) {
  if (!scriptData.title) return '';
  
  // Marvel-style title card with animated entrance
  const titleDuration = 3;
  const fontSize = Math.floor(height * 0.08);
  
  return `,drawtext=fontfile='/System/Library/Fonts/Arial.ttc':text='${scriptData.title}':` +
    `fontsize=${fontSize}:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:` +
    `enable='between(t,0,${titleDuration})':borderw=4:bordercolor=red:` +
    `alpha='if(lt(t,0.5),(t*2),if(lt(t,2.5),1,(3-t)*2))'[title_overlay]`;
}

function createAudioMix(imageCount) {
  // Mix narration and background music
  const totalDuration = imageCount * 6;
  
  return `[${imageCount}:a]volume=0.8[narration];` +
    `[${imageCount + 1}:a]volume=0.3,afade=t=in:st=0:d=1,afade=t=out:st=${totalDuration - 2}:d=2[music];` +
    `[narration][music]amix=inputs=2:duration=first:dropout_transition=2[final_audio]`;
}

// Enhanced render function with proper error handling
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
  
  console.log('🎬 Starting cinematic render with effects:', {
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
        
        // Extract progress information
        if (onProgress) {
          const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})/);
          if (timeMatch) {
            const [, hours, minutes, seconds] = timeMatch;
            const currentTime = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
            const totalDuration = imagePaths.length * 6;
            const progress = Math.min(100, (currentTime / totalDuration) * 100);
            onProgress(progress);
          }
        }
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Cinematic render completed successfully');
          resolve({ success: true, outputPath });
        } else {
          console.error('❌ FFmpeg render failed:', errorOutput);
          reject(new Error(`FFmpeg failed with code ${code}: ${errorOutput.slice(-500)}`));
        }
      });
      
      ffmpeg.on('error', (error) => {
        console.error('❌ FFmpeg spawn error:', error);
        reject(new Error(`FFmpeg spawn failed: ${error.message}`));
      });
    });
  } catch (error) {
    throw new Error(`Video rendering failed: ${error.message}`);
  }
}
