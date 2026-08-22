# FFmpeg Code Generation Prompt for ChatGPT

## Task
Generate a JavaScript function `buildRenderArgs()` that creates proper FFmpeg command arguments to build a 60-second YouTube Shorts video from multiple scene images with storytelling text overlays.

## Critical Requirements

### Video Requirements
- **Input**: Array of 5 image paths (PNG files, 1440x2560 resolution)
- **Output**: 60-second MP4 video (1440x2560, vertical format)
- **Duration**: Each image shows for 12 seconds (5 images × 12s = 60s total)
- **ALL 5 IMAGES MUST APPEAR IN SEQUENCE** - This is critical!

### Text Overlay Requirements
- Each scene needs **storytelling text** overlaid on the image
- Text should be **large and readable** (at least 6% of video height)
- Text positioned in **bottom third** of video (around y=h*0.7)
- Text should have **black border** and **white fill** for readability
- Text should be **centered horizontally**
- Maximum 3-4 lines of text per scene
- Font: DejaVu Sans Bold (`/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf`)

### Input Data Structure
```javascript
// Function signature
function buildRenderArgs({ 
  imagePaths,     // Array of 5 image file paths
  audioPath,      // Optional audio file path
  musicPath,      // Optional music file path  
  outputPath,     // Output video file path
  scenes,         // Array of scene objects with story text
  scriptData,     // Object with title and narration
  width = 1440,   // Video width
  height = 2560,  // Video height
  fps = 30        // Frame rate
})

// Sample scenes data
const scenes = [
  { scene_number: 1, caption: "The Birth of a Legend" },
  { scene_number: 2, caption: "A Mind Beyond Measure" },
  { scene_number: 3, caption: "The Accident" },
  { scene_number: 4, caption: "Rise of the Tyrant" }, 
  { scene_number: 5, caption: "Master of Technology" }
];

// Sample script data
const scriptData = {
  title: "Spider-Man: The Amazing Origin",
  narration: "In the shadowy corridors of New York, one teenager's life changed forever. Peter Parker was just an ordinary student until a radioactive spider bite granted him incredible powers. With great power came great responsibility, and Peter learned this lesson the hard way. Through tragedy and triumph, he became the amazing Spider-Man. His journey from ordinary teen to superhero inspired millions around the world."
};
```

### FFmpeg Requirements
- Use `-filter_complex` for processing
- Each image should have Ken Burns zoom effect (slight zoom in/out)
- Concatenate all processed images into single video stream
- Handle audio mixing if provided
- Output format: libx264, yuv420p, 60fps, optimized for YouTube

### Critical Issues to Avoid
1. **Only showing 1 image** - The concat filter must properly sequence ALL 5 images
2. **Text cut off** - Text must fit within video bounds and be properly positioned
3. **No storytelling** - Each scene needs meaningful story text, not just titles

### Story Text Logic
- If `scriptData.narration` exists, split it into 5 equal parts for each scene
- Combine scene caption with narrative segment for rich storytelling
- Clean text of special characters that break FFmpeg
- Limit to 100-150 characters per scene for readability

## Expected Output
Return a complete JavaScript function that:
1. Processes 5 input images with zoom effects
2. Adds proper storytelling text to each scene  
3. Concatenates them into 60-second video
4. Returns array of FFmpeg command arguments
5. Includes proper error handling

## Test Case
The function should work with this call:
```javascript
const args = buildRenderArgs({
  imagePaths: ['/path/scene1.png', '/path/scene2.png', '/path/scene3.png', '/path/scene4.png', '/path/scene5.png'],
  audioPath: null,
  musicPath: null,
  outputPath: '/path/output.mp4',
  scenes: scenes, // From above
  scriptData: scriptData, // From above
});
```

## Success Criteria
- Video shows all 5 scenes in sequence (12 seconds each)
- Each scene has readable storytelling text overlay
- Text is properly positioned and sized
- Video is exactly 60 seconds long
- 1440x2560 vertical format maintained

Please generate the complete `buildRenderArgs()` function with proper FFmpeg filter_complex syntax.