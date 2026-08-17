import { isAuthorized } from './security.js';

export function json(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(payload));
}

export async function body(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 1_000_000) throw new Error('Request body exceeds 1 MB.');
  }
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw new Error('Request body must be valid JSON.'); }
}

export function authMiddleware(request, response, next) {
  if (!isAuthorized(request, process.env)) {
    return json(response, 401, { error: 'Unauthorized.' });
  }
  next();
}

export function errorHandler(error, response) {
  console.error(JSON.stringify({ 
    level: 'error', 
    service: 'shorts-factory', 
    message: error.message,
    stack: error.stack
  }));
  
  return json(response, error.statusCode || 500, { 
    error: error.message || 'Unexpected server error.' 
  });
}