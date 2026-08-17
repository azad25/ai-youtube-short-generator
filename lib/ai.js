import { generateObject } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';

const sceneSchema = z.object({
  scene_number: z.number().int().positive(),
  start_time: z.number().nonnegative(),
  end_time: z.number().positive(),
  narration: z.string().min(1),
  caption: z.string().min(1),
  visual_description: z.string().min(1),
  image_prompt: z.string().min(1),
  status: z.string().min(1)
});

export const shortScriptSchema = z.object({
  title: z.string().min(1), hook: z.string().min(1), narration: z.string().min(1),
  duration_seconds: z.number().min(10).max(180),
  claims: z.array(z.object({ statement: z.string().min(1), evidence_ids: z.array(z.string()).min(1), classification: z.enum(['CONFIRMED', 'REPORTED', 'RUMORED', 'THEORY']) })).min(1),
  scenes: z.array(sceneSchema).min(1), youtube_description: z.string().min(1), hashtags: z.array(z.string())
});

const factReviewSchema = z.object({
  passed: z.boolean(), score: z.number().min(0).max(100),
  unsupportedClaims: z.array(z.string()), corrections: z.array(z.string())
});

function model(useHelper = false) {
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OpenRouter is not configured. Add OPENROUTER_API_KEY to .env and restart the server.');
  const modelName = useHelper && process.env.OPENROUTER_HELPER_MODEL 
    ? process.env.OPENROUTER_HELPER_MODEL 
    : (process.env.OPENROUTER_MODEL || 'qwen/qwen-2.5-72b-instruct');
  return createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })(modelName);
}

function measuredUsage(result) {
  const cost = Number(result.providerMetadata?.openrouter?.cost || 0);
  return { inputTokens: result.usage?.inputTokens ?? 0, outputTokens: result.usage?.outputTokens ?? 0, cost: Number.isFinite(cost) ? cost : 0 };
}

export async function generateEvidenceBoundScript({ system, prompt }) {
  const result = await generateObject({ model: model(false), schema: shortScriptSchema, system, prompt, temperature: 0.3 });
  return { object: result.object, usage: measuredUsage(result) };
}

export async function runAdversarialFactReview({ evidence, script }) {
  const result = await generateObject({
    model: model(false), schema: factReviewSchema,
    system: 'You are a hostile factuality reviewer. Find unsupported claims, wrong certainty levels, invented details, and unsupported chronology. Never improve wording. A claim is unsupported unless its cited evidence directly supports it.',
    prompt: `Evidence package:\n${JSON.stringify(evidence)}\n\nScript claims:\n${JSON.stringify(script.claims)}`,
    temperature: 0
  });
  return { object: result.object, usage: measuredUsage(result) };
}

export async function generateSimpleMetadata({ prompt }) {
  const result = await generateObject({
    model: model(true), // Use helper model for simple tasks
    schema: z.object({
      title: z.string(),
      description: z.string(),
      tags: z.array(z.string())
    }),
    prompt,
    temperature: 0.1
  });
  return { object: result.object, usage: measuredUsage(result) };
}
