const subscribers = new Set();

export function broadcast(type, data) {
  const event = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const response of subscribers) {
    try {
      response.write(event);
    } catch (error) {
      // Remove dead connections
      subscribers.delete(response);
    }
  }
}

export function handleSSE(request, response) {
  response.writeHead(200, { 
    'Content-Type': 'text/event-stream', 
    'Cache-Control': 'no-cache', 
    Connection: 'keep-alive' 
  });
  
  response.write('event: connected\ndata: {"ok":true}\n\n');
  subscribers.add(response);
  
  request.on('close', () => subscribers.delete(response));
  request.on('error', () => subscribers.delete(response));
}

// Clean up orphaned connections periodically
setInterval(() => {
  for (const response of subscribers) {
    try {
      response.write('event: heartbeat\ndata: {}\n\n');
    } catch (error) {
      subscribers.delete(response);
    }
  }
}, 30000);

export { subscribers };