# ChatGPT Prompt: Find Recent Royalty-Free Audio Sources with Direct Downloads

## Context
I'm building a Marvel Shorts Factory application that generates YouTube shorts with background music. I need you to research and provide **current, working, royalty-free audio sources** with **direct MP3 download links** that I can programmatically download and use in my application.

## Critical Requirements

### 1. **Direct Download Links Only**
- Must be **direct MP3 URLs** that can be downloaded with `fetch()` in Node.js
- **NO streaming links, preview links, or links that require browser interaction**
- Links should work with: `curl -o music.mp3 "https://direct-link-to-file.mp3"`
- Test each link before providing it

### 2. **Legal & Commercial Use**
- **Royalty-free** or **Creative Commons** licensed
- **Commercial use allowed** (for monetized YouTube videos)
- **No attribution required** preferred, but attribution-required is acceptable
- **NO copyrighted music** from major labels/artists

### 3. **Technical Specifications**
- **Format**: MP3 files
- **Duration**: 30 seconds to 3 minutes per track
- **Quality**: At least 128kbps, preferably 192kbps+
- **File size**: Under 10MB per track

### 4. **Music Categories Needed**
I need tracks for these specific moods:
- **Dark / Cinematic**: Villain themes, dramatic orchestral, suspenseful
- **Epic / Action**: Heroic themes, battle music, high-energy
- **Suspense**: Tension building, mystery, thriller atmosphere  
- **Emotional**: Character moments, touching scenes, piano/strings
- **Sci-fi**: Futuristic, technology, space themes
- **Mysterious**: Supernatural, magical, enigmatic atmosphere

## Current Sources (Update These)
My current list includes some outdated sources. Please research and provide:

### **Sources to Research & Update:**
1. **Freesound.org** - Creative Commons audio
2. **Free Music Archive** - Royalty-free collection
3. **Bensound** - Royalty-free with attribution
4. **Incompetech (Kevin MacLeod)** - Creative Commons
5. **Zapsplat** - Royalty-free library
6. **Pixabay Music** - Free music library
7. **YouTube Audio Library** - Free music for creators
8. **Mixkit** - Free music and sound effects
9. **Purple Planet Music** - Royalty-free music
10. **Artlist** - Subscription-based (check if free tier available)

### **Find New Sources:**
Research and find **3-5 additional current sources** that are:
- Active and maintained (updated in 2024/2025)  
- Have good quality cinematic/orchestral music
- Provide direct download links
- Allow commercial use

## Required Output Format

For each source, provide this **exact format**:

```javascript
{
  name: 'Track Name',
  url: 'https://direct-download-link.mp3', // MUST be direct download
  mood: 'Dark / Cinematic', // Use exact mood names above
  durationSeconds: 120,
  intensity: 75, // 0-100 scale
  tags: ['cinematic', 'orchestral', 'villain'],
  license: 'Creative Commons Attribution' or 'Royalty Free',
  source: 'Website Name',
  downloadTested: true, // Only include if you can verify the link works
  attribution: 'Optional attribution text if required'
}
```

## Specific Research Tasks

### 1. **Verify Current Links**
Check if these example links still work and provide working alternatives:
- Bensound direct downloads
- Free Music Archive MP3 links  
- Kevin MacLeod Incompetech files

### 2. **Find Marvel-Appropriate Music**
Look specifically for:
- **Dark villain themes** (similar to Dr. Doom, Thanos)
- **Heroic orchestral pieces** (Avengers-style)
- **Sci-fi ambient** (space/technology themes)
- **Action battle music** (fight scenes)

### 3. **Test Download Method**
For each link you provide, verify it works with:
```bash
curl -L -o test.mp3 "https://your-link-here.mp3"
```

### 4. **Check Licensing**
Verify each source's **current licensing terms** (2024/2025):
- Commercial use permissions
- Attribution requirements
- Any usage restrictions

## Expected Deliverables

1. **Updated Track List**: 20-30 working tracks across all moods
2. **Source Summary**: Brief description of each music library
3. **Download Instructions**: Any special headers or parameters needed
4. **Licensing Summary**: Clear commercial use permissions for each source
5. **Alternative Methods**: If direct downloads aren't available, suggest programmatic alternatives

## Additional Context

- This is for a **commercial YouTube channel** (Marvel Central)
- Videos are **monetized** so licensing must allow commercial use
- App runs in **Docker/Node.js** environment
- Music will be **trimmed to 24 seconds** and combined with video
- **Attribution can be added** to video descriptions if required

## Research Priority

Focus on finding **high-quality cinematic/orchestral music** suitable for:
- Marvel superhero content
- Professional YouTube shorts
- Dramatic storytelling
- Action sequences

Please research this thoroughly and provide **working, tested, legal audio sources** that I can immediately integrate into my Marvel Shorts Factory application.