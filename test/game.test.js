import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameWorld } from '../server/game.js';
import { SCORE_TO_RESET, upgradeCost } from '../src/lib/game.js';

test('a joining player gets a sanitized identity and server-owned state', () => {
  const world = new GameWorld({ random: () => 0.5, botCount: 0 });
  const player = world.addHuman('one', '<b>Ace</b>');
  assert.equal(player.name, 'bAceb');
  assert.equal(player.score, 0);
  assert.equal(world.snapshot().players.length, 1);
});

test('input vectors are clamped and normalized', () => {
  const world = new GameWorld({ random: () => 0.5, botCount: 0 });
  const player = world.addHuman('one', 'Ace');
  world.setInput('one', { x: 99, y: 99, angle: 1.2 });
  assert.ok(Math.hypot(player.input.x, player.input.y) <= 1.00001);
  assert.equal(player.angle, 1.2);
});

test('upgrade purchases are validated on the server', () => {
  const world = new GameWorld({ random: () => 0.5, botCount: 0 });
  const player = world.addHuman('one', 'Ace');
  player.score = upgradeCost('speed', 0);
  assert.equal(world.buyUpgrade('one', 'speed'), true);
  assert.equal(player.upgrades.speed, 1);
  assert.equal(player.score, 0);
  assert.equal(world.buyUpgrade('one', 'speed'), false);
});

test('only a qualified player can reset the shared map', () => {
  const world = new GameWorld({ random: () => 0.5, botCount: 0 });
  const player = world.addHuman('one', 'Ace');
  assert.equal(world.resetMap('one'), false);
  player.score = SCORE_TO_RESET;
  assert.equal(world.resetMap('one'), true);
  assert.equal(world.mapVersion, 2);
  assert.equal(player.score, 0);
});

test('environment damage never corrupts scores when it kills a player', () => {
  const world = new GameWorld({ random: () => 0.5, botCount: 0 });
  const player = world.addHuman('one', 'Ace');
  world.damage(player, 1000, { id: 'lava' }, Date.now());
  assert.equal(player.dead, true);
  assert.equal(player.score, 0);
  assert.equal(Number.isNaN(player.score), false);
});
