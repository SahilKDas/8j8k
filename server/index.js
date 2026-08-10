import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { MultiplayerRoom } from './room.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT) || 5173;
const room = new MultiplayerRoom();
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
        response.end(JSON.stringify({ ok: true, players: room.size }));
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
    if (request.url === '/health') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ ok: true, players: room.size }));
    } else if (production) serveProduction(request, response);
    else vite.middlewares(request, response, () => {
        response.statusCode = 404;
        response.end('Not found');
    });
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
server.on('upgrade', (request, socket, head) => {
    if (new URL(request.url, 'http://localhost').pathname !== '/ws') return socket.destroy();
    wss.handleUpgrade(request, socket, head, (websocket) => wss.emit('connection', websocket));
});

wss.on('connection', (socket) => {
    const id = `player_${crypto.randomUUID().slice(0, 8)}`;
    room.connect(id, socket);
    socket.on('message', (buffer) => room.receive(id, buffer.toString()));
    socket.on('close', () => room.disconnect(id));
    socket.on('error', () => {});
});

const broadcastTimer = setInterval(() => room.broadcastRoster(), 50);

server.listen(port, '0.0.0.0', () => {
    console.log(`6j8k V2 listening on http://localhost:${port} (${production ? 'production' : 'development'})`);
});

function shutdown() {
    clearInterval(broadcastTimer);
    room.close();
    server.close();
    vite?.close();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
