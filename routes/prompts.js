import { json, body } from '../lib/middleware.js';
import { PROMPT_TEMPLATES } from '../lib/prompts.js';

export class PromptsService {
  constructor(stateManager) {
    this.stateManager = stateManager;
  }

  async getPrompts() {
    const state = await this.stateManager.getState();
    return state.prompts || PROMPT_TEMPLATES;
  }

  async createPromptVersion(promptId, content) {
    const state = await this.stateManager.getState();
    const prompt = state.prompts.find(item => item.id === promptId);
    
    if (!prompt) {
      throw new Error('Prompt not found.');
    }

    if (!content?.trim()) {
      throw new Error('Prompt content is required.');
    }

    const version = prompt.currentVersion + 1;
    prompt.currentVersion = version;
    prompt.content = content;
    prompt.versions.push({ 
      version, 
      content, 
      createdAt: new Date().toISOString() 
    });

    await this.stateManager.saveState(state);
    return prompt;
  }
}

export async function getPromptsHandler(request, response, { promptsService }) {
  try {
    const prompts = await promptsService.getPrompts();
    return json(response, 200, prompts);
  } catch (error) {
    return json(response, 500, { error: error.message });
  }
}

export async function createPromptVersionHandler(request, response, { promptsService, params }) {
  try {
    const { promptId } = params;
    const input = await body(request);
    const updatedPrompt = await promptsService.createPromptVersion(promptId, input.content);
    return json(response, 201, updatedPrompt);
  } catch (error) {
    return json(response, error.message === 'Prompt not found.' ? 404 : 400, { error: error.message });
  }
}