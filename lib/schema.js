export const JOB_TRANSITIONS = {
  DRAFT: ['QUEUED', 'CANCELLED'],
  QUEUED: ['RESEARCHING', 'CANCELLED'],
  RESEARCHING: ['GENERATING_SCRIPT', 'FAILED'],
  GENERATING_SCRIPT: ['GENERATING_SCENES', 'FAILED'],
  GENERATING_SCENES: ['GENERATING_IMAGES', 'FAILED'],
  GENERATING_IMAGES: ['GENERATING_AUDIO', 'FAILED'],
  GENERATING_AUDIO: ['RENDERING', 'FAILED'],
  RENDERING: ['QA', 'FAILED'],
  QA: ['READY', 'FAILED'],
  READY: ['SCHEDULED', 'UPLOADING', 'CANCELLED'],
  SCHEDULED: ['UPLOADING', 'CANCELLED', 'FAILED'],
  UPLOADING: ['PUBLISHED', 'FAILED'],
  PUBLISHED: [],
  FAILED: ['QUEUED', 'CANCELLED'],
  CANCELLED: []
};

export function canTransition(from, to) {
  return JOB_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validateShortScript(value) {
  const errors = [];
  if (!value || typeof value !== 'object') return { valid: false, errors: ['Response must be an object.'] };
  for (const field of ['title', 'hook', 'narration', 'youtube_description']) {
    if (typeof value[field] !== 'string' || !value[field].trim()) errors.push(`${field} must be a non-empty string.`);
  }
  if (!Number.isFinite(value.duration_seconds) || value.duration_seconds < 10 || value.duration_seconds > 180) errors.push('duration_seconds must be between 10 and 180.');
  if (!Array.isArray(value.hashtags) || !value.hashtags.every((tag) => typeof tag === 'string')) errors.push('hashtags must be an array of strings.');
  if (!Array.isArray(value.claims) || value.claims.length < 1) errors.push('claims must contain cited factual statements.');
  for (const [index, claim] of (value.claims || []).entries()) {
    if (typeof claim?.statement !== 'string' || !claim.statement.trim()) errors.push(`claim ${index + 1}: statement is required.`);
    if (!Array.isArray(claim?.evidence_ids) || claim.evidence_ids.length < 1) errors.push(`claim ${index + 1}: at least one evidence ID is required.`);
    if (typeof claim?.classification !== 'string') errors.push(`claim ${index + 1}: classification is required.`);
  }
  if (!Array.isArray(value.scenes) || value.scenes.length < 1) errors.push('scenes must contain at least one scene.');
  for (const [index, scene] of (value.scenes || []).entries()) {
    for (const field of ['scene_number', 'start_time', 'end_time', 'narration', 'caption', 'visual_description', 'image_prompt', 'status']) {
      if (scene?.[field] === undefined || scene[field] === '') errors.push(`scene ${index + 1}: ${field} is required.`);
    }
    if (scene && (!Number.isFinite(scene.start_time) || !Number.isFinite(scene.end_time) || scene.end_time <= scene.start_time)) errors.push(`scene ${index + 1}: invalid timing.`);
  }
  return { valid: errors.length === 0, errors };
}
