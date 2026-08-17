import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { safeFilename } from './security.js';

const storageRoot = path.resolve(process.env.STORAGE_PATH || './storage');

function target(key) {
  const safeKey = key.split('/').map(safeFilename).join('/');
  const resolved = path.resolve(storageRoot, safeKey);
  if (!resolved.startsWith(storageRoot)) throw new Error('Invalid storage key.');
  return resolved;
}

export const storage = {
  async put(key, content) { const file = target(key); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, content); return key; },
  async get(key) { return readFile(target(key)); },
  path(key) { return target(key); }
};
