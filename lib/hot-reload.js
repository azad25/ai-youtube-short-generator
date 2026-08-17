import { watch } from 'node:fs';
import { join } from 'node:path';
import { broadcast } from './sse.js';

export class HotReloader {
  constructor(options = {}) {
    this.watchPaths = options.watchPaths || ['./lib', './routes', './public'];
    this.debounceMs = options.debounceMs || 300;
    this.watchers = new Map();
    this.reloadTimeouts = new Map();
    this.isEnabled = process.env.NODE_ENV !== 'production';
  }

  start() {
    if (!this.isEnabled) {
      console.log(JSON.stringify({
        level: 'info',
        service: 'hot-reload',
        message: 'Hot reload disabled in production'
      }));
      return;
    }

    console.log(JSON.stringify({
      level: 'info',
      service: 'hot-reload',
      message: 'Starting hot reload watchers',
      paths: this.watchPaths
    }));

    for (const watchPath of this.watchPaths) {
      this.watchDirectory(watchPath);
    }

    // Also watch for frontend changes
    this.setupFrontendReload();
  }

  watchDirectory(directory) {
    try {
      const watcher = watch(directory, { recursive: true }, (eventType, filename) => {
        if (filename && this.shouldReload(filename)) {
          this.handleFileChange(directory, filename, eventType);
        }
      });

      this.watchers.set(directory, watcher);

      watcher.on('error', (error) => {
        console.error(JSON.stringify({
          level: 'error',
          service: 'hot-reload',
          message: `Watcher error for ${directory}`,
          error: error.message
        }));
      });

    } catch (error) {
      console.warn(JSON.stringify({
        level: 'warn',
        service: 'hot-reload',
        message: `Could not watch ${directory}`,
        error: error.message
      }));
    }
  }

  shouldReload(filename) {
    const skipPatterns = [
      /node_modules/,
      /\.git/,
      /\.log$/,
      /\.tmp$/,
      /~$/,
      /__pycache__/,
      /\.pyc$/
    ];

    return !skipPatterns.some(pattern => pattern.test(filename));
  }

  handleFileChange(directory, filename, eventType) {
    const key = `${directory}/${filename}`;
    
    // Clear existing timeout for this file
    if (this.reloadTimeouts.has(key)) {
      clearTimeout(this.reloadTimeouts.get(key));
    }

    // Debounce rapid file changes
    const timeout = setTimeout(() => {
      this.triggerReload(directory, filename, eventType);
      this.reloadTimeouts.delete(key);
    }, this.debounceMs);

    this.reloadTimeouts.set(key, timeout);
  }

  triggerReload(directory, filename, eventType) {
    console.log(JSON.stringify({
      level: 'info',
      service: 'hot-reload',
      message: 'File changed',
      directory,
      filename,
      eventType
    }));

    // Determine reload type based on file
    let reloadType = 'server';
    if (directory.includes('public')) {
      reloadType = 'client';
    } else if (filename.endsWith('.js') || filename.endsWith('.ts')) {
      reloadType = 'server';
    }

    // Broadcast reload event to connected clients
    broadcast('hot-reload', {
      type: reloadType,
      file: join(directory, filename),
      timestamp: Date.now()
    });

    // For server files, we rely on Node's --watch flag to restart
    // For client files, we notify the browser
  }

  setupFrontendReload() {
    // Add hot reload script injection for development
    if (this.isEnabled) {
      this.injectReloadScript = true;
    }
  }

  getReloadScript() {
    if (!this.isEnabled) return '';
    
    return `
    <script>
    (function() {
      let eventSource;
      let reconnectAttempts = 0;
      const maxReconnectAttempts = 10;
      
      function connect() {
        if (eventSource) {
          eventSource.close();
        }
        
        eventSource = new EventSource('/api/events');
        
        eventSource.addEventListener('hot-reload', function(event) {
          const data = JSON.parse(event.data);
          console.log('[Hot Reload]', data);
          
          if (data.type === 'client') {
            // Reload CSS without full page refresh
            if (data.file.endsWith('.css')) {
              reloadCSS();
            } else {
              // Full page reload for other client changes
              setTimeout(() => window.location.reload(), 100);
            }
          } else if (data.type === 'server') {
            // Server restarted, wait a moment then reload
            setTimeout(() => window.location.reload(), 500);
          }
        });
        
        eventSource.addEventListener('open', function() {
          console.log('[Hot Reload] Connected');
          reconnectAttempts = 0;
        });
        
        eventSource.addEventListener('error', function() {
          console.log('[Hot Reload] Connection lost, attempting to reconnect...');
          eventSource.close();
          
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            setTimeout(connect, Math.min(1000 * Math.pow(2, reconnectAttempts), 10000));
          }
        });
      }
      
      function reloadCSS() {
        const links = document.querySelectorAll('link[rel="stylesheet"]');
        links.forEach(link => {
          const href = link.href;
          const newHref = href.includes('?') 
            ? href.split('?')[0] + '?reload=' + Date.now()
            : href + '?reload=' + Date.now();
          link.href = newHref;
        });
      }
      
      // Start connection when DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', connect);
      } else {
        connect();
      }
    })();
    </script>`;
  }

  stop() {
    console.log(JSON.stringify({
      level: 'info',
      service: 'hot-reload',
      message: 'Stopping hot reload watchers'
    }));

    for (const [path, watcher] of this.watchers) {
      try {
        watcher.close();
      } catch (error) {
        console.warn(`Error closing watcher for ${path}:`, error.message);
      }
    }

    for (const timeout of this.reloadTimeouts.values()) {
      clearTimeout(timeout);
    }

    this.watchers.clear();
    this.reloadTimeouts.clear();
  }
}

// Singleton instance
export const hotReloader = new HotReloader({
  watchPaths: ['./lib', './routes', './public'],
  debounceMs: 300
});