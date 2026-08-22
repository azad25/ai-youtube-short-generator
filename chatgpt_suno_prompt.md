# ChatGPT Prompt: Update Suno AI Music Integration

## Context
I have a Marvel Shorts Factory application that generates YouTube shorts with AI music. The Suno AI integration is currently not working - getting 503 errors from the API endpoint. I need you to research the latest Suno AI API documentation and rewrite the music integration code.

## Current Issues
- Using `https://api.suno.ai/v1/generate` endpoint returns 503 Service Temporarily Unavailable
- API key is configured: `191f2115f5491f81999022b2224f10fd` 
- Need to find the correct Suno API endpoints and request format
- Current implementation is in `/lib/music.js` with `generateWithSuno()` method

## Requirements
Please research the latest Suno AI API documentation (2024/2025) and provide:

1. **Correct API Endpoints**: What are the current working Suno API endpoints?
2. **Authentication Method**: How should I authenticate with the API key?
3. **Request Format**: What's the correct request structure for generating music?
4. **Response Format**: What does Suno return and how do I poll for completion?
5. **Updated Code**: Rewrite the `generateWithSuno()` method with correct implementation

## Current Code Structure
```javascript
// Current broken implementation in lib/music.js
async generateWithSuno(brief, durationSeconds, shortId) {
  const apiKey = process.env.SUNO_API_KEY;
  
  const response = await fetch('https://api.suno.ai/v1/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: brief,
      duration: Math.min(durationSeconds, 120),
      instrumental: true,
      genre: 'cinematic',
      energy: 'high',
      format: 'mp3'
    })
  });
  
  // Poll for completion
  const audioUrl = await this.pollSunoGeneration(result.generation_id, apiKey);
  
  // Download and store music
  await this.downloadAndStoreMusic(audioUrl, key);
}
```

## Music Generation Parameters
- Duration: 24 seconds (for YouTube Shorts)
- Style: Dark cinematic, orchestral, instrumental only
- Quality: High quality MP3
- Context: Marvel superhero content (Dr. Doom villain themes)

## Expected Output
Please provide:

1. **Research Summary**: What you found about current Suno API status and endpoints
2. **Working Code**: Complete `generateWithSuno()` method that works with latest API
3. **Error Handling**: Proper error handling for API failures
4. **Alternative Solutions**: If Suno isn't available, suggest alternatives

## Additional Context
- This is running in a Docker container with Node.js
- Music files are stored using a storage abstraction layer
- The app also has fallback to local music library if AI generation fails
- Budget tracking is important (track API costs)

## Files to Update
Please provide updated code for:
- `lib/music.js` - The `generateWithSuno()` method
- Any additional configuration or environment variables needed
- Error handling improvements

## Sample Music Brief
```
"Create an original dark atmospheric orchestral score with deep bass, haunting strings, and cinematic percussion with regal villainy and armored authority themes, 80% intensity with strong dramatic presence, instrumental only, no vocals, no copyrighted melodies, exactly 24 seconds duration. Perfect for Marvel cinematic superhero content, evocative and engaging."
```

Please research this thoroughly and provide working, production-ready code that integrates with the latest Suno AI API.