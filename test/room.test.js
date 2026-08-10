import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MultiplayerRoom, sanitizePlayerState } from '../server/room.js';

function socket() {
    return { readyState: 1, messages: [], send(payload) { this.messages.push(JSON.parse(payload)); }, close() {} };
}

test('player state is bounded before it is relayed', () => {
    const state = sanitizePlayerState({ name: '<Ace>', x: -10, y: 9000, health: 900, armor: 4 });
    assert.equal(state.name, 'Ace');
    assert.equal(state.x, 0);
    assert.equal(state.y, 2500);
    assert.equal(state.health, 300);
    assert.equal(state.armor, 0.6);
});

test('the room gives every player the shared map seed', () => {
    const room = new MultiplayerRoom({ random: () => 0.25 });
    const client = socket();
    room.connect('one', client);
    assert.equal(client.messages[0].type, 'welcome');
    assert.equal(client.messages[0].seed, room.seed);
});

test('hits require synchronized players in range and are rate limited', () => {
    const room = new MultiplayerRoom({ random: () => 0.25 });
    const attackerSocket = socket();
    const targetSocket = socket();
    room.connect('one', attackerSocket);
    room.connect('two', targetSocket);
    room.receive('one', JSON.stringify({ type: 'state', player: { x: 100, y: 100, swordLength: 35 } }));
    room.receive('two', JSON.stringify({ type: 'state', player: { x: 120, y: 100 } }));
    assert.equal(room.forwardHit(room.peers.get('one'), { targetId: 'two', amount: 35 }, 1000), true);
    assert.equal(room.forwardHit(room.peers.get('one'), { targetId: 'two', amount: 35 }, 1050), false);
    assert.equal(targetSocket.messages.at(-1).type, 'damage');
});

test('only a player at the V2 reset score can reset the shared map', () => {
    const room = new MultiplayerRoom({ random: () => 0.25 });
    const client = socket();
    room.connect('one', client);
    room.receive('one', JSON.stringify({ type: 'state', player: { score: 100 } }));
    assert.equal(room.reset(room.peers.get('one')), false);
    room.receive('one', JSON.stringify({ type: 'state', player: { score: 14500 } }));
    assert.equal(room.reset(room.peers.get('one')), true);
    assert.equal(client.messages.at(-1).type, 'resetMap');
});
