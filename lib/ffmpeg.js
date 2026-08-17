export function buildRenderArgs({ 
  imagePaths, 
  audioPath, 
  musicPath,
  outputPath, 
  scenes = [],
  scriptData = {},
  width = 1440, 
  height = 2560, 
  fps = 30,
  style = 'cinematic'
}) {
  if (!Array.isArray(imagePaths) || imagePaths.length === 0) {
    throw new Error('At least one scene image is required.');
  }
  
  const args = ['-y']; // Overwrite output file
  
  // Calculate duration per image to reach target duration (60 seconds total)
  const targetDuration = 60; // Fixed 60 seconds for YouTube Shorts
  const durationPerImage = Math.max(4, targetDuration / imagePaths.length); // At least 4 seconds per image
  
  // Add each image as input
  for (const imagePath of imagePaths) {
    args.push('-loop', '1', '-t', durationPerImage.toString(), '-i', imagePath);
  }
  
  // Add audio inputs if they exist
  let nextInputIndex = imagePaths.length;
  const audioInputIndex = audioPath ? nextInputIndex++ : null;
  const musicInputIndex = musicPath ? nextInputIndex++ : null;
  const silentInputIndex = (!audioPath && !musicPath) ? nextInputIndex++ : null;
  
  if (audioPath) {
    args.push('-i', audioPath);
  }
  if (musicPath) {
    args.push('-i', musicPath);
  }
  if (!audioPath && !musicPath) {
    // Add silent audio source as input
    args.push('-f', 'lavfi', '-i', `anullsrc=channel_layout=stereo:sample_rate=44100:duration=${targetDuration}`);
  }
  
  // Build comprehensive filter complex
  let filterComplex = '';
  
  // Process each image with cinematic effects
  for (let i = 0; i < imagePaths.length; i++) {
    if (i > 0) filterComplex += ';';
    
    // Add Ken Burns zoom effect with Marvel-style color grading
    filterComplex += `[${i}:v]scale=${width * 1.2}:${height * 1.2}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
    filterComplex += `,zoompan=z='if(lte(zoom,1.0),1.2,max(1.001,zoom-0.0015))':d=${Math.floor(durationPerImage * fps)}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}`;
    filterComplex += `,eq=brightness=0.05:contrast=1.2:saturation=1.3`;
    filterComplex += `,vignette=angle=PI/3:mode=forward[v${i}]`;
  }
  
  // Concatenate all video streams
  filterComplex += ';';
  for (let i = 0; i < imagePaths.length; i++) {
    filterComplex += `[v${i}]`;
  }
  filterComplex += `concat=n=${imagePaths.length}:v=1:a=0[video]`;
  
  // Handle audio mixing
  if (audioPath && musicPath) {
    // Mix narration and background music
    filterComplex += `;[${audioInputIndex}:a]volume=1.0[narration];[${musicInputIndex}:a]volume=0.3,afade=t=in:st=0:d=1,afade=t=out:st=${targetDuration-2}:d=2[music];[narration][music]amix=inputs=2:duration=longest:dropout_transition=2[audio]`;
  } else if (audioPath) {
    // Use only narration
    filterComplex += `;[${audioInputIndex}:a]volume=1.0,apad=pad_dur=${targetDuration}[audio]`;
  } else if (musicPath) {
    // Use only music
    filterComplex += `;[${musicInputIndex}:a]volume=0.5,afade=t=in:st=0:d=1,afade=t=out:st=${targetDuration-2}:d=2,apad=pad_dur=${targetDuration}[audio]`;
  } else {
    // Use silent audio
    filterComplex += `;[${silentInputIndex}:a]volume=0[audio]`;
  }
  
  args.push('-filter_complex', filterComplex);
  args.push('-map', '[video]');
  args.push('-map', '[audio]');
  
  // Set exact duration
  args.push('-t', targetDuration.toString());
  
  // YouTube-optimized encoding settings
  args.push('-c:v', 'libx264');
  args.push('-pix_fmt', 'yuv420p');
  args.push('-preset', 'medium');
  args.push('-crf', '23');
  args.push('-maxrate', '8M');
  args.push('-bufsize', '12M');
  args.push('-c:a', 'aac');
  args.push('-b:a', '128k');
  args.push('-ar', '44100');
  args.push('-ac', '2');
  args.push('-shortest');
  args.push('-movflags', '+faststart');
  
  args.push(outputPath);
  
  console.log('🎬 FFmpeg args built:', {
    imageCount: imagePaths.length,
    targetDuration,
    hasAudio: Boolean(audioPath),
    hasMusic: Boolean(musicPath),
    filterComplex: filterComplex.substring(0, 200) + '...'
  });
  
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
