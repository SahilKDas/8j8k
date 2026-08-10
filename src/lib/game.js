export const MAP_SIZE = 2500;
export const PLAYER_RADIUS = 16;
export const SCORE_TO_RESET = 14500;
export const MAX_HP = 100;

export const WEAPONS = [
  { kills: 0, name: 'Iron sword', color: '#c8d0da', damage: 34 },
  { kills: 3, name: 'Steel scimitar', color: '#f1f5f9', damage: 40 },
  { kills: 7, name: 'Golden axe', color: '#f7c948', damage: 49 },
  { kills: 12, name: 'Diamond spear', color: '#5dd5f3', damage: 58 },
  { kills: 20, name: 'Obsidian blade', color: '#a78bfa', damage: 70 },
  { kills: 35, name: 'Void reaper', color: '#f472b6', damage: 88 }
];

export const UPGRADES = {
  speed: { label: 'Fleet foot', detail: '+8% movement', baseCost: 120, max: 5 },
  attack: { label: 'Quick hands', detail: '-8% cooldown', baseCost: 150, max: 5 },
  vitality: { label: 'Vital spark', detail: '+20 max health', baseCost: 180, max: 5 }
};

export const BOT_COLORS = {
  melee: '#ef7d57',
  tank: '#94a3b8',
  ranger: '#c084fc',
  healer: '#4ade80',
  thief: '#facc15'
};

export function upgradeCost(kind, level = 0) {
  const upgrade = UPGRADES[kind];
  return upgrade ? Math.round(upgrade.baseCost * (level + 1) * (1 + level * 0.45)) : Infinity;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function distanceSquared(a, b) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}
