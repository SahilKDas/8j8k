export const WORLD_SIZE = 15_000;
export const WORLD_HALF = WORLD_SIZE / 2;
export const SERVER_TICK_RATE = 30;
export const SNAPSHOT_RATE = 20;
export const PLAYER_RADIUS = 26;
export const BASE_SPEED = 330;
export const BASE_HEALTH = 100;
export const BASE_DAMAGE = 22;
export const BASE_SWORD_REACH = 92;
export const ATTACK_ARC = Math.PI * 0.72;
export const ATTACK_COOLDOWN = 440;
export const SWORD_SPIN_PER_TICK = Math.PI * 2 / SERVER_TICK_RATE;
export const THROW_COOLDOWN = 1_500;
export const SHURIKEN_SPEED = 720;
export const SHURIKEN_DAMAGE = 14;
export const SHURIKEN_COOLDOWN = 1_250;
export const SHURIKEN_LIFETIME = 2_200;
export const ABILITY_FALLBACK_COOLDOWN = 40_000;
export const NPC_COUNT = 20;
export const SHURIKEN_NPC_COUNT = 4;
export const MAX_COINS = 650;
export const MAX_CHAT_LENGTH = 120;

export const LEVELS = Array.from({ length: 35 }, (_, index) => {
  const level = index + 1;
  return {
    level,
    threshold: Math.round(20 * level ** 2.05),
    scale: 0.82 + Math.min(0.46, level * 0.014)
  };
});

export const CHEST_LIMITS = {
  normal: 18,
  uncommon: 8,
  rare: 5,
  epic: 3,
  legendary: 2,
  mythical: 1
} as const;

export const CHEST_STATS = {
  normal: { health: 4, value: 90, color: 0x8b5e3c },
  uncommon: { health: 7, value: 180, color: 0x4ade80 },
  rare: { health: 10, value: 330, color: 0x60a5fa },
  epic: { health: 14, value: 600, color: 0xc084fc },
  legendary: { health: 19, value: 1_050, color: 0xfbbf24 },
  mythical: { health: 28, value: 2_100, color: 0xf472b6 }
} as const;
