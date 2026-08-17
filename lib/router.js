import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { json, errorHandler } from './middleware.js';

export class Router {
  constructor() {
    this.routes = [];
    this.staticDir = null;
  }

  setStaticDir(dir) {
    this.staticDir = dir;
  }

  get(pattern, handler) {
    this.routes.push({ method: 'GET', pattern, handler });
  }

  post(pattern, handler) {
    this.routes.push({ method: 'POST', pattern, handler });
  }

  patch(pattern, handler) {
    this.routes.push({ method: 'PATCH', pattern, handler });
  }

  async handle(request, response, context = {}) {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      
      // Handle static files
      if (!url.pathname.startsWith('/api/') && this.staticDir) {
        return this.serveStatic(request, response, url.pathname);
      }

      // Find matching route
      for (const route of this.routes) {
        if (request.method !== route.method) continue;

        const match = this.matchRoute(url.pathname, route.pattern);
        if (match) {
          const enrichedContext = {
            ...context,
            params: match.params,
            query: Object.fromEntries(url.searchParams)
          };
          return await route.handler(request, response, enrichedContext);
        }
      }

      return json(response, 404, { error: 'Route not found.' });
    } catch (error) {
      return errorHandler(error, response);
    }
  }

  matchRoute(pathname, pattern) {
    if (typeof pattern === 'string') {
      return pathname === pattern ? { params: {} } : null;
    }

    if (pattern instanceof RegExp) {
      const match = pathname.match(pattern);
      if (!match) return null;

      const params = {};
      // Extract named capture groups
      if (match.groups) {
        Object.assign(params, match.groups);
      }
      // Extract numbered groups as positional params
      for (let i = 1; i < match.length; i++) {
        params[`param${i}`] = match[i];
      }
      
      return { params };
    }

    return null;
  }

  serveStatic(request, response, pathname) {
    const requested = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
    
    // Handle favicon.ico requests by serving the SVG version
    if (requested === '/favicon.ico') {
      return this.serveStatic(request, response, '/favicon.svg');
    }
    
    const target = path.resolve(this.staticDir, `.${requested}`);
    
    if (!target.startsWith(this.staticDir) || !existsSync(target)) {
      return json(response, 404, { error: 'Not found.' });
    }
    
    // For HTML files in development, inject hot reload script
    if (target.endsWith('.html') && process.env.NODE_ENV !== 'production') {
      return this.serveHTMLWithHotReload(response, target);
    }
    
    const extension = path.extname(target);
    const contentType = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.ico': 'image/x-icon'
    }[extension] || 'application/octet-stream';
    
    response.writeHead(200, { 'Content-Type': contentType });
    createReadStream(target).pipe(response);
  }

  async serveHTMLWithHotReload(response, target) {
    try {
      const { readFile } = await import('node:fs/promises');
      const { hotReloader } = await import('./hot-reload.js');
      
      let html = await readFile(target, 'utf8');
      const reloadScript = hotReloader.getReloadScript();
      
      // Inject hot reload script before closing body tag
      html = html.replace('</body>', `${reloadScript}</body>`);
      
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(html);
    } catch (error) {
      console.error('Error serving HTML with hot reload:', error);
      response.writeHead(500, { 'Content-Type': 'text/plain' });
      response.end('Internal Server Error');
    }
  }
}