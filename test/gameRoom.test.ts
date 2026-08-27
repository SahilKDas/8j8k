import { EventEmitter } from 'node:events';
import assert from 'node:assert/strict';
import test from 'node:test';
import WebSocket from 'ws';
import { MAX_COINS, NPC_COUNT, WORLD_HALF } from '../shared/config.js';
import type { ServerMessage } from '../shared/types.js';
import { GameRoom } from '../server/gameRoom.js';

class FakeSocket extends EventEmitter {
  readyState: number = WebSocket.OPEN;
  sent: ServerMessage[] = [];
  send(raw: string): void { this.sent.push(JSON.parse(raw) as ServerMessage); }
  close(): void { this.readyState = WebSocket.CLOSED; this.emit('close'); }
}

function join(room: GameRoom, name = 'Tester<script>', color = '#60a5fa') {
  const socket = new FakeSocket();
  const id = room.register(socket as unknown as WebSocket);
  socket.emit('message', Buffer.from(JSON.stringify({ type: 'join', payload: { name, color } })));
  return { socket, id };
}

test('room starts with a full NPC roster and coin field', () => {
  const room = new GameRoom();
  assert.equal([...room.players.values()].filter((player) => player.npc).length, NPC_COUNT);
  assert.equal(room.coins.size, MAX_COINS);
  assert.ok(room.chests.size >= 30);
  room.stop();
});

test('joining returns a welcome snapshot with a sanitized player', () => {
  const room = new GameRoom();
  const { socket, id } = join(room);
  const welcome = socket.sent.find((message) => message.type === 'welcome');
  assert.ok(welcome && welcome.type === 'welcome');
  assert.equal(welcome.payload.selfId, id);
  assert.equal(welcome.payload.players.find((player) => player.id === id)?.name, 'Testerscript');
});

test('invalid colors fall back to the safe default', () => {
  const room = new GameRoom();
  const { id } = join(room, 'ColorTest', 'javascript:alert(1)');
  assert.equal(room.getSnapshotForTests(id)?.players.find((player) => player.id === id)?.color, '#f8fafc');
});

test('movement input advances a player and preserves world bounds', () => {
  let now = 1_000;
  const room = new GameRoom(() => now);
  const { socket, id } = join(room);
  const before = room.getSnapshotForTests(id)!.players.find((player) => player.id === id)!;
  socket.emit('message', Buffer.from(JSON.stringify({ type: 'input', payload: { up: false, down: false, left: false, right: true, angle: 0, attacking: false, sequence: 1 } })));
  now += 1_000;
  room.tick(1);
  const after = room.getSnapshotForTests(id)!.players.find((player) => player.id === id)!;
  assert.ok(after.x >= before.x);
  assert.ok(Math.abs(after.x) <= WORLD_HALF);
});

test('chat strips angle brackets and caps message length', () => {
  const room = new GameRoom();
  const { socket } = join(room, 'Chatter');
  socket.emit('message', Buffer.from(JSON.stringify({ type: 'chat', payload: `<b>${'x'.repeat(200)}</b>` })));
  const chat = [...socket.sent].reverse().find((message) => message.type === 'chat');
  assert.ok(chat && chat.type === 'chat');
  assert.ok(!chat.payload.text.includes('<'));
  assert.ok(chat.payload.text.length <= 120);
});

test('out-of-order movement packets are ignored', () => {
  let now = 5_000;
  const room = new GameRoom(() => now);
  const { socket, id } = join(room);
  socket.emit('message', Buffer.from(JSON.stringify({ type: 'input', payload: { up: false, down: false, left: false, right: true, angle: 0, attacking: false, sequence: 10 } })));
  socket.emit('message', Buffer.from(JSON.stringify({ type: 'input', payload: { up: false, down: false, left: true, right: false, angle: 0, attacking: false, sequence: 9 } })));
  const before = room.getSnapshotForTests(id)!.players.find((player) => player.id === id)!;
  now += 34; room.tick(1 / 30);
  const after = room.getSnapshotForTests(id)!.players.find((player) => player.id === id)!;
  assert.ok(after.x > before.x);
});

test('long-running combat simulation keeps loot population bounded', () => {
  let now = 10_000;
  const room = new GameRoom(() => now);
  for (let tick = 0; tick < 5_000; tick += 1) {
    now += 1_000 / 30;
    room.tick(1 / 30);
  }
  assert.ok(room.coins.size <= MAX_COINS + 250);
  const snapshot = room.getSnapshotForTests('npc-0')!;
  assert.ok(snapshot.players.every((player) => Math.abs(player.x) <= WORLD_HALF && Math.abs(player.y) <= WORLD_HALF));
});
