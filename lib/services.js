import { 
  initializeDatabase, 
  getShorts, 
  getShort, 
  saveShort, 
  saveSources, 
  saveFacts, 
  getBudgetSummary,
  recordBudgetUsage
} from './database.js';
import { createProductionQueue, enqueueShort } from './queue.js';

export class StateManager {
  constructor(runtimePath) {
    this.runtimePath = runtimePath;
    this.state = null;
  }

  async getState() {
    if (!this.state) {
      await this.loadState();
    }
    return this.state;
  }

  async loadState() {
    try {
      const { readFile } = await import('node:fs/promises');
      const data = await readFile(this.runtimePath, 'utf8');
      this.state = JSON.parse(data);
    } catch {
      this.state = await this.defaultState();
    }

    // Update budget with database if available
    if (process.env.DATABASE_URL && this.state.budget) {
      try {
        const budgetSummary = await getBudgetSummary();
        this.state.budget = {
          ...this.state.budget,
          spent: Number(budgetSummary.total_spent) || 0,
          completedShorts: Number(budgetSummary.shorts_with_costs) || 0
        };
      } catch (error) {
        console.warn('Could not load budget from database:', error.message);
      }
    }
  }

  async saveState(newState) {
    this.state = newState;
    const { mkdir, writeFile } = await import('node:fs/promises');
    const path = await import('node:path');
    
    await mkdir(path.dirname(this.runtimePath), { recursive: true });
    await writeFile(this.runtimePath, JSON.stringify(this.state, null, 2));
  }

  async defaultState() {
    const { PROMPT_TEMPLATES } = await import('./prompts.js');
    return {
      prompts: PROMPT_TEMPLATES.map((prompt) => ({ 
        ...prompt, 
        versions: [{ 
          version: prompt.currentVersion, 
          content: prompt.content, 
          createdAt: new Date().toISOString() 
        }] 
      })),
      youtube: null,
      budget: { 
        limit: 20, 
        spent: 0, 
        plannedShorts: 450, 
        completedShorts: 0, 
        reserve: 2, 
        imageCostCeiling: 0.009, 
        minimumImages: 2, 
        maximumImages: 5 
      }
    };
  }
}

export class DatabaseService {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (!this.initialized && process.env.DATABASE_URL) {
      await initializeDatabase();
      this.initialized = true;
    }
  }

  async getShorts() {
    await this.initialize();
    return await getShorts();
  }

  async getShort(id) {
    await this.initialize();
    return await getShort(id);
  }

  async saveShort(short) {
    await this.initialize();
    return await saveShort(short);
  }

  async saveSources(shortId, sources) {
    await this.initialize();
    return await saveSources(shortId, sources);
  }

  async saveFacts(shortId, facts) {
    await this.initialize();
    return await saveFacts(shortId, facts);
  }

  async getBudgetSummary() {
    await this.initialize();
    return await getBudgetSummary();
  }

  async recordBudgetUsage(operation, provider, cost, metadata) {
    await this.initialize();
    return await recordBudgetUsage(operation, provider, cost, metadata);
  }
}

export class QueueService {
  constructor() {
    this.queue = null;
  }

  initialize() {
    if (!this.queue && process.env.REDIS_URL) {
      const queueSetup = createProductionQueue();
      this.queue = queueSetup.queue;
    }
  }

  async enqueueShort(shortId, jobData = {}) {
    this.initialize();
    if (!this.queue) {
      throw new Error('Redis queue not available');
    }
    return await enqueueShort(this.queue, shortId, jobData);
  }
}