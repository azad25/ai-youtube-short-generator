export function buildComicRenderArgs({
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
  const PANEL_DURATION = 8; // 8 seconds per panel for better reading time
  const TOTAL_DURATION = SCENE_COUNT * PANEL_DURATION;

  console.log(`📚 COMIC RENDER: ${SCENE_COUNT} panels, ${PANEL_DURATION}s each = ${TOTAL_DURATION}s total`);

  if (!Array.isArray(imagePaths) || imagePaths.length === 0) {
    throw new Error('At least 1 comic panel required');
  }

  const args = ["-y"];

  // Add each comic panel as input
  for (let i = 0; i < SCENE_COUNT; i++) {
    args.push("-loop", "1", "-t", PANEL_DURATION.toString(), "-i", imagePaths[i]);
  }

  // Add audio input - either music or silent audio
  if (musicPath && typeof musicPath === 'string' && musicPath.trim()) {
    console.log(`🎵 Adding comic soundtrack: ${musicPath}`);
    args.push('-i', musicPath);
  } else {
    console.log(`🔇 No music provided, using silent audio for comic`);
    args.push('-f', 'lavfi', '-i', `anullsrc=channel_layout=stereo:sample_rate=44100:duration=${TOTAL_DURATION}`);
  }

  // Comic-style filter complex with 3 horizontal panels layout
  let filterComplex = '';
  
  // Process each input: create comic book style panels
  for (let i = 0; i < SCENE_COUNT; i++) {
    if (i > 0) filterComplex += ';';
    
    // Create comic panel with border and comic book styling
    const panelHeight = Math.floor(height / 3); // Divide into 3 horizontal sections
    const panelY = i < 3 ? i * panelHeight : (i % 3) * panelHeight;
    
    filterComplex += `[${i}:v]scale=${width}:${panelHeight}:force_original_aspect_ratio=increase,crop=${width}:${panelHeight}`;
    
    // Add comic book border effect
    filterComplex += `,pad=${width}:${panelHeight + 20}:0:10:color=white`;
    filterComplex += `,drawbox=x=5:y=5:w=${width-10}:h=${panelHeight + 10}:color=black:thickness=8`;
    
    // Add scene-specific comic text overlays
    const scene = scenes[i];
    
    if (scene) {
      // Add comic book caption box at top of panel
      if (scene.caption) {
        const captionText = scene.caption
          .replace(/[^\w\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        // Caption box background
        filterComplex += `,drawbox=x=20:y=20:w=${width-40}:h=80:color=yellow@0.9:thickness=fill`;
        filterComplex += `,drawbox=x=20:y=20:w=${width-40}:h=80:color=black:thickness=3`;
        
        // Caption text
        filterComplex += `,drawtext=text='${captionText}':fontsize=32:fontcolor=black:x=(w-text_w)/2:y=40:font=Arial-Bold`;
      }
      
      // Add comic book dialogue/narration at bottom
      if (scene.dialogue || scene.narration_segment) {
        const dialogueText = (scene.dialogue || scene.narration_segment || '')
          .replace(/[^\w\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (dialogueText) {
          const words = dialogueText.split(' ');
          const maxWordsPerLine = 6;
          const maxLines = 3;
          
          // Speech bubble background
          const bubbleY = panelHeight - 120;
          filterComplex += `,drawbox=x=30:y=${bubbleY}:w=${width-60}:h=100:color=white@0.95:thickness=fill`;
          filterComplex += `,drawbox=x=30:y=${bubbleY}:w=${width-60}:h=100:color=black:thickness=4`;
          
          // Add dialogue text in speech bubble format
          for (let line = 0; line < maxLines && line * maxWordsPerLine < words.length; line++) {
            const startIndex = line * maxWordsPerLine;
            const endIndex = Math.min(startIndex + maxWordsPerLine, words.length);
            const lineText = words.slice(startIndex, endIndex).join(' ');
            
            if (lineText.trim()) {
              const yPosition = bubbleY + 25 + (line * 25);
              filterComplex += `,drawtext=text='${lineText}':fontsize=28:fontcolor=black:x=(w-text_w)/2:y=${yPosition}:font=Arial-Bold`;
            }
          }
        }
      }
      
      // Add comic book sound effects (BOOM, POW, etc.)
      if (scene.sound_effect) {
        const effectText = scene.sound_effect.toUpperCase()
          .replace(/[^\w]/g, '');
        
        if (effectText) {
          // Sound effect styling - big bold text with outline
          filterComplex += `,drawtext=text='${effectText}!':fontsize=72:fontcolor=red:borderw=6:bordercolor=yellow:x=(w-text_w)/2:y=h/2:font=Arial-Black`;
        }
      }
    }
    
    filterComplex += `[panel${i}]`;
  }

  // Create comic book page layout - stack 3 panels vertically or arrange them
  filterComplex += ';';
  
  if (SCENE_COUNT === 1) {
    // Single panel - center it
    filterComplex += `[panel0]pad=${width}:${height}:0:(${height}-${Math.floor(height/3)})/2:color=white[video]`;
  } else if (SCENE_COUNT === 2) {
    // Two panels - stack vertically with space
    filterComplex += `[panel0][panel1]vstack=inputs=2:shortest=0[stacked];`;
    filterComplex += `[stacked]pad=${width}:${height}:0:(${height}-${Math.floor(height/3)*2})/2:color=white[video]`;
  } else if (SCENE_COUNT >= 3) {
    // Three or more panels - classic comic layout
    filterComplex += `[panel0][panel1][panel2]vstack=inputs=3:shortest=0[video]`;
    
    // If more than 3 panels, concat them in sequence
    if (SCENE_COUNT > 3) {
      filterComplex = filterComplex.replace('[video]', '[page1]');
      
      // Add additional panels as separate pages/sequences
      for (let i = 3; i < Math.min(SCENE_COUNT, 6); i += 3) {
        const panelsInGroup = Math.min(3, SCENE_COUNT - i);
        filterComplex += `;`;
        
        for (let j = 0; j < panelsInGroup; j++) {
          filterComplex += `[panel${i + j}]`;
        }
        
        if (panelsInGroup === 3) {
          filterComplex += `vstack=inputs=3:shortest=0[page${Math.floor(i/3) + 1}]`;
        } else {
          filterComplex += `vstack=inputs=${panelsInGroup}:shortest=0[page${Math.floor(i/3) + 1}]`;
        }
      }
      
      // Concatenate all pages
      const pageCount = Math.ceil(SCENE_COUNT / 3);
      filterComplex += ';';
      for (let p = 1; p <= pageCount; p++) {
        filterComplex += `[page${p}]`;
      }
      filterComplex += `concat=n=${pageCount}:v=1:a=0[video]`;
    }
  }

  // Handle audio mapping
  const audioInputIndex = SCENE_COUNT;
  
  args.push('-filter_complex', filterComplex);
  args.push('-map', '[video]');
  
  if (musicPath && typeof musicPath === 'string' && musicPath.trim()) {
    console.log(`🎵 Mapping comic soundtrack from input ${audioInputIndex} with ${TOTAL_DURATION}s duration`);
    args.push('-map', `${audioInputIndex}:a`);
    args.push('-af', `atrim=duration=${TOTAL_DURATION},afade=t=out:st=${TOTAL_DURATION-2}:d=2`);
  } else {
    console.log(`🔇 Mapping silent audio for comic from input ${audioInputIndex}`);
    args.push('-map', `${audioInputIndex}:a`);
  }
  
  args.push('-t', TOTAL_DURATION.toString());
  args.push('-c:v', 'libx264');
  args.push('-preset', 'ultrafast');
  args.push('-crf', '28');
  args.push('-c:a', 'aac');
  args.push('-movflags', '+faststart');
  args.push(outputPath);

  console.log('📚 COMIC FILTER COMPLEX READY');
  return args;
}

export async function renderComicVideo({
  imagePaths,
  audioPath,
  musicPath,
  scenes = [],
  scriptData = {},
  outputPath,
  onProgress = null
}) {
  const args = buildComicRenderArgs({
    imagePaths,
    audioPath,
    musicPath,
    outputPath,
    scenes,
    scriptData
  });
  
  console.log('📚 COMIC render started:', {
    panels: imagePaths.length,
    hasAudio: Boolean(audioPath),
    hasMusic: Boolean(musicPath),
    title: scriptData.title,
    style: 'comic-book'
  });
  
  try {
    const { spawn } = await import('node:child_process');
    
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', args);
      let errorOutput = '';
      
      ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();
        errorOutput += output;
        
        if (output.includes('frame=')) {
          console.log('📚 Comic rendering:', output.substring(0, 80));
        }
        
        // Call progress callback if provided
        if (onProgress && output.includes('time=')) {
          const timeMatch = output.match(/time=(\d+):(\d+):(\d+\.\d+)/);
          if (timeMatch) {
            const seconds = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseFloat(timeMatch[3]);
            onProgress(seconds);
          }
        }
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('✅ COMIC RENDER SUCCESS');
          resolve({ 
            success: true, 
            outputPath,
            style: 'comic-book',
            panels: imagePaths.length
          });
        } else {
          console.error('❌ Comic render failed:', errorOutput.slice(-300));
          reject(new Error(`Comic FFmpeg failed: ${errorOutput.slice(-200)}`));
        }
      });
      
      ffmpeg.on('error', (error) => {
        reject(new Error(`Comic FFmpeg spawn failed: ${error.message}`));
      });
    });
  } catch (error) {
    throw new Error(`Comic video rendering failed: ${error.message}`);
  }
}