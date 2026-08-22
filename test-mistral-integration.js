// Test Mistral integration for both text and image generation
import { mistralProvider } from './lib/mistral.js';

async function testMistralIntegration() {
  console.log('🎯 Testing Mistral integration...');
  console.log('Available:', mistralProvider.isAvailable());
  console.log('Status:', JSON.stringify(mistralProvider.getStatus(), null, 2));
  
  if (!mistralProvider.isAvailable()) {
    console.log('ℹ️ To enable Mistral, set MISTRAL_API_KEY in environment');
    console.log('ℹ️ Get free API key from: https://console.mistral.ai/');
    console.log('ℹ️ Remember to DISABLE pay-as-you-go to prevent charges');
    return;
  }
  
  try {
    // Test text generation
    console.log('\n📝 Testing Mistral text generation...');
    const textResult = await mistralProvider.generateText({
      prompt: 'Generate a short Marvel comic description for Thanos.',
      maxTokens: 100,
      temperature: 0.7
    });
    console.log('✅ Text generation successful:');
    console.log(textResult.substring(0, 200) + '...');
    
    // Test comic script generation
    console.log('\n📚 Testing Mistral comic script generation...');
    const scriptResult = await mistralProvider.generateComicScript({
      topic: 'Thanos Infinity Quest',
      contentType: 'Marvel Comics Short',
      duration: 24,
      evidence: 'Thanos seeks the Infinity Stones to balance the universe',
      language: 'English'
    });
    console.log('✅ Comic script generation successful:');
    console.log('Scenes:', scriptResult.scenes?.length);
    console.log('Title:', scriptResult.title);
    
    // Test image generation (agents)
    console.log('\n🎨 Testing Mistral image generation...');
    const imageResult = await mistralProvider.generateImage({
      prompt: 'Thanos Marvel comic book art, purple armor, cosmic background',
      shortId: 'test-mistral',
      sceneNumber: 1,
      style: 'marvel-comic'
    });
    console.log('✅ Image generation successful:');
    console.log('Key:', imageResult.key);
    console.log('Agent ID:', imageResult.agentId);
    console.log('Cost estimate:', imageResult.cost);
    
  } catch (error) {
    console.error('❌ Mistral test failed:', error.message);
    if (error.message.includes('usage') || error.message.includes('limit')) {
      console.log('💡 This is expected with Free mode usage limits');
      console.log('💡 Wait for limit reset or enable pay-as-you-go (not recommended)');
    }
  }
}

testMistralIntegration();