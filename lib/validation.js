import { CONTENT_TYPES } from './prompts.js';

export function normalizeSource(input) {
  console.log('🔍 Normalizing source:', input);
  
  const title = String(input.title || '').trim();
  const url = String(input.url || '').trim();
  const tier = Number(input.tier);
  
  if (!title || !url || !/^https?:\/\//.test(url) || ![1, 2, 3, 4].includes(tier)) {
    const error = `Source validation failed: title="${title}", url="${url}", tier=${tier}`;
    console.error('❌ Source validation error:', error);
    throw new Error('Every source needs a title, http(s) URL, and tier from 1 to 4.');
  }
  
  const normalized = { 
    id: input.id || `SRC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, 
    title, 
    url, 
    tier, 
    type: String(input.type || 'Reporting').slice(0, 60), 
    publishedAt: input.publishedAt || null 
  };
  
  console.log('✅ Source normalized:', normalized);
  return normalized;
}

export function safeShort(input) {
  const topic = String(input.topic || '').trim();
  const contentType = String(input.contentType || '').trim();
  
  if (!topic || topic.length > 180) {
    throw new Error('Topic is required and must be at most 180 characters.');
  }
  
  if (!CONTENT_TYPES.includes(contentType)) {
    throw new Error('Choose a valid content type.');
  }
  
  const duration = Number(input.duration || 60);
  if (!Number.isInteger(duration) || duration < 10 || duration > 180) {
    throw new Error('Duration must be between 10 and 180 seconds.');
  }
  
  return {
    topic, 
    contentType, 
    duration,
    language: String(input.language || 'English').slice(0, 40),
    style: String(input.style || 'Cinematic').slice(0, 80),
    truthMode: ['FACTUAL', 'FACTUAL_REPORTED', 'THEORY', 'CREATIVE'].includes(input.truthMode) 
      ? input.truthMode 
      : 'FACTUAL',
    minimumSources: Math.max(1, Math.min(5, Number(input.minimumSources || 2))),
    sources: [], 
    facts: []
  };
}

export function validateBatchInput(input) {
  const topics = (input.topics || []).filter(Boolean).slice(0, 10); // Limit batch size
  
  if (topics.length === 0) {
    throw new Error('At least one topic is required for batch generation.');
  }
  
  return {
    topics,
    contentType: input.contentType || 'Upcoming Movie',
    duration: input.duration || 60,
    language: input.language || 'English',
    style: input.style || 'Cinematic',
    truthMode: input.truthMode || 'FACTUAL',
    minimumSources: input.minimumSources || 2
  };
}