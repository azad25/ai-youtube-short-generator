import { storage } from './storage.js';

function required(name) { 
  if (!process.env[name]) throw new Error(`${name} is required.`); 
  return process.env[name]; 
}

/**
 * Hugging Face Router API provider for text and image generation
 * 
 * Uses HF Router (https://router.huggingface.co/v1) which is more reliable
 * than direct inference API and supports OpenAI-compatible interface.
 * 
 * IMPORTANT: HF Free accounts only get $0.10/month of hosted inference credits.
 * This is primarily for experimentation and fallback, not production scale.
 * 
 * For production, consider:
 * 1. Self-hosting open models (Qwen3, FLUX.1-schnell)
 * 2. Other providers with better free tiers
 * 3. Upgrading to HF PRO ($9/month for $2 credits)
 */
export class HuggingFaceProvider {
  constructor() {
    this.apiKey = process.env.HF_TOKEN || process.env.HF_API_KEY; // Support both HF_TOKEN and HF_API_KEY
    this.backupTokens = process.env.HF_BACKUP_TOKENS ? 
      process.env.HF_BACKUP_TOKENS.split(',').map(k => k.trim()).filter(k => k) : [];
    this.allTokens = [this.apiKey, ...this.backupTokens].filter(Boolean);
    this.currentTokenIndex = 0;
    
    this.baseUrl = 'https://router.huggingface.co/v1';
    
    // Updated to use better, more realistic models
    this.textModel = process.env.HF_TEXT_MODEL || 'Qwen/Qwen2.5-Coder-7B-Instruct';
    this.imageModel = process.env.HF_IMAGE_MODEL || 'black-forest-labs/FLUX.1-schnell';
    
    // Usage tracking to stay within free limits
    this.monthlyUsage = 0;
    this.maxMonthlyBudget = 0.10; // $0.10 free tier limit
  }

  getCurrentToken() {
    if (this.allTokens.length === 0) return null;
    return this.allTokens[this.currentTokenIndex % this.allTokens.length];
  }

  rotateToken() {
    this.currentTokenIndex = (this.currentTokenIndex + 1) % this.allTokens.length;
    console.log(`🔄 Rotated to HF token ${this.currentTokenIndex + 1}/${this.allTokens.length}`);
  }

  /**
   * Generate text using Hugging Face Router with OpenAI-compatible API
   */
  async generateText({ prompt, maxTokens = 1000, temperature = 0.8 }) {
    if (!this.apiKey) {
      throw new Error('HF_API_KEY is required for Hugging Face text generation');
    }

    // Check if we're approaching the monthly limit
    if (this.monthlyUsage >= this.maxMonthlyBudget * 0.9) {
      console.warn('🚨 Approaching HF monthly limit. Consider upgrading to PRO or using self-hosted models.');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.textModel,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: maxTokens,
        temperature: temperature,
        stream: false
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      
      // Handle specific HF errors
      if (error.error?.includes('Rate limit') || response.status === 429) {
        throw new Error('HF rate limit exceeded. Free tier: $0.10/month. Consider upgrading to PRO.');
      }
      if (error.error?.includes('Model is loading')) {
        throw new Error('HF model is loading. This is common with free tier. Try again in a moment.');
      }
      
      throw new Error(`Hugging Face text generation failed: ${error.error || response.statusText}`);
    }

    const result = await response.json();
    
    // Handle OpenAI-compatible response format
    if (result.choices && result.choices[0]?.message?.content) {
      return result.choices[0].message.content;
    } else {
      console.error('Unexpected HF response format:', result);
      throw new Error('Unexpected response format from Hugging Face Router');
    }
  }

  /**
   * Generate Marvel comic-style script using Qwen models via HF Router
   */
  async generateComicScript({ topic, contentType, duration, evidence, language = 'English' }) {
    // Use a more structured prompt for better JSON output from Qwen
    const prompt = `You are a Marvel Comics script writer. Generate a ${duration}-second comic script with exactly 9 scenes (3 per composite image).

Topic: "${topic}"
Content Type: ${contentType}
Duration: ${duration} seconds
Language: ${language}
Evidence: ${evidence}

Create a Marvel comic script with this exact JSON structure:
{
  "title": "Comic title under 60 characters",
  "hook": "Opening hook",
  "scenes": [
    {
      "scene_number": 1,
      "composite_image": 1,
      "start_time": 0,
      "end_time": 2.67,
      "caption": "Scene description",
      "dialogue": "Character dialogue", 
      "sound_effect": "BOOM!",
      "visual_description": "Marvel comic scene details",
      "image_prompt": "Marvel comic book art prompt"
    }
  ]
}

Generate exactly 9 scenes, 3 per composite image (composite_image: 1, 2, or 3).
Output valid JSON only, no additional text.`;

    try {
      console.log('💰 Using HF Router ($0.10/month limit). Consider self-hosting Qwen3 for production.');
      
      const response = await this.generateText({ 
        prompt, 
        maxTokens: 2000, 
        temperature: 0.7 
      });
      
      // Clean up response and extract JSON
      let cleanResponse = response.trim();
      
      // Handle incomplete JSON by looking for complete objects
      if (cleanResponse.includes('{') && !cleanResponse.endsWith('}')) {
        console.log('⚠️ Incomplete JSON detected, attempting to fix...');
        // Find the last complete scene object
        const lastCompleteScene = cleanResponse.lastIndexOf('    }');
        if (lastCompleteScene > -1) {
          cleanResponse = cleanResponse.substring(0, lastCompleteScene + 5) + '\n  ]\n}';
          console.log('🔧 Fixed incomplete JSON structure');
        }
      }
      
      // Remove common prefixes/suffixes that might interfere
      cleanResponse = cleanResponse.replace(/^.*?(\{)/s, '$1');
      cleanResponse = cleanResponse.replace(/(\}).*$/s, '$1');
      
      // Try to parse JSON
      try {
        const scriptData = JSON.parse(cleanResponse);
        
        // Validate structure
        if (!scriptData.scenes || !Array.isArray(scriptData.scenes)) {
          throw new Error('Invalid script structure: missing scenes array');
        }
        
        return scriptData;
      } catch (parseError) {
        console.error('JSON parsing failed, response was:', cleanResponse);
        throw new Error('Failed to parse JSON from Qwen model. Consider using a different model or self-hosting.');
      }
      
    } catch (error) {
      console.error('HF script generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate comic-style images using HuggingFace InferenceClient
   * Uses the proper @huggingface/inference library with text_to_image
   */
  async generateImage({ prompt, shortId, sceneNumber, width = 1024, height = 1024, style = 'cinematic' }) {
    if (!this.apiKey) {
      throw new Error('HF_API_KEY is required for Hugging Face image generation');
    }

    // Check monthly usage
    if (this.monthlyUsage >= this.maxMonthlyBudget * 0.8) {
      console.warn('🚨 Approaching HF monthly limit for images. Consider self-hosting FLUX.1-schnell.');
    }

    // Enhance prompt for Marvel comic style
    let enhancedPrompt = prompt;
    if (style === 'comic' || style === 'marvel-comic') {
      enhancedPrompt = this.buildMarvelComicPrompt(prompt);
    }

    console.log('💰 Using FLUX.1-schnell via HF InferenceClient ($0.10/month limit). For production, consider self-hosting.');

    try {
      // Try to dynamically import and use HuggingFace InferenceClient
      let InferenceClient;
      try {
        const hfModule = await import('@huggingface/inference');
        InferenceClient = hfModule.InferenceClient;
      } catch (importError) {
        throw new Error('HuggingFace InferenceClient not available. Install @huggingface/inference package.');
      }
      
      const client = new InferenceClient(this.apiKey);
      
      // Use text-to-image with a provider (as shown in HF docs)
      const image = await client.textToImage({
        model: this.imageModel,
        inputs: enhancedPrompt, // Use 'inputs' instead of 'prompt' for some providers
        parameters: {
          width: width,
          height: height,
          num_inference_steps: 4
        }
      });

      // Convert to buffer
      const imageBuffer = Buffer.from(await image.arrayBuffer());
      
      const key = `generated/${shortId}/scene-${sceneNumber}-${Date.now()}.png`;
      await storage.put(key, imageBuffer);

      return {
        key,
        model: this.imageModel,
        provider: 'huggingface-inference-client',
        cost: 0.01, // Estimated cost from free credits
        width,
        height,
        prompt: enhancedPrompt,
        originalPrompt: prompt,
        style,
        createdAt: new Date().toISOString(),
        sceneNumber,
        warning: 'Using HF InferenceClient ($0.10/month limit). Consider self-hosting for production.'
      };
      
    } catch (error) {
      console.error('HF InferenceClient failed:', error);
      
      if (error.message?.includes('not available') || error.message?.includes('Cannot find package')) {
        throw new Error('HuggingFace libraries not installed in Docker container. Package import failed.');
      }
      if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
        throw new Error('HF image generation rate limit exceeded. Free tier: $0.10/month.');
      }
      if (error.message?.includes('credits') || error.message?.includes('billing')) {
        throw new Error('HF credits exhausted. Free tier: $0.10/month limit reached.');
      }
      
      throw new Error(`Hugging Face image generation failed: ${error.message}`);
    }
  }

  /**
   * Build Marvel comic-style prompt enhancement
   * Optimized for FLUX.1-schnell
   */
  buildMarvelComicPrompt(basePrompt) {
    const comicEnhancements = [
      'Marvel Comics illustration style',
      'comic book panel', 
      'bold line art',
      'vibrant colors',
      'dynamic composition',
      'superhero comic art',
      'action-packed scene',
      'detailed comic book artwork'
    ];

    return `${basePrompt}, ${comicEnhancements.join(', ')}, high quality digital art`;
  }

  /**
   * Check if Hugging Face is available and configured
   */
  isAvailable() {
    return Boolean(this.apiKey);
  }

  /**
   * Get provider status and capabilities
   */
  getStatus() {
    return {
      available: this.isAvailable(),
      textModel: this.textModel,
      imageModel: this.imageModel,
      endpoint: this.baseUrl,
      monthlyBudget: this.maxMonthlyBudget,
      estimatedUsage: this.monthlyUsage,
      capabilities: {
        textGeneration: true,
        imageGeneration: true,
        comicStyle: true,
        costEffective: false, // Only $0.10/month free
        productionReady: false // Need self-hosting or paid tier
      },
      recommendations: {
        forProduction: 'Self-host Qwen3 + FLUX.1-schnell or upgrade to HF PRO',
        forDevelopment: 'Current setup is fine for testing',
        costOptimization: 'Use this as fallback only, primary should be OpenRouter or self-hosted'
      }
    };
  }
}

// Export singleton instance
export const huggingFaceProvider = new HuggingFaceProvider();