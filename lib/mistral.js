import { storage } from './storage.js';

function required(name) { 
  if (!process.env[name]) throw new Error(`${name} is required.`); 
  return process.env[name]; 
}

/**
 * Mistral AI provider for text and image generation
 * 
 * Text: Uses direct chat completions API with excellent models
 * Images: Uses Mistral agents with image_generation tool (much better than HF's $0.10/month)
 * 
 * IMPORTANT: Make sure pay-as-you-go is DISABLED in Mistral settings to prevent unexpected charges.
 * Mistral Free mode provides API access with usage limits, shared across Studio/API/Vibe.
 */
export class MistralProvider {
  constructor() {
    this.apiKey = process.env.MISTRAL_API_KEY;
    this.backupKeys = process.env.MISTRAL_BACKUP_KEYS ? 
      process.env.MISTRAL_BACKUP_KEYS.split(',').map(k => k.trim()).filter(k => k) : [];
    this.allKeys = [this.apiKey, ...this.backupKeys].filter(Boolean);
    this.currentKeyIndex = 0;
    
    this.baseUrl = 'https://api.mistral.ai/v1';
    
    // Use the best available models
    this.textModel = process.env.MISTRAL_TEXT_MODEL || 'mistral-small-latest';
    this.reasoningModel = process.env.MISTRAL_REASONING_MODEL || 'mistral-large-latest';
    
    // For image generation via agents
    this.imageAgentModel = 'mistral-medium-latest'; // Agents need capable model
    this.imageAgent = null; // Cached agent instance
  }

  getCurrentApiKey() {
    if (this.allKeys.length === 0) return null;
    return this.allKeys[this.currentKeyIndex % this.allKeys.length];
  }

  rotateApiKey() {
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.allKeys.length;
    console.log(`🔄 Rotated to Mistral API key ${this.currentKeyIndex + 1}/${this.allKeys.length}`);
  }

  /**
   * Generate text using Mistral's excellent text models
   */
  async generateText({ prompt, maxTokens = 1000, temperature = 0.8, useReasoning = false }) {
    const currentKey = this.getCurrentApiKey();
    if (!currentKey) {
      throw new Error('MISTRAL_API_KEY is required for Mistral text generation');
    }

    const model = useReasoning ? this.reasoningModel : this.textModel;
    
    let lastError = null;
    for (let attempt = 0; attempt < this.allKeys.length; attempt++) {
      const apiKey = this.getCurrentApiKey();
      
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
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

        if (response.ok) {
          const result = await response.json();
          
          if (result.choices && result.choices[0]?.message?.content) {
            console.log(`✅ Mistral success with key ${this.currentKeyIndex + 1}`);
            return result.choices[0].message.content;
          } else {
            console.error('Unexpected Mistral response format:', result);
            throw new Error('Unexpected response format from Mistral');
          }
        } else {
          const error = await response.json().catch(() => ({ error: 'Unknown error' }));
          
          if (response.status === 429 || response.status === 402) {
            console.warn(`🔄 Mistral key ${this.currentKeyIndex + 1} exhausted, trying next...`);
            this.rotateApiKey();
            lastError = new Error(`Mistral usage exhausted: ${error.error || response.statusText}`);
            continue;
          }
          
          throw new Error(`Mistral text generation failed: ${error.error || response.statusText}`);
        }
      } catch (fetchError) {
        if (attempt < this.allKeys.length - 1) {
          console.warn(`🔄 Mistral key ${this.currentKeyIndex + 1} failed, trying next:`, fetchError.message);
          this.rotateApiKey();
          lastError = fetchError;
          continue;
        }
        throw fetchError;
      }
    }
    
    throw lastError || new Error('All Mistral API keys exhausted');
  }

  /**
   * Generate Marvel comic-style script using Mistral models
   */
  async generateComicScript({ topic, contentType, duration, evidence, language = 'English' }) {
    const prompt = `You are a Marvel Comics expert script writer. Generate a ${duration}-second comic script with exactly 9 scenes (3 per composite image).

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
      console.log('🎯 Using Mistral for script generation (Free mode with usage limits)');
      
      const response = await this.generateText({ 
        prompt, 
        maxTokens: 2000, 
        temperature: 0.7,
        useReasoning: true // Use better model for scripts
      });
      
      // Clean up response and extract JSON
      let cleanResponse = response.trim();
      
      // Remove common prefixes/suffixes
      cleanResponse = cleanResponse.replace(/^.*?(\{)/s, '$1');
      cleanResponse = cleanResponse.replace(/(\}).*$/s, '$1');
      
      // Parse JSON
      try {
        const scriptData = JSON.parse(cleanResponse);
        
        // Validate structure
        if (!scriptData.scenes || !Array.isArray(scriptData.scenes)) {
          throw new Error('Invalid script structure: missing scenes array');
        }
        
        return scriptData;
      } catch (parseError) {
        console.error('JSON parsing failed, response was:', cleanResponse);
        throw new Error('Failed to parse JSON from Mistral model. Try again.');
      }
      
    } catch (error) {
      console.error('Mistral script generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate Marvel comic-style images using Mistral Agents with image_generation tool
   * This is MUCH better than HuggingFace's $0.10/month limit!
   */
  async generateImage({ prompt, shortId, sceneNumber, width = 1024, height = 1024, style = 'cinematic' }) {
    if (!this.apiKey) {
      throw new Error('MISTRAL_API_KEY is required for Mistral image generation');
    }

    try {
      // Import Mistral SDK with better error handling
      let Mistral;
      try {
        const mistralModule = await import('@mistralai/mistralai');
        Mistral = mistralModule.Mistral;
      } catch (importError) {
        throw new Error('Mistral SDK not available. Install @mistralai/mistralai package.');
      }
      
      const client = new Mistral({
        apiKey: this.apiKey
      });

      // Create or reuse image generation agent
      if (!this.imageAgent) {
        console.log('🤖 Creating Mistral image generation agent...');
        
        this.imageAgent = await client.beta.agents.create({
          model: this.imageAgentModel,
          name: "Marvel Shorts Image Generator",
          description: "Generate cinematic Marvel comic-style images for YouTube Shorts",
          instructions: "Generate high-quality, cinematic Marvel comic book art images from user descriptions. Use dramatic lighting, bold colors, and dynamic composition typical of Marvel Comics. Output should be suitable for vertical video content.",
          tools: [
            {
              type: "image_generation"
            }
          ]
        });
        
        console.log('✅ Mistral image agent created:', this.imageAgent.id);
      }

      // Enhance prompt for Marvel comic style
      let enhancedPrompt = prompt;
      if (style === 'comic' || style === 'marvel-comic') {
        enhancedPrompt = this.buildMarvelComicPrompt(prompt);
      }

      console.log('🎨 Generating image with Mistral agent...');
      console.log('💰 Using Mistral Free mode (much better than HF\'s $0.10/month limit!)');

      // Start conversation with the agent
      const response = await client.beta.conversations.start({
        agentId: this.imageAgent.id,
        inputs: [
          {
            role: 'user',
            content: enhancedPrompt
          }
        ]
      });

      // Find generated image file chunks
      let imageBuffer = null;
      let fileId = null;
      
      for (const chunk of response.outputs ?? []) {
        for (const item of chunk.content ?? []) {
          if (item.fileId) {
            fileId = item.fileId;
            console.log('📁 Downloading generated image file:', fileId);
            
            const file = await client.files.download({
              fileId: item.fileId
            });

            // Handle different response types from Mistral API
            if (Buffer.isBuffer(file)) {
              imageBuffer = file;
            } else if (file && typeof file.arrayBuffer === 'function') {
              imageBuffer = Buffer.from(await file.arrayBuffer());
            } else if (file && file.data) {
              imageBuffer = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data);
            } else if (file && file.buffer) {
              imageBuffer = Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer);  
            } else {
              // Try treating as array buffer or raw data
              try {
                imageBuffer = Buffer.from(file);
              } catch (bufferError) {
                console.error('Failed to convert file to buffer:', typeof file, Object.keys(file || {}));
                throw new Error(`Cannot convert Mistral file response to buffer: ${bufferError.message}`);
              }
            }
            
            console.log('✅ Image buffer created, size:', imageBuffer.length, 'bytes');
            break;
          }
        }
        if (imageBuffer) break;
      }

      if (!imageBuffer) {
        throw new Error('No image was generated by Mistral agent. Try again or check usage limits.');
      }

      // Save to storage
      const key = `generated/${shortId}/scene-${sceneNumber}-${Date.now()}.png`;
      await storage.put(key, imageBuffer);

      return {
        key,
        model: this.imageAgentModel,
        provider: 'mistral-agent',
        cost: 0.02, // Estimated cost from free allowance 
        width,
        height,
        prompt: enhancedPrompt,
        originalPrompt: prompt,
        style,
        createdAt: new Date().toISOString(),
        sceneNumber,
        agentId: this.imageAgent.id,
        fileId: fileId,
        note: 'Generated using Mistral Free mode. Ensure pay-as-you-go is DISABLED to prevent charges.'
      };
      
    } catch (error) {
      console.error('Mistral image generation failed:', error);
      
      if (error.message?.includes('usage') || error.message?.includes('limit')) {
        throw new Error('Mistral Free mode usage limit reached. Wait for reset or enable pay-as-you-go.');
      }
      if (error.message?.includes('agent')) {
        // Reset agent and retry once
        this.imageAgent = null;
        throw new Error('Mistral agent error. Try again to recreate agent.');
      }
      
      throw new Error(`Mistral image generation failed: ${error.message}`);
    }
  }

  /**
   * Build Marvel comic-style prompt enhancement
   */
  buildMarvelComicPrompt(basePrompt) {
    const comicEnhancements = [
      'Marvel Comics illustration style',
      'authentic comic book art by Jack Kirby and Steve Ditko',
      'bold line art with Ben-Day dots',
      'vibrant comic book colors',
      'dynamic superhero perspective',
      'dramatic comic book lighting',
      'action-packed composition',
      'classic Marvel comic book panel',
      'vertical aspect ratio for mobile'
    ];

    return `${basePrompt}, ${comicEnhancements.join(', ')}, masterpiece comic book artwork, 4K quality`;
  }

  /**
   * Check if Mistral is available and configured
   */
  isAvailable() {
    return Boolean(this.getCurrentApiKey());
  }

  /**
   * Get provider status and capabilities
   */
  getStatus() {
    return {
      available: this.isAvailable(),
      textModel: this.textModel,
      reasoningModel: this.reasoningModel,
      imageAgentModel: this.imageAgentModel,
      endpoint: this.baseUrl,
      capabilities: {
        textGeneration: true,
        imageGeneration: true, // ✅ NOW SUPPORTED!
        comicStyle: true,
        reasoning: true,
        costEffective: true, // Much better than HF's $0.10/month
        productionReady: true // For Free mode usage limits
      },
      recommendations: {
        forProduction: 'Excellent for free tier. Ensure pay-as-you-go is DISABLED.',
        forDevelopment: 'Perfect for development and testing',
        costOptimization: 'Much better free allowance than HuggingFace'
      },
      warnings: [
        'Disable pay-as-you-go in Mistral settings to prevent unexpected charges',
        'Usage limits are shared across Studio, API, and Vibe',
        'When allowance is exhausted, access may stop until reset'
      ]
    };
  }
}

// Export singleton instance
export const mistralProvider = new MistralProvider();