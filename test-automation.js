#!/usr/bin/env node

// Simple test script for end-to-end automation
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000/api';

async function api(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  
  const result = await response.json();
  if (!response.ok) {
    throw new Error(`API Error (${response.status}): ${result.error || 'Request failed'}`);
  }
  
  return result;
}

async function waitForServer() {
  console.log('⏳ Waiting for server to be ready...');
  
  for (let i = 0; i < 30; i++) {
    try {
      const health = await api('/health');
      if (health.service === 'Shorts Factory') {
        console.log('✅ Server is ready!');
        return;
      }
    } catch (error) {
      // Server not ready, wait
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error('Server failed to start within 60 seconds');
}

async function testCompleteAutomation() {
  try {
    await waitForServer();
    
    console.log('🚀 Starting complete automation test...\n');
    
    // Step 1: Check system health
    console.log('1️⃣ Checking system health...');
    const health = await api('/health');
    console.log(`   ✅ OpenRouter: ${health.configured.openRouter}`);
    console.log(`   ✅ Database: ${health.configured.database}`);
    console.log(`   ✅ Redis: ${health.configured.redis}`);
    console.log(`   ✅ YouTube: ${health.configured.youtube}`);
    console.log(`   ✅ Music: ${health.configured.music.aiEnabled}`);
    
    // Step 2: Check YouTube connection
    console.log('\n2️⃣ Checking YouTube connection...');
    const youtube = await api('/youtube/status');
    console.log(`   ✅ Connected: ${youtube.connected}`);
    console.log(`   ✅ Channel: ${youtube.channelInfo?.title || 'Unknown'}`);
    
    // Step 3: Create a short
    console.log('\n3️⃣ Creating new short...');
    const shortData = {
      topic: 'Avengers: Doomsday Trailer Analysis',
      contentType: 'Upcoming Movie',
      duration: 60,
      language: 'English',
      style: 'Cinematic',
      musicMode: 'AI Generate',
      musicMood: 'Dark / Cinematic',
      truthMode: 'FACTUAL',
      minimumSources: 2
    };
    
    const short = await api('/shorts', { 
      method: 'POST', 
      body: JSON.stringify(shortData) 
    });
    
    console.log(`   ✅ Short created: ${short.id}`);
    console.log(`   📝 Topic: ${short.topic}`);
    
    // Step 4: Add research evidence
    console.log('\n4️⃣ Adding research evidence...');
    const evidence = {
      sources: [
        {
          id: 'SRC-AUTO-TEST-1',
          title: 'Avengers: Doomsday Official Trailer',
          url: 'https://marvel.com/avengers-doomsday',
          tier: 1,
          type: 'Official'
        },
        {
          id: 'SRC-AUTO-TEST-2',
          title: 'Marvel Studios Phase 6 Announcement',
          url: 'https://marvelstudios.disney.com/news',
          tier: 1,
          type: 'Official'
        }
      ],
      facts: [
        {
          id: 'FACT-AUTO-TEST-1',
          statement: 'Avengers: Doomsday features Doctor Doom as the main villain',
          classification: 'CONFIRMED',
          sourceIds: ['SRC-AUTO-TEST-1', 'SRC-AUTO-TEST-2'],
          confidence: 0.95
        },
        {
          id: 'FACT-AUTO-TEST-2',
          statement: 'Robert Downey Jr returns to play Doctor Doom',
          classification: 'CONFIRMED',
          sourceIds: ['SRC-AUTO-TEST-1'],
          confidence: 0.90
        }
      ]
    };
    
    const researchResult = await api(`/shorts/${short.id}/research`, {
      method: 'POST',
      body: JSON.stringify(evidence)
    });
    
    console.log(`   ✅ Research added: ${evidence.sources.length} sources, ${evidence.facts.length} facts`);
    
    // Step 5: Generate script
    console.log('\n5️⃣ Generating script...');
    const scriptResult = await api(`/shorts/${short.id}/script?automation=true`, {
      method: 'POST'
    });
    
    if (scriptResult.script) {
      console.log(`   ✅ Script generated: "${scriptResult.script.title}"`);
      console.log(`   📜 Scenes: ${scriptResult.script.scenes?.length || 0}`);
    } else {
      console.log(`   ⏳ Script queued for background processing`);
    }
    
    console.log('\n🎉 Automation test completed successfully!');
    console.log(`📋 Short ID: ${short.id}`);
    console.log(`🔗 Test the UI at: http://localhost:3000`);
    
  } catch (error) {
    console.error('\n❌ Automation test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testCompleteAutomation();