import type { EvolutionName } from './types.js';

export interface StatMultipliers {
  maxHealth: number;
  speed: number;
  scale: number;
  power: number;
  resistance: number;
  damage: number;
  attackSpeed: number;
  regen: number;
  throwCooldown: number;
  throwDamage: number;
  leech: number;
}

export interface EvolutionDefinition {
  name: EvolutionName;
  label: string;
  description: string;
  color: string;
  unlockAt: number;
  parents: Array<EvolutionName | 'root'>;
  abilityName: string;
  abilityDuration: number;
  abilityCooldown: number;
  stats: Partial<StatMultipliers>;
  ability: Partial<StatMultipliers>;
}

export const BASE_STATS: StatMultipliers = {
  maxHealth: 1, speed: 1, scale: 1, power: 1, resistance: 1,
  damage: 1, attackSpeed: 1, regen: 1, throwCooldown: 1, throwDamage: 1, leech: 0
};

export const EVOLUTIONS: Record<EvolutionName, EvolutionDefinition> = {
  berserker: { name: 'berserker', label: 'Berserker', description: 'Aggressive melee fighter with a brutal frenzy.', color: '#ef4444', unlockAt: 600, parents: ['root'], abilityName: 'Blood Frenzy', abilityDuration: 10_000, abilityCooldown: 60_000, stats: { damage: 1.25, resistance: 1.1 }, ability: { speed: 1.6, power: 1.8, damage: 1.6, attackSpeed: 2 } },
  tank: { name: 'tank', label: 'Tank', description: 'Slower, larger and extremely difficult to bring down.', color: '#60a5fa', unlockAt: 600, parents: ['root'], abilityName: 'Fortress', abilityDuration: 5_000, abilityCooldown: 60_000, stats: { maxHealth: 1.6, speed: 0.75, scale: 1.25, power: 1.25, resistance: 2 }, ability: { scale: 1.75, power: 1.75, damage: 2, attackSpeed: 2, regen: 5 } },
  knight: { name: 'knight', label: 'Knight', description: 'Balanced duelist with a lightning-fast charge.', color: '#94a3b8', unlockAt: 2_500, parents: ['berserker'], abilityName: 'Gallant Charge', abilityDuration: 10_000, abilityCooldown: 50_000, stats: { speed: 1.1, power: 1.1, resistance: 0.9 }, ability: { speed: 2, power: 0.7, resistance: 0.2, damage: 1.5, attackSpeed: 2.5 } },
  vampire: { name: 'vampire', label: 'Vampire', description: 'Fast hunter who restores health by dealing damage.', color: '#c026d3', unlockAt: 2_500, parents: ['berserker'], abilityName: 'Crimson Feast', abilityDuration: 7_000, abilityCooldown: 35_000, stats: { maxHealth: 0.85, speed: 1.2, scale: 1.15, resistance: 0.7, attackSpeed: 1.18, leech: 0.25 }, ability: { leech: 0.65, speed: 1.8, resistance: 1.5 } },
  warrior: { name: 'warrior', label: 'Warrior', description: 'Armored bruiser built around unstoppable momentum.', color: '#f97316', unlockAt: 2_500, parents: ['tank'], abilityName: 'War Cry', abilityDuration: 5_000, abilityCooldown: 100_000, stats: { maxHealth: 1.05, speed: 0.9, scale: 1.15, resistance: 3, damage: 1.5 }, ability: { scale: 2.5, power: 5, damage: 2, resistance: 5, speed: 2.7, regen: 3 } },
  rook: { name: 'rook', label: 'Rook', description: 'A living bulwark that controls space.', color: '#64748b', unlockAt: 2_500, parents: ['tank'], abilityName: 'Castle Breaker', abilityDuration: 8_000, abilityCooldown: 50_000, stats: { maxHealth: 1.4, speed: 0.8, scale: 1.3, resistance: 3.2, damage: 1.6, attackSpeed: 0.77 }, ability: { scale: 1.6, power: 1.75, attackSpeed: 1.85, speed: 1.6, regen: 2 } },
  archer: { name: 'archer', label: 'Archer', description: 'Fragile ranged specialist with devastating throws.', color: '#22c55e', unlockAt: 6_000, parents: ['knight', 'vampire'], abilityName: 'Arrow Storm', abilityDuration: 5_000, abilityCooldown: 80_000, stats: { maxHealth: 0.4, power: 1.3, resistance: 0.5, damage: 0.75, throwCooldown: 0.7, throwDamage: 4 }, ability: { speed: 1.3, scale: 0.7, power: 3, resistance: 0.2, throwCooldown: 0.15, throwDamage: 6 } },
  samurai: { name: 'samurai', label: 'Samurai', description: 'Disciplined heavy blade with a decisive stance.', color: '#e11d48', unlockAt: 6_000, parents: ['knight', 'warrior', 'rook'], abilityName: 'Shogun Stance', abilityDuration: 8_000, abilityCooldown: 70_000, stats: { maxHealth: 1.6, speed: 1.2, scale: 1.3, resistance: 3, damage: 1.3, attackSpeed: 0.67 }, ability: { scale: 1.6, power: 1.5, damage: 1.5, attackSpeed: 1.67, resistance: 1, speed: 1.5, regen: 3 } },
  lumberjack: { name: 'lumberjack', label: 'Lumberjack', description: 'Chest-breaking powerhouse with enormous single hits.', color: '#a16207', unlockAt: 6_000, parents: ['vampire', 'warrior', 'rook'], abilityName: 'Timber', abilityDuration: 5_000, abilityCooldown: 40_000, stats: { maxHealth: 0.6, scale: 1.2, power: 1.3, resistance: 1.2, damage: 2.2, attackSpeed: 0.56, throwCooldown: 0.4 }, ability: { power: 1.5, damage: 4, attackSpeed: 0.8, speed: 1.2, throwCooldown: 0.3 } },
  fisherman: { name: 'fisherman', label: 'Fisherman', description: 'Mobile sustain fighter with instant weapon recovery.', color: '#06b6d4', unlockAt: 12_000, parents: ['archer', 'samurai', 'lumberjack'], abilityName: 'High Tide', abilityDuration: 7_000, abilityCooldown: 45_000, stats: { speed: 1.1, damage: 1.8, attackSpeed: 0.77, regen: 1.5 }, ability: { regen: 3, scale: 1.2, attackSpeed: 3.3, speed: 2, throwCooldown: 0.1 } },
  juggernaut: { name: 'juggernaut', label: 'Juggernaut', description: 'Endgame titan with colossal health and impact.', color: '#7c3aed', unlockAt: 12_000, parents: ['samurai', 'lumberjack'], abilityName: 'Cataclysm', abilityDuration: 8_000, abilityCooldown: 50_000, stats: { maxHealth: 1.5, speed: 0.8, scale: 1.4, resistance: 3.8, damage: 1.5, attackSpeed: 0.83 }, ability: { scale: 2.1, power: 2.3, damage: 2, attackSpeed: 1.67, resistance: 1.3, speed: 1.9, regen: 2 } },
  archergod: { name: 'archergod', label: 'Archer God', description: 'Ultimate glass cannon with relentless projectiles.', color: '#facc15', unlockAt: 12_000, parents: ['archer'], abilityName: 'Solar Volley', abilityDuration: 6_000, abilityCooldown: 60_000, stats: { maxHealth: 0.5, speed: 1.1, power: 1.5, resistance: 0.8, throwCooldown: 0.5, throwDamage: 5 }, ability: { speed: 1.8, scale: 0.5, power: 3, resistance: 0.2, throwCooldown: 0.08, throwDamage: 7, regen: 2 } }
};

export function getAvailableEvolutions(current: EvolutionName | null, coins: number): EvolutionDefinition[] {
  const parent: EvolutionName | 'root' = current ?? 'root';
  return Object.values(EVOLUTIONS).filter((entry) => entry.parents.includes(parent) && coins >= entry.unlockAt);
}

export function getStats(evolution: EvolutionName | null, abilityActive: boolean): StatMultipliers {
  if (!evolution) return { ...BASE_STATS };
  const definition = EVOLUTIONS[evolution];
  const layers = abilityActive ? [definition.stats, definition.ability] : [definition.stats];
  const stats: StatMultipliers = { ...BASE_STATS };
  for (const layer of layers) {
    for (const [key, value] of Object.entries(layer)) {
      if (value !== undefined) stats[key as keyof StatMultipliers] = value;
    }
  }
  return stats;
}
