import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer, type ViteDevServer } from 'vite';
import { WebSocketServer } from 'ws';
import { GameRoom } from './gameRoom.js';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.env.PORT || 5173);
const isProduction = process.env.NODE_ENV === 'production';
const room = new GameRoom();
const wss = new WebSocketServer({ noServer: true });
let vite: ViteDevServer | undefined;

const mimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4'
};

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(value));
}

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (url.pathname === '/health') {
    json(response, 200, { ok: true, players: room.players.size, engine: 'phaser-4.2.1' });
    return;
  }
  if (url.pathname === '/api/serverinfo') {
    json(response, 200, { playerCount: room.players.size, capacity: 100, region: 'local', status: 'running' });
    return;
  }
  if (vite) {
    vite.middlewares(request, response, () => {
      if (!response.writableEnded) { response.statusCode = 404; response.end('Not found'); }
    });
    return;
  }
  serveStatic(url.pathname, response);
}

function serveStatic(pathname: string, response: ServerResponse): void {
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const distRoot = join(projectRoot, 'dist');
  let filePath = normalize(join(distRoot, relativePath));
  if (!filePath.startsWith(distRoot)) { response.statusCode = 403; response.end('Forbidden'); return; }
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) filePath = join(distRoot, 'index.html');
  if (!existsSync(filePath)) { response.statusCode = 503; response.end('Run npm run build first.'); return; }
  response.writeHead(200, { 'content-type': mimeTypes[extname(filePath)] || 'application/octet-stream' });
  createReadStream(filePath).pipe(response);
}

async function main(): Promise<void> {
  if (!isProduction) {
    vite = await createViteServer({ root: projectRoot, server: { middlewareMode: true }, appType: 'spa' });
  }
  const server = createServer((request, response) => void handleRequest(request, response));
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (url.pathname !== '/ws') { socket.destroy(); return; }
    wss.handleUpgrade(request, socket, head, (webSocket) => wss.emit('connection', webSocket, request));
  });
  wss.on('connection', (socket) => room.register(socket));
  room.start();
  server.listen(port, '0.0.0.0', () => console.log(`8j8k listening on http://localhost:${port} (${isProduction ? 'production' : 'development'})`));

  const shutdown = async () => {
    room.stop();
    wss.close();
    await vite?.close();
    server.close(() => process.exit(0));
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

void main();
