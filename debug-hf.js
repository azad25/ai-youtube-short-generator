// Debug Hugging Face Router API
const HF_TOKEN = process.env.HF_TOKEN || process.env.HF_API_KEY;
const BASE_URL = 'https://router.huggingface.co/v1';

console.log('🔍 Debugging Hugging Face Router API');
console.log('Token available:', !!HF_TOKEN);
console.log('Token length:', HF_TOKEN?.length);
console.log('Base URL:', BASE_URL);

// Test 1: List available models
async function testModelsEndpoint() {
  try {
    console.log('\n📋 Testing /models endpoint...');
    const response = await fetch(`${BASE_URL}/models`, {
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
      }
    });
    
    console.log('Status:', response.status);
    if (response.ok) {
      const models = await response.json();
      console.log('Available models:', models.data?.slice(0, 3) || 'No models data');
    } else {
      const error = await response.text();
      console.log('Error:', error);
    }
  } catch (err) {
    console.error('Models test failed:', err.message);
  }
}

// Test 2: Text generation
async function testTextGeneration() {
  try {
    console.log('\n💬 Testing text generation...');
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'Qwen/Qwen2.5-Coder-7B-Instruct',
        messages: [{ role: 'user', content: 'Hello! Generate a short JSON response with just {"test": "success"}' }],
        max_tokens: 100,
        temperature: 0.1
      })
    });
    
    console.log('Status:', response.status);
    if (response.ok) {
      const result = await response.json();
      console.log('Text result:', result.choices?.[0]?.message?.content || result);
    } else {
      const error = await response.text();
      console.log('Text error:', error);
    }
  } catch (err) {
    console.error('Text test failed:', err.message);
  }
}

// Test 3: Image generation endpoints
async function testImageGeneration() {
  try {
    console.log('\n🖼️ Testing image generation /images/generations...');
    const response = await fetch(`${BASE_URL}/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'black-forest-labs/FLUX.1-schnell',
        prompt: 'A simple red circle on white background, minimalist',
        n: 1,
        size: '512x512',
        response_format: 'url'
      })
    });
    
    console.log('Image status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const result = await response.json();
      console.log('Image result keys:', Object.keys(result));
      console.log('Image result:', result);
    } else {
      const error = await response.text();
      console.log('Image error:', error);
    }
  } catch (err) {
    console.error('Image test failed:', err.message);
  }
}

// Test 4: Alternative image generation endpoint
async function testAlternativeImageGeneration() {
  try {
    console.log('\n🖼️ Testing alternative image generation /completions...');
    const response = await fetch(`${BASE_URL}/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'black-forest-labs/FLUX.1-schnell',
        prompt: 'A simple red circle on white background, minimalist',
        max_tokens: 1,
        response_format: 'b64_json'
      })
    });
    
    console.log('Alt image status:', response.status);
    const result = await response.text();
    console.log('Alt image result:', result);
  } catch (err) {
    console.error('Alt image test failed:', err.message);
  }
}

// Run all tests
async function runTests() {
  await testModelsEndpoint();
  await testTextGeneration();
  await testImageGeneration();
  await testAlternativeImageGeneration();
}

runTests().catch(console.error);