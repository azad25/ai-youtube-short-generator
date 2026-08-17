import { json } from '../lib/middleware.js';
import { SchedulerService } from '../lib/scheduler.js';

let schedulerService = null;

export function initializeScheduler(services) {
  if (!schedulerService) {
    schedulerService = new SchedulerService(services);
  }
  return schedulerService;
}

export async function getSchedulerStatusHandler(request, response) {
  try {
    if (!schedulerService) {
      return json(response, 200, {
        active: false,
        message: 'Scheduler not initialized'
      });
    }
    
    const status = schedulerService.getStatus();
    return json(response, 200, status);
  } catch (error) {
    return json(response, 500, { error: error.message });
  }
}

export async function startSchedulerHandler(request, response) {
  try {
    if (!schedulerService) {
      return json(response, 400, { error: 'Scheduler service not initialized' });
    }
    
    schedulerService.startDailySchedule();
    
    return json(response, 200, {
      message: 'Daily scheduler started successfully',
      status: schedulerService.getStatus()
    });
  } catch (error) {
    return json(response, 500, { error: error.message });
  }
}

export async function stopSchedulerHandler(request, response) {
  try {
    if (!schedulerService) {
      return json(response, 400, { error: 'Scheduler service not initialized' });
    }
    
    schedulerService.stop();
    
    return json(response, 200, {
      message: 'Scheduler stopped successfully'
    });
  } catch (error) {
    return json(response, 500, { error: error.message });
  }
}

export async function createTestScheduleHandler(request, response) {
  try {
    if (!schedulerService) {
      return json(response, 400, { error: 'Scheduler service not initialized' });
    }
    
    await schedulerService.createTestSchedule();
    
    return json(response, 200, {
      message: 'Test schedule created - 5 shorts will be processed over the next 15 minutes',
      status: schedulerService.getStatus()
    });
  } catch (error) {
    return json(response, 500, { error: error.message });
  }
}

export { schedulerService };