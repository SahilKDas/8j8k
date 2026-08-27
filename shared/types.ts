export type EvolutionName =
  | 'berserker' | 'tank' | 'knight' | 'vampire' | 'warrior' | 'rook'
  | 'archer' | 'samurai' | 'lumberjack' | 'fisherman' | 'juggernaut' | 'archergod';

export type ChestRarity = 'normal' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythical';

export interface Vector2 { x: number; y: number }

export interface MovementInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  angle: number;
  attacking: boolean;
  sequence: number;
}

export interface PlayerState extends Vector2 {
  id: string;
  name: string;
  color: string;
  angle: number;
  swordAngle: number;
  health: number;
  maxHealth: number;
  coins: number;
  kills: number;
  level: number;
  evolution: EvolutionName | null;
  attacking: boolean;
  abilityEndsAt: number;
  abilityReadyAt: number;
  swordInHand: boolean;
  npc: boolean;
  npcKind: 'brawler' | 'shuriken' | null;
  dead: boolean;
}

export interface CoinState extends Vector2 {
  id: string;
  value: number;
}

export interface ChestState extends Vector2 {
  id: string;
  rarity: ChestRarity;
  health: number;
  maxHealth: number;
}

export interface SwordState extends Vector2 {
  id: string;
  ownerId: string;
  angle: number;
}

export interface ShurikenState extends Vector2 {
  id: string;
  ownerId: string;
  angle: number;
  deflected: boolean;
}

export interface ChatMessage {
  id: string;
  name: string;
  text: string;
  time: number;
  system?: boolean;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  coins: number;
  kills: number;
}

export interface Snapshot {
  tick: number;
  now: number;
  selfId?: string;
  players: PlayerState[];
  coins: CoinState[];
  chests: ChestState[];
  swords: SwordState[];
  shurikens: ShurikenState[];
  leaderboard: LeaderboardEntry[];
}

export type ClientMessage =
  | { type: 'join'; payload: { name: string; color: string } }
  | { type: 'input'; payload: MovementInput }
  | { type: 'ability' }
  | { type: 'throw' }
  | { type: 'evolve'; payload: EvolutionName }
  | { type: 'chat'; payload: string }
  | { type: 'respawn' }
  | { type: 'ping'; payload: number };

export type ServerMessage =
  | { type: 'welcome'; payload: Snapshot }
  | { type: 'snapshot'; payload: Snapshot }
  | { type: 'chat'; payload: ChatMessage }
  | { type: 'announcement'; payload: string }
  | { type: 'pong'; payload: number }
  | { type: 'error'; payload: string };
