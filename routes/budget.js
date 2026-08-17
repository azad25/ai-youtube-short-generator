import { json, body } from '../lib/middleware.js';

export class BudgetService {
  constructor({ stateManager, databaseService }) {
    this.stateManager = stateManager;
    this.databaseService = databaseService;
  }

  async getBudgetState() {
    const state = await this.stateManager.getState();
    let budget = state.budget || {
      limit: 20,
      spent: 0,
      plannedShorts: 450,
      completedShorts: 0,
      reserve: 2,
      imageCostCeiling: 0.009,
      minimumImages: 2,
      maximumImages: 5
    };

    // Update with actual database data if available
    if (this.databaseService) {
      try {
        const summary = await this.databaseService.getBudgetSummary();
        budget = {
          ...budget,
          spent: Number(summary.total_spent) || 0,
          completedShorts: Number(summary.shorts_with_costs) || 0
        };
      } catch (error) {
        console.warn('Could not load budget from database:', error.message);
      }
    }

    return budget;
  }

  async updateBudget(updates) {
    const state = await this.stateManager.getState();
    
    for (const key of ['limit', 'plannedShorts', 'completedShorts', 'reserve', 'imageCostCeiling', 'minimumImages', 'maximumImages']) {
      if (updates[key] !== undefined) {
        if (!Number.isFinite(Number(updates[key])) || Number(updates[key]) < 0) {
          throw new Error(`Invalid budget value for ${key}.`);
        }
      }
    }
    
    state.budget = { ...state.budget, ...updates };
    await this.stateManager.saveState(state);
    return state.budget;
  }

  async getStatus(contentType = 'Upcoming Movie') {
    return await this.budgetSnapshot(contentType);
  }

  async budgetSnapshot(contentType) {
    const budget = await this.getBudgetState();
    const remaining = Math.max(0, Number(budget.limit) - Number(budget.spent));
    const shortsRemaining = Math.max(1, Number(budget.plannedShorts) - Number(budget.completedShorts));
    const spendable = Math.max(0, remaining - Number(budget.reserve));
    const allowedPerShort = spendable / shortsRemaining;

    const IMAGE_COMPLEXITY = {
      'Character Explained': 2,
      'Story Explained': 4,
      Timeline: 3,
      'Ending Explained': 3,
      'Upcoming Movie': 3,
      Theory: 3,
      'Movie Connection': 3,
      'Plot Summary': 3
    };

    const preferredImages = Math.min(budget.maximumImages, Math.max(budget.minimumImages, IMAGE_COMPLEXITY[contentType] || 3));
    const affordableImages = Math.floor(allowedPerShort / budget.imageCostCeiling);
    const imageCount = Math.min(preferredImages, budget.maximumImages, Math.max(0, affordableImages));

    const plan = {
      imageCount,
      preferredImages,
      estimatedImageSpend: imageCount * budget.imageCostCeiling,
      canGenerate: imageCount >= budget.minimumImages,
      reason: imageCount >= budget.minimumImages ? 'Within the configured budget ceiling.' : 'Remaining budget cannot safely fund the minimum image plan.'
    };

    return {
      limit: Number(budget.limit),
      spent: Number(budget.spent),
      reserve: Number(budget.reserve),
      remaining,
      shortsRemaining,
      allowedPerShort,
      plan
    };
  }
}

export async function getBudgetHandler(request, response, { budgetService }) {
  try {
    const { searchParams } = new URL(request.url, `http://${request.headers.host}`);
    const contentType = searchParams.get('contentType') || 'Upcoming Movie';
    const status = await budgetService.budgetSnapshot(contentType);
    return json(response, 200, status);
  } catch (error) {
    return json(response, 500, { error: error.message });
  }
}

export async function updateBudgetHandler(request, response, { budgetService }) {
  try {
    const input = await body(request);
    const updated = await budgetService.updateBudget(input);
    const status = await budgetService.budgetSnapshot();
    return json(response, 200, status);
  } catch (error) {
    return json(response, 400, { error: error.message });
  }
}