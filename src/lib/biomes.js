export const MAP_SIZE = 2500;
export const WATER_END_X = 760;
export const DESERT_START_X = 1740;
export const BIOME_BLEND = 90;

export function biomeAt(x) {
    if (x < WATER_END_X) return 'water';
    if (x > DESERT_START_X) return 'desert';
    return 'wasteland';
}

const between = (random, minimum, maximum) => random() * (maximum - minimum) + minimum;

export function generateBiomeFeatures(random) {
    const islands = Array.from({ length: 8 }, () => ({
        x: between(random, 110, WATER_END_X - 90),
        y: between(random, 100, MAP_SIZE - 100),
        radius: between(random, 38, 78),
        phase: random() * Math.PI * 2
    }));
    const currents = Array.from({ length: 5 }, (_, index) => ({
        x: between(random, 100, WATER_END_X - 90),
        y: 220 + index * 480 + between(random, -90, 90),
        radius: between(random, 85, 135),
        angle: between(random, -Math.PI, Math.PI),
        strength: between(random, 0.35, 0.65),
        phase: random() * Math.PI * 2
    }));
    const oases = Array.from({ length: 3 }, (_, index) => ({
        x: between(random, DESERT_START_X + 140, MAP_SIZE - 130),
        y: 420 + index * 760 + between(random, -130, 130),
        radius: between(random, 65, 95),
        phase: random() * Math.PI * 2
    }));
    const quicksand = Array.from({ length: 6 }, () => ({
        x: between(random, DESERT_START_X + 80, MAP_SIZE - 80),
        y: between(random, 90, MAP_SIZE - 90),
        radius: between(random, 55, 90),
        phase: random() * Math.PI * 2
    }));
    const dustDevils = Array.from({ length: 4 }, (_, index) => ({
        x: between(random, DESERT_START_X + 120, MAP_SIZE - 100),
        y: 300 + index * 590 + between(random, -100, 100),
        radius: between(random, 70, 105),
        direction: random() > 0.5 ? 1 : -1,
        phase: random() * Math.PI * 2
    }));
    const props = [];
    for (let index = 0; index < 54; index++) {
        props.push({
            biome: 'water', type: random() > 0.35 ? 'reed' : 'stone',
            x: between(random, 24, WATER_END_X - 24), y: between(random, 24, MAP_SIZE - 24),
            scale: between(random, 0.65, 1.35), phase: random() * Math.PI * 2
        });
        props.push({
            biome: 'desert', type: random() > 0.4 ? 'cactus' : 'bone',
            x: between(random, DESERT_START_X + 24, MAP_SIZE - 24), y: between(random, 24, MAP_SIZE - 24),
            scale: between(random, 0.65, 1.4), phase: random() * Math.PI * 2
        });
    }
    return { islands, currents, oases, quicksand, dustDevils, props };
}

export function pointInsideFeature(point, feature, inset = 0) {
    return (point.x - feature.x) ** 2 + (point.y - feature.y) ** 2 < Math.max(0, feature.radius - inset) ** 2;
}
