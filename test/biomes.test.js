import assert from 'node:assert/strict';
import test from 'node:test';
import { DESERT_START_X, MAP_SIZE, WATER_END_X, biomeAt, generateBiomeFeatures } from '../src/lib/biomes.js';

test('the map has distinct water, wasteland, and desert sections', () => {
    assert.equal(biomeAt(0), 'water');
    assert.equal(biomeAt(WATER_END_X + 1), 'wasteland');
    assert.equal(biomeAt(DESERT_START_X + 1), 'desert');
});

test('biome gimmicks stay inside their intended map sections', () => {
    const features = generateBiomeFeatures(() => 0.5);
    assert.ok(features.islands.every((feature) => feature.x < WATER_END_X));
    assert.ok(features.currents.every((feature) => feature.x < WATER_END_X));
    assert.ok(features.oases.every((feature) => feature.x > DESERT_START_X));
    assert.ok(features.quicksand.every((feature) => feature.x > DESERT_START_X));
    assert.ok(features.props.every((feature) => feature.y >= 0 && feature.y <= MAP_SIZE));
});
