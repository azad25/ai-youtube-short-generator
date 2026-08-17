import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Core infrastructure
import { Router } from './lib/router.js';
import { StateManager, DatabaseService, QueueService } from './lib/services.js';
import { authMiddleware } from './lib/middleware.js';
import { handleSSE } from './lib/sse.js';
import { hotReloader } from './lib/hot-reload.js';

// Route handlers
import { healthHandler } from './routes/health.js';
import { getPromptsHandler, createPromptVersionHandler, PromptsService } from './routes/prompts.js';
import { BudgetService, getBudgetHandler, updateBudgetHandler } from './routes/budget.js';
import { 
  ShortsService, 
  getShortsHandler,
  getShortHandler, 
  createShortHandler, 
  researchHandler,
  getFactsHandler,
  generateScriptHandler,
  qaHandler,
  generateImageHandler,
  generateAudioHandler,
  renderHandler,
  publishHandler
} from './routes/shorts.js';
import { YouTubeService, getYouTubeStatusHandler, connectYouTubeHandler, youtubeCallbackHandler, disconnectYouTubeHandler, refreshChannelInfoHandler, refreshAccessTokenHandler } from './routes/youtube.js';
import { MusicRouteService, getMusicLibraryStatusHandler, generateMusicHandler, getLibraryMusicHandler, getMusicForShortHandler, refreshMusicLibraryHandler } from './routes/music.js';
import { BatchService, processBatchHandler } from './routes/batch.js';
import { ResearchService, searchRedditFactsHandler, enhanceEvidenceHandler, autoGenerateEvidenceHandler } from './routes/research.js';
import { initializeScheduler, getSchedulerStatusHandler, startSchedulerHandler, stopSchedulerHandler, createTestScheduleHandler } from './routes/scheduler.js';

// Load environment variables
async function loadEnv() {
  try {
    const { readFile } = await import('node:fs/promises');
    const env = await readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '.env'), 'utf8');
    for (const line of env.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
      }
    }
  } catch { /* .env is optional */ }
}

await loadEnv();

// Initialize services
const root = path.dirname(fileURLToPath(import.meta.url));
const runtimePath = path.join(root, 'data', 'runtime.json');

const stateManager = new StateManager(runtimePath);
const databaseService = process.env.DATABASE_URL ? new DatabaseService() : null;
const queueService = process.env.REDIS_URL ? new QueueService() : null;

// Initialize database if available
if (databaseService) {
  try {
    await databaseService.initialize();
    console.log(JSON.stringify({ 
      level: 'info', 
      service: 'shorts-factory', 
      message: 'Database initialized' 
    }));
  } catch (error) {
    console.error(JSON.stringify({ 
      level: 'error', 
      service: 'shorts-factory', 
      message: 'Database initialization failed', 
      error: error.message 
    }));
  }
}
// Initialize queue if available
if (queueService) {
  try {
    queueService.initialize();
    console.log(JSON.stringify({ 
      level: 'info', 
      service: 'shorts-factory', 
      message: 'Production queue initialized' 
    }));
  } catch (error) {
    console.error(JSON.stringify({ 
      level: 'error', 
      service: 'shorts-factory', 
      message: 'Queue initialization failed', 
      error: error.message 
    }));
  }
}

// Initialize business services
const promptsService = new PromptsService(stateManager);
const budgetService = new BudgetService({ stateManager, databaseService });
const shortsService = new ShortsService({ stateManager, databaseService, queueService, budgetService });
const youtubeService = new YouTubeService(stateManager);
const musicService = new MusicRouteService();
const batchService = new BatchService({ shortsService, queueService, budgetService });
const researchService = new ResearchService();

// Initialize scheduler service
const schedulerService = initializeScheduler({ 
  databaseService, 
  shortsService, 
  queueService,
  budgetService 
});

// Initialize music service
try {
  await musicService.initialize();
  console.log(JSON.stringify({ 
    level: 'info', 
    service: 'shorts-factory', 
    message: 'Music service initialized' 
  }));
} catch (error) {
  console.error(JSON.stringify({ 
    level: 'error', 
    service: 'shorts-factory', 
    message: 'Music service initialization failed', 
    error: error.message 
  }));
}

// Setup router
const router = new Router();
router.setStaticDir(path.join(root, 'public'));

// Create service context for all routes
const serviceContext = {
  stateManager,
  databaseService,
  queueService,
  promptsService,
  budgetService,
  shortsService,
  youtubeService,
  musicService,
  batchService,
  researchService,
  schedulerService
};

// Public routes
router.get('/api/health', healthHandler);

// Protected API routes with auth middleware
const authRoutes = [
  // Server-sent events
  { method: 'GET', pattern: '/api/events', handler: handleSSE },
  
  // Prompts management
  { method: 'GET', pattern: '/api/prompts', handler: getPromptsHandler },
  { method: 'POST', pattern: /^\/api\/prompts\/([^/]+)\/versions$/, handler: createPromptVersionHandler },
  
  // Budget management
  { method: 'GET', pattern: '/api/budget', handler: getBudgetHandler },
  { method: 'PATCH', pattern: '/api/budget', handler: updateBudgetHandler },
  
  // Shorts management
  { method: 'GET', pattern: '/api/shorts', handler: getShortsHandler },
  { method: 'GET', pattern: /^\/api\/shorts\/([^/]+)$/, handler: getShortHandler },
  { method: 'POST', pattern: '/api/shorts', handler: createShortHandler },
  { method: 'POST', pattern: /^\/api\/shorts\/([^/]+)\/research$/, handler: researchHandler },
  { method: 'GET', pattern: /^\/api\/shorts\/([^/]+)\/facts$/, handler: getFactsHandler },
  { method: 'POST', pattern: /^\/api\/shorts\/([^/]+)\/script$/, handler: generateScriptHandler },
  { method: 'POST', pattern: /^\/api\/shorts\/([^/]+)\/qa$/, handler: qaHandler },
  { method: 'POST', pattern: /^\/api\/shorts\/([^/]+)\/scenes\/(\d+)\/image$/, handler: generateImageHandler },
  { method: 'POST', pattern: /^\/api\/shorts\/([^/]+)\/audio$/, handler: generateAudioHandler },
  { method: 'POST', pattern: /^\/api\/shorts\/([^/]+)\/render$/, handler: renderHandler },
  { method: 'POST', pattern: /^\/api\/shorts\/([^/]+)\/publish$/, handler: publishHandler },
  
  // Batch processing
  { method: 'POST', pattern: '/api/batch', handler: processBatchHandler },
  
  // YouTube integration
  { method: 'GET', pattern: '/api/youtube/status', handler: getYouTubeStatusHandler },
  { method: 'POST', pattern: '/api/youtube/connect', handler: connectYouTubeHandler },
  { method: 'GET', pattern: '/api/youtube/callback', handler: youtubeCallbackHandler },
  { method: 'POST', pattern: '/api/youtube/disconnect', handler: disconnectYouTubeHandler },
  { method: 'POST', pattern: '/api/youtube/refresh', handler: refreshChannelInfoHandler },
  { method: 'POST', pattern: '/api/youtube/refresh-token', handler: refreshAccessTokenHandler },
  
  // Music integration
  { method: 'GET', pattern: '/api/music/status', handler: getMusicLibraryStatusHandler },
  { method: 'POST', pattern: '/api/music/generate', handler: generateMusicHandler },
  { method: 'GET', pattern: '/api/music/library', handler: getLibraryMusicHandler },
  { method: 'GET', pattern: /^\/api\/music\/shorts\/([^/]+)$/, handler: getMusicForShortHandler },
  { method: 'POST', pattern: '/api/music/refresh', handler: refreshMusicLibraryHandler },
  
  // Reddit research integration
  { method: 'GET', pattern: '/api/research/reddit', handler: searchRedditFactsHandler },
  { method: 'GET', pattern: /^\/api\/research\/enhance\/([^/]+)$/, handler: enhanceEvidenceHandler },
  { method: 'GET', pattern: '/api/research/auto-generate', handler: autoGenerateEvidenceHandler },
  
  // Scheduler management
  { method: 'GET', pattern: '/api/scheduler/status', handler: getSchedulerStatusHandler },
  { method: 'POST', pattern: '/api/scheduler/start', handler: startSchedulerHandler },
  { method: 'POST', pattern: '/api/scheduler/stop', handler: stopSchedulerHandler },
  { method: 'POST', pattern: '/api/scheduler/test', handler: createTestScheduleHandler }
];

// Register protected routes with auth middleware
authRoutes.forEach(route => {
  const wrappedHandler = async (request, response, context) => {
    // Apply auth middleware
    let authPassed = false;
    authMiddleware(request, response, () => { authPassed = true; });
    
    if (!authPassed) return; // Auth middleware already sent response
    
    // Extract route params for regex patterns
    if (route.pattern instanceof RegExp) {
      const match = new URL(request.url, `http://${request.headers.host}`).pathname.match(route.pattern);
      if (match) {
        const params = {};
        for (let i = 1; i < match.length; i++) {
          // Map to semantic param names
          if (route.pattern.source.includes('shorts')) {
            if (i === 1) params.shortId = match[i];
            if (i === 2) params.sceneNumber = match[i];
          } else if (route.pattern.source.includes('prompts') && i === 1) {
            params.promptId = match[i];
          } else {
            params[`param${i}`] = match[i];
          }
        }
        context = { ...context, params };
      }
    }
    
    return await route.handler(request, response, { ...serviceContext, ...context });
  };
  
  if (route.method === 'GET') {
    router.get(route.pattern, wrappedHandler);
  } else if (route.method === 'POST') {
    router.post(route.pattern, wrappedHandler);
  } else if (route.method === 'PATCH') {
    router.patch(route.pattern, wrappedHandler);
  }
});
// Create and start server
const port = Number(process.env.PORT || 3000);
const server = http.createServer(async (request, response) => {
  await router.handle(request, response, serviceContext);
});

// Start hot reload in development
if (process.env.NODE_ENV !== 'production') {
  hotReloader.start();
}

server.listen(port, () => {
  console.log(JSON.stringify({ 
    level: 'info', 
    service: 'shorts-factory', 
    message: `Listening on http://localhost:${port}` 
  }));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log(JSON.stringify({ 
    level: 'info', 
    service: 'shorts-factory', 
    message: 'SIGTERM received, shutting down gracefully' 
  }));
  
  hotReloader.stop();
  server.close(() => {
    console.log(JSON.stringify({ 
      level: 'info', 
      service: 'shorts-factory', 
      message: 'Server closed' 
    }));
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log(JSON.stringify({ 
    level: 'info', 
    service: 'shorts-factory', 
    message: 'SIGINT received, shutting down gracefully' 
  }));
  
  hotReloader.stop();
  server.close(() => {
    console.log(JSON.stringify({ 
      level: 'info', 
      service: 'shorts-factory', 
      message: 'Server closed' 
    }));
    process.exit(0);
  });
});