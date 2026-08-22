// Test HF Inference API for image generation
const HF_TOKEN = process.env.HF_TOKEN || process.env.HF_API_KEY;

async function testImageGeneration() {
  try {
    console.log('🖼️ Testing HF Inference API for FLUX.1-schnell...');
    console.log('Token length:', HF_TOKEN?.length);
    
    const response = await fetch('https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: 'Thanos Marvel comic book art, purple armor, Infinity Gauntlet glowing, cinematic scene, comic book panel, bold line art, vibrant colors',
        parameters: {
          width: 512,
          height: 512,
          num_inference_steps: 4,
          guidance_scale: 0.0
        }
      })
    }).catch(fetchError => {
      console.error('Fetch error:', fetchError.message);
      console.error('Fetch code:', fetchError.code);
      throw fetchError;
    });
    
    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const imageBuffer = await response.arrayBuffer();
      console.log('✅ Image generated successfully!');
      console.log('Image size:', imageBuffer.byteLength, 'bytes');
      
      // Save to test file
      const fs = await import('fs');
      fs.writeFileSync('test-image.png', Buffer.from(imageBuffer));
      console.log('💾 Saved test image as test-image.png');
      
    } else {
      const errorText = await response.text();
      console.log('❌ Error:', errorText);
      
      try {
        const errorJson = JSON.parse(errorText);
        console.log('Error details:', errorJson);
      } catch {
        // Not JSON
      }
    }
    
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    console.error('❌ Full error:', err);
  }
}

testImageGeneration();