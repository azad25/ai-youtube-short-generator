import { json, body } from '../lib/middleware.js';
import { validateBatchInput, safeShort } from '../lib/validation.js';

export class BatchService {
  constructor({ shortsService, queueService, budgetService }) {
    this.shortsService = shortsService;
    this.queueService = queueService;
    this.budgetService = budgetService;
  }

  async processBatch(batchInput) {
    if (!this.queueService || !this.shortsService.databaseService) {
      throw new Error('Batch processing requires database and Redis queue setup.');
    }

    const input = validateBatchInput(batchInput);
    const batchShorts = [];

    for (const topic of input.topics) {
      const shortData = safeShort({
        topic: topic.trim(),
        contentType: input.contentType,
        duration: input.duration,
        language: input.language,
        style: input.style,
        truthMode: input.truthMode,
        minimumSources: input.minimumSources
      });

      const budget = await this.budgetService.budgetSnapshot(shortData.contentType);
      if (!budget.plan.canGenerate) {
        const error = new Error(`Budget exceeded for topic: ${topic}`);
        error.statusCode = 402;
        error.budget = budget;
        throw error;
      }

      shortData.budgetPlan = budget.plan;
      const short = await this.shortsService.createShort(shortData);
      batchShorts.push(short);

      // Queue each short for processing
      await this.queueService.enqueueShort(short.id);
    }

    return batchShorts;
  }
}

export async function processBatchHandler(request, response, { batchService }) {
  try {
    const input = await body(request);
    const batchShorts = await batchService.processBatch(input);

    return json(response, 202, {
      message: `${batchShorts.length} shorts queued for batch processing`,
      shorts: batchShorts
    });
  } catch (error) {
    return json(response, error.statusCode || 400, { 
      error: error.message,
      budget: error.budget
    });
  }
}