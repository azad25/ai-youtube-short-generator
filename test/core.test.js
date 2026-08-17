import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPrompt } from '../lib/prompts.js';
import { validateShortScript, canTransition } from '../lib/schema.js';
import { buildRenderArgs } from '../lib/ffmpeg.js';
import { isAuthorized, safeFilename } from '../lib/security.js';
import { budgetSnapshot, recommendImagePlan } from '../lib/budget.js';
import { normalizeFact, reviewScriptClaims } from '../lib/factuality.js';
import { createOriginalMusicBrief, selectLibraryTrack } from '../lib/music.js';

test('renders known variables without losing unknown template variables', () => {
  assert.equal(renderPrompt('Hello {{topic}} {{missing}}', { topic: 'Doomsday' }), 'Hello Doomsday {{missing}}');
});

test('validates a structured script', () => {
  const script = { title: 'Title', hook: 'Hook', narration: 'Words', duration_seconds: 60, youtube_description: 'Description', hashtags: ['#movie'], claims: [{ statement: 'Verified statement', evidence_ids: ['FACT-1'], classification: 'CONFIRMED' }], scenes: [{ scene_number: 1, start_time: 0, end_time: 6, narration: 'Words', caption: 'Caption', visual_description: 'Visual', image_prompt: 'Prompt', status: 'pending' }] };
  assert.deepEqual(validateShortScript(script), { valid: true, errors: [] });
});

test('job states require valid transitions', () => {
  assert.equal(canTransition('DRAFT', 'QUEUED'), true);
  assert.equal(canTransition('DRAFT', 'PUBLISHED'), false);
});

test('builds ffmpeg arguments without a shell command', () => {
  const args = buildRenderArgs({ imagePaths: ['/tmp/one.png'], audioPath: '/tmp/voice.wav', outputPath: '/tmp/video.mp4' });
  assert.equal(args.includes('/tmp/video.mp4'), true);
  assert.equal(args.includes('ffmpeg'), false);
  assert.equal(args.some((arg) => arg.includes('&&') || arg.includes('|')), false);
});

test('supports optional API authentication and safe asset names', () => {
  assert.equal(isAuthorized({ headers: {} }, {}), true);
  assert.equal(isAuthorized({ headers: { authorization: 'Bearer good' } }, { APP_API_TOKEN: 'good' }), true);
  assert.equal(safeFilename('../../bad name.png'), 'bad_name.png');
});

test('budget controller protects its reserve and adapts image counts', () => {
  const budget = budgetSnapshot({ limit: 20, spent: 0, plannedShorts: 450, reserve: 2 });
  const plan = recommendImagePlan({ contentType: 'Upcoming Movie', budget, imageCostCeiling: 0.009 });
  assert.equal(plan.imageCount, 3);
  assert.equal(plan.canGenerate, true);
});

test('factuality gate requires cited, supported claims', () => {
  const facts = [normalizeFact({ id: 'FACT-1', statement: 'A verified announcement exists.', classification: 'CONFIRMED', sourceIds: ['A', 'B'], confidence: 0.95 })];
  assert.equal(reviewScriptClaims([{ statement: 'A verified announcement exists.', evidence_ids: ['FACT-1'], classification: 'CONFIRMED' }], facts).passed, true);
  assert.equal(reviewScriptClaims([{ statement: 'An invented plot event.', evidence_ids: [], classification: 'UNSUPPORTED' }], facts).passed, false);
});

test('music library only selects commercially licensed tracks and rejects imitation prompts', () => {
  const track = selectLibraryTrack([{ id: 'music-1', mood: 'Dark / Cinematic', durationSeconds: 60, licensedForCommercialUse: true }], { mood: 'Dark / Cinematic', durationSeconds: 30 });
  assert.equal(track.id, 'music-1');
  assert.throws(() => createOriginalMusicBrief({ mood: 'Dark / Cinematic', intensity: 75, durationSeconds: 30, referenceArtist: 'A composer' }));
});
