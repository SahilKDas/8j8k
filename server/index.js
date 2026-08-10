import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { GameWorld } from './game.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT) || 5173;
const world = new GameWorld();
const sockets = new Map();
let vite;

if (!production) {
  const { createServer: createViteServer } = await import('vite');
  vite = await createViteServer({ root, server: { middlewareMode: true }, appType: 'spa' });
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon'
};

function serveProduction(request, response) {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true, players: sockets.size }));
    return;
  }
  const requested = request.url === '/' ? 'index.html' : request.url.split('?')[0].replace(/^\//, '');
  const safePath = normalize(requested).replace(/^(\.\.(\\|\/|$))+/, '');
  let filePath = join(root, 'dist', safePath);
  if (!existsSync(filePath)) filePath = join(root, 'dist', 'index.html');
  response.writeHead(200, { 'content-type': mimeTypes[extname(filePath)] || 'application/octet-stream' });
  createReadStream(filePath).pipe(response);
}

const server = createServer((request, response) => {
  if (production) serveProduction(request, response);
  else if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true, players: sockets.size }));
  } else vite.middlewares(request, response, () => {
    response.statusCode = 404;
    response.end('Not found');
  });
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
server.on('upgrade', (request, socket, head) => {
  if (new URL(request.url, 'http://localhost').pathname !== '/ws') return socket.destroy();
  wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws));
});

wss.on('connection', (socket) => {
  const id = `player_${crypto.randomUUID().slice(0, 8)}`;
  sockets.set(id, socket);
  socket.send(JSON.stringify({ type: 'welcome', id }));

  socket.on('message', (buffer) => {
    let message;
    try { message = JSON.parse(buffer.toString()); } catch { return; }
    if (!message || typeof message.type !== 'string') return;
    if (message.type === 'join') {
      if (!world.players.has(id)) world.addHuman(id, message.name);
    } else if (message.type === 'input') world.setInput(id, message);
    else if (message.type === 'action') world.action(id, message.kind);
    else if (message.type === 'upgrade') world.buyUpgrade(id, message.kind);
    else if (message.type === 'respawn') world.respawn(id);
    else if (message.type === 'reset') world.resetMap(id);
  });

  socket.on('close', () => {
    sockets.delete(id);
    world.removeHuman(id);
  });
  socket.on('error', () => {});
});

let previousTick = performance.now();
const tickTimer = setInterval(() => {
  const now = performance.now();
  world.tick((now - previousTick) / 1000, Date.now());
  previousTick = now;
}, 1000 / 30);

const broadcastTimer = setInterval(() => {
  if (!sockets.size) return;
  const message = JSON.stringify(world.snapshot());
  for (const socket of sockets.values()) if (socket.readyState === WebSocket.OPEN) socket.send(message);
}, 1000 / 15);

server.listen(port, '0.0.0.0', () => {
  console.log(`8j8k listening on http://localhost:${port} (${production ? 'production' : 'development'})`);
});

function shutdown() {
  clearInterval(tickTimer);
  clearInterval(broadcastTimer);
  for (const socket of sockets.values()) socket.close(1001, 'Server restarting');
  server.close(() => process.exit(0));
  vite?.close();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
