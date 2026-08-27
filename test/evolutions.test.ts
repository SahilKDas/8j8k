import assert from 'node:assert/strict';
import test from 'node:test';
import { EVOLUTIONS, getAvailableEvolutions, getStats } from '../shared/evolutions.js';

test('all twelve combat evolutions are defined', () => {
  assert.equal(Object.keys(EVOLUTIONS).length, 12);
});

test('root evolution choice unlocks berserker and tank', () => {
  assert.deepEqual(getAvailableEvolutions(null, 600).map((entry) => entry.name).sort(), ['berserker', 'tank']);
});

test('root evolution choice remains locked below threshold', () => {
  assert.deepEqual(getAvailableEvolutions(null, 599), []);
});

test('berserker branches to knight and vampire', () => {
  assert.deepEqual(getAvailableEvolutions('berserker', 2_500).map((entry) => entry.name).sort(), ['knight', 'vampire']);
});

test('tank branches to rook and warrior', () => {
  assert.deepEqual(getAvailableEvolutions('tank', 2_500).map((entry) => entry.name).sort(), ['rook', 'warrior']);
});

test('ability stats override class defaults only while active', () => {
  assert.equal(getStats('berserker', false).speed, 1);
  assert.equal(getStats('berserker', true).speed, 1.6);
  assert.equal(getStats('vampire', true).leech, 0.65);
});

test('every class has a positive cooldown and duration', () => {
  for (const definition of Object.values(EVOLUTIONS)) {
    assert.ok(definition.abilityCooldown > 0);
    assert.ok(definition.abilityDuration > 0);
  }
});
