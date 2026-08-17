import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export function createProductionQueue() {
  if (!process.env.REDIS_URL) throw new Error('REDIS_URL is required before unattended jobs can run.');
  const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  return { connection, queue: new Queue('shorts-pipeline', { connection }) };
}

export async function enqueueShort(queue, shortId, jobData = {}) {
  const data = { shortId, ...jobData };
  return queue.add('produce-short', data, { attempts: 3, backoff: { type: 'exponential', delay: 10_000 }, removeOnComplete: 200, removeOnFail: 500 });
}
