import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import {
  ATTACK_ARC, ATTACK_COOLDOWN, BASE_DAMAGE, BASE_HEALTH, BASE_SPEED,
  BASE_SWORD_REACH, CHEST_LIMITS, CHEST_STATS, LEVELS, MAX_CHAT_LENGTH,
  MAX_COINS, NPC_COUNT, PLAYER_RADIUS, SERVER_TICK_RATE, SNAPSHOT_RATE,
  THROW_COOLDOWN, WORLD_HALF
} from '../shared/config.js';
import { EVOLUTIONS, getAvailableEvolutions, getStats } from '../shared/evolutions.js';
import type {
  ChatMessage, ChestRarity, ChestState, ClientMessage, CoinState, EvolutionName,
  MovementInput, PlayerState, ServerMessage, Snapshot, SwordState
} from '../shared/types.js';

interface InternalPlayer extends PlayerState {
  input: MovementInput;
  socket: WebSocket | null;
  lastAttackAt: number;
  lastDamagedAt: number;
  lastRegenAt: number;
  lastThrowAt: number;
  respawnAt: number;
  targetId?: string;
  wanderAngle: number;
}

interface InternalSword extends SwordState {
  vx: number;
  vy: number;
  bornAt: number;
  damage: number;
}

const blankInput = (): MovementInput => ({
  up: false, down: false, left: false, right: false,
  angle: 0, attacking: false, sequence: 0
});

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distanceSquared = (a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);
const normalizeAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

export class GameRoom {
  readonly players = new Map<string, InternalPlayer>();
  readonly coins = new Map<string, CoinState>();
  readonly chests = new Map<string, ChestState>();
  readonly swords = new Map<string, InternalSword>();
  private timer?: NodeJS.Timeout;
  private tickNumber = 0;
  private lastTickAt = Date.now();
  private lastSnapshotAt = 0;

  constructor(private readonly now: () => number = Date.now) {
    for (let index = 0; index < NPC_COUNT; index += 1) this.spawnNpc(index);
    this.replenishWorld();
  }

  start(): void {
    if (this.timer) return;
    this.lastTickAt = this.now();
    this.timer = setInterval(() => this.tick(), 1000 / SERVER_TICK_RATE);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  connect(socket: WebSocket): string {
    const id = randomUUID();
    socket.on('message', (raw) => this.handleMessage(id, raw.toString()));
    socket.on('close', () => this.removePlayer(id));
    socket.on('error', () => this.removePlayer(id));
    return id;
  }

  handleMessage(id: string, raw: string): void {
    let message: ClientMessage;
    try { message = JSON.parse(raw) as ClientMessage; } catch { return; }
    if (!message || typeof message.type !== 'string') return;

    if (message.type === 'join') {
      const existing = this.players.get(id);
      if (existing) existing.socket = existing.socket;
      else {
        const socket = this.findSocket(id);
        if (!socket) return;
        const player = this.createPlayer(id, message.payload?.name, message.payload?.color, false, socket);
        this.players.set(id, player);
        this.send(socket, { type: 'welcome', payload: this.snapshotFor(player) });
        this.broadcast({ type: 'announcement', payload: `${player.name} entered the arena.` });
      }
      return;
    }

    const player = this.players.get(id);
    if (!player || player.npc) return;
    switch (message.type) {
      case 'input': this.acceptInput(player, message.payload); break;
      case 'ability': this.activateAbility(player); break;
      case 'throw': this.throwSword(player); break;
      case 'evolve': this.evolve(player, message.payload); break;
      case 'chat': this.chat(player, message.payload); break;
      case 'respawn': if (player.dead) this.respawn(player); break;
      case 'ping': this.send(player.socket, { type: 'pong', payload: message.payload }); break;
    }
  }

  private socketByPendingId = new Map<string, WebSocket>();

  register(socket: WebSocket): string {
    const id = this.connect(socket);
    this.socketByPendingId.set(id, socket);
    socket.once('close', () => this.socketByPendingId.delete(id));
    return id;
  }

  private findSocket(id: string): WebSocket | undefined {
    return this.socketByPendingId.get(id);
  }

  private removePlayer(id: string): void {
    const player = this.players.get(id);
    if (player && !player.npc) this.broadcast({ type: 'announcement', payload: `${player.name} left the arena.` });
    this.players.delete(id);
    this.socketByPendingId.delete(id);
  }

  tick(deltaOverride?: number): void {
    const time = this.now();
    const delta = deltaOverride ?? clamp((time - this.lastTickAt) / 1000, 0, 0.08);
    this.lastTickAt = time;
    this.tickNumber += 1;
    this.replenishWorld();

    for (const player of this.players.values()) {
      if (player.dead) {
        if (player.npc && time >= player.respawnAt) this.respawn(player);
        continue;
      }
      if (player.npc) this.updateNpcInput(player, time);
      this.updatePlayer(player, delta, time);
    }
    this.updateSwords(delta, time);

    if (time - this.lastSnapshotAt >= 1000 / SNAPSHOT_RATE) {
      for (const player of this.players.values()) {
        if (player.socket?.readyState === WebSocket.OPEN) this.send(player.socket, { type: 'snapshot', payload: this.snapshotFor(player) });
      }
      this.lastSnapshotAt = time;
    }
  }

  private createPlayer(id: string, rawName: unknown, rawColor: unknown, npc: boolean, socket: WebSocket | null): InternalPlayer {
    const position = this.spawnPoint();
    const name = npc ? String(rawName) : this.cleanName(rawName);
    return {
      id, name, color: this.cleanColor(rawColor), x: position.x, y: position.y,
      angle: 0, health: BASE_HEALTH, maxHealth: BASE_HEALTH, coins: 0, kills: 0,
      level: 1, evolution: null, attacking: false, abilityEndsAt: 0,
      abilityReadyAt: 0, swordInHand: true, npc, dead: false, input: blankInput(),
      socket, lastAttackAt: 0, lastDamagedAt: 0, lastRegenAt: 0,
      lastThrowAt: 0, respawnAt: 0, wanderAngle: Math.random() * Math.PI * 2
    };
  }

  private spawnNpc(index: number): void {
    const names = ['Kiro', 'Moss', 'Rune', 'Vexa', 'Talon', 'Oro', 'Nyx', 'Bram', 'Sable', 'Pike'];
    const colors = ['#38bdf8', '#fb7185', '#4ade80', '#facc15', '#c084fc', '#2dd4bf', '#f97316', '#a3e635'];
    const id = `npc-${index}`;
    const player = this.createPlayer(id, `${names[index % names.length]}-${index + 1}`, colors[index % colors.length], true, null);
    if (index % 2 === 0) player.evolution = 'berserker';
    else player.evolution = 'tank';
    player.coins = 800 + index * 55;
    this.refreshDerivedStats(player);
    this.players.set(id, player);
  }

  private updateNpcInput(npc: InternalPlayer, time: number): void {
    const target = npc.targetId ? this.players.get(npc.targetId) : undefined;
    if (!target || target.dead || distanceSquared(npc, target) > 2_300 ** 2 || Math.random() < 0.012) {
      const candidates = [...this.players.values()].filter((player) => player.id !== npc.id && !player.dead);
      candidates.sort((a, b) => distanceSquared(npc, a) - distanceSquared(npc, b));
      npc.targetId = candidates[0]?.id;
    }
    const activeTarget = npc.targetId ? this.players.get(npc.targetId) : undefined;
    if (!activeTarget) {
      npc.wanderAngle += randomBetween(-0.08, 0.08);
      npc.input = { ...blankInput(), right: Math.cos(npc.wanderAngle) > 0, left: Math.cos(npc.wanderAngle) < 0, down: Math.sin(npc.wanderAngle) > 0, up: Math.sin(npc.wanderAngle) < 0, angle: npc.wanderAngle, sequence: time };
      return;
    }
    const angle = Math.atan2(activeTarget.y - npc.y, activeTarget.x - npc.x);
    const dist = Math.sqrt(distanceSquared(npc, activeTarget));
    npc.input = { up: Math.sin(angle) < -0.25, down: Math.sin(angle) > 0.25, left: Math.cos(angle) < -0.25, right: Math.cos(angle) > 0.25, angle, attacking: dist < 135, sequence: time };
    if (time >= npc.abilityReadyAt && Math.random() < 0.006) this.activateAbility(npc);
    if (dist > 260 && dist < 700 && Math.random() < 0.018) this.throwSword(npc);
  }

  private updatePlayer(player: InternalPlayer, delta: number, time: number): void {
    const stats = getStats(player.evolution, time < player.abilityEndsAt);
    const expectedMaxHealth = BASE_HEALTH * stats.maxHealth;
    if (player.maxHealth !== expectedMaxHealth) {
      const ratio = player.health / player.maxHealth;
      player.maxHealth = expectedMaxHealth;
      player.health = Math.min(player.maxHealth, Math.max(1, player.maxHealth * ratio));
    }
    const dx = Number(player.input.right) - Number(player.input.left);
    const dy = Number(player.input.down) - Number(player.input.up);
    const magnitude = Math.hypot(dx, dy) || 1;
    const speed = BASE_SPEED * stats.speed * delta;
    player.x = clamp(player.x + (dx / magnitude) * speed, -WORLD_HALF + PLAYER_RADIUS, WORLD_HALF - PLAYER_RADIUS);
    player.y = clamp(player.y + (dy / magnitude) * speed, -WORLD_HALF + PLAYER_RADIUS, WORLD_HALF - PLAYER_RADIUS);
    player.angle = player.input.angle;
    player.attacking = player.input.attacking;

    if (player.attacking && time - player.lastAttackAt >= ATTACK_COOLDOWN / stats.attackSpeed) {
      player.lastAttackAt = time;
      this.resolveAttack(player, stats.damage * BASE_DAMAGE, stats.power);
    }
    if (time - player.lastDamagedAt > 2_800 && time - player.lastRegenAt > 160 && player.health < player.maxHealth) {
      player.health = Math.min(player.maxHealth, player.health + 0.8 * stats.regen);
      player.lastRegenAt = time;
    }
    this.collectNearbyCoins(player);
    player.level = this.levelFor(player.coins);
  }

  private resolveAttack(attacker: InternalPlayer, damage: number, power: number): void {
    const reach = BASE_SWORD_REACH * getStats(attacker.evolution, this.now() < attacker.abilityEndsAt).scale;
    for (const target of this.players.values()) {
      if (target.id === attacker.id || target.dead) continue;
      const dist = Math.sqrt(distanceSquared(attacker, target));
      if (dist > reach + PLAYER_RADIUS * 1.5) continue;
      const targetAngle = Math.atan2(target.y - attacker.y, target.x - attacker.x);
      if (Math.abs(normalizeAngle(targetAngle - attacker.angle)) > ATTACK_ARC / 2) continue;
      this.damagePlayer(target, damage, attacker, power);
    }
    for (const chest of [...this.chests.values()]) {
      if (distanceSquared(attacker, chest) > (reach + 45) ** 2) continue;
      const targetAngle = Math.atan2(chest.y - attacker.y, chest.x - attacker.x);
      if (Math.abs(normalizeAngle(targetAngle - attacker.angle)) > ATTACK_ARC / 2) continue;
      const bonus = attacker.evolution === 'lumberjack' ? 2 : 1;
      chest.health -= bonus;
      if (chest.health <= 0) this.openChest(chest, attacker);
    }
  }

  private damagePlayer(target: InternalPlayer, rawDamage: number, attacker: InternalPlayer, power = 1): void {
    const targetStats = getStats(target.evolution, this.now() < target.abilityEndsAt);
    const damage = Math.max(2, rawDamage / Math.max(0.3, targetStats.resistance));
    target.health -= damage;
    target.lastDamagedAt = this.now();
    const knockback = 20 * power;
    target.x = clamp(target.x + Math.cos(attacker.angle) * knockback, -WORLD_HALF, WORLD_HALF);
    target.y = clamp(target.y + Math.sin(attacker.angle) * knockback, -WORLD_HALF, WORLD_HALF);
    const attackerStats = getStats(attacker.evolution, this.now() < attacker.abilityEndsAt);
    if (attackerStats.leech > 0) attacker.health = Math.min(attacker.maxHealth, attacker.health + damage * attackerStats.leech);
    if (target.health <= 0) this.kill(target, attacker);
  }

  private kill(target: InternalPlayer, attacker: InternalPlayer): void {
    target.dead = true;
    target.health = 0;
    target.respawnAt = this.now() + 2_200;
    attacker.kills += 1;
    const bounty = Math.max(80, Math.floor(target.coins * 0.18));
    attacker.coins += bounty;
    this.dropCoins(target.x, target.y, Math.min(24, Math.max(6, Math.floor(bounty / 35))), Math.max(5, Math.floor(bounty / 12)));
    target.coins = Math.floor(target.coins * 0.72);
    this.broadcast({ type: 'announcement', payload: `${attacker.name} defeated ${target.name}.` });
  }

  private collectNearbyCoins(player: InternalPlayer): void {
    for (const coin of this.coins.values()) {
      if (distanceSquared(player, coin) > 65 ** 2) continue;
      player.coins += coin.value;
      this.coins.delete(coin.id);
    }
  }

  private openChest(chest: ChestState, player: InternalPlayer): void {
    this.chests.delete(chest.id);
    const stats = CHEST_STATS[chest.rarity];
    this.dropCoins(chest.x, chest.y, Math.min(30, Math.ceil(stats.value / 45)), Math.max(6, Math.floor(stats.value / 14)));
    player.coins += Math.floor(stats.value * 0.12);
  }

  private throwSword(player: InternalPlayer): void {
    if (player.dead || !player.swordInHand) return;
    const time = this.now();
    const stats = getStats(player.evolution, time < player.abilityEndsAt);
    if (time - player.lastThrowAt < THROW_COOLDOWN * stats.throwCooldown) return;
    player.lastThrowAt = time;
    player.swordInHand = false;
    const speed = 1_050;
    const id = randomUUID();
    this.swords.set(id, { id, ownerId: player.id, x: player.x, y: player.y, angle: player.angle, vx: Math.cos(player.angle) * speed, vy: Math.sin(player.angle) * speed, bornAt: time, damage: BASE_DAMAGE * 0.7 * stats.throwDamage });
  }

  private updateSwords(delta: number, time: number): void {
    for (const sword of [...this.swords.values()]) {
      sword.x += sword.vx * delta;
      sword.y += sword.vy * delta;
      const owner = this.players.get(sword.ownerId);
      let removed = false;
      for (const target of this.players.values()) {
        if (!owner || target.id === owner.id || target.dead || distanceSquared(target, sword) > 44 ** 2) continue;
        this.damagePlayer(target, sword.damage, owner, 1.5);
        removed = true;
        break;
      }
      if (!removed) {
        for (const chest of this.chests.values()) {
          if (distanceSquared(chest, sword) > 65 ** 2) continue;
          chest.health -= 2;
          if (chest.health <= 0 && owner) this.openChest(chest, owner);
          removed = true;
          break;
        }
      }
      if (removed || time - sword.bornAt > 1_050 || Math.abs(sword.x) > WORLD_HALF || Math.abs(sword.y) > WORLD_HALF) {
        this.swords.delete(sword.id);
        if (owner) playerSwordReturn(owner);
      }
    }
  }

  private activateAbility(player: InternalPlayer): void {
    if (!player.evolution || player.dead || this.now() < player.abilityReadyAt) return;
    const definition = EVOLUTIONS[player.evolution];
    player.abilityEndsAt = this.now() + definition.abilityDuration;
    player.abilityReadyAt = this.now() + definition.abilityCooldown;
    this.refreshDerivedStats(player);
  }

  private evolve(player: InternalPlayer, evolution: EvolutionName): void {
    if (!EVOLUTIONS[evolution]) return;
    if (!getAvailableEvolutions(player.evolution, player.coins).some((entry) => entry.name === evolution)) return;
    player.evolution = evolution;
    this.refreshDerivedStats(player);
    player.health = player.maxHealth;
    this.broadcast({ type: 'announcement', payload: `${player.name} evolved into ${EVOLUTIONS[evolution].label}.` });
  }

  private refreshDerivedStats(player: InternalPlayer): void {
    const ratio = player.maxHealth > 0 ? player.health / player.maxHealth : 1;
    const stats = getStats(player.evolution, this.now() < player.abilityEndsAt);
    player.maxHealth = BASE_HEALTH * stats.maxHealth;
    player.health = clamp(player.maxHealth * ratio, 1, player.maxHealth);
  }

  private respawn(player: InternalPlayer): void {
    const position = this.spawnPoint();
    player.x = position.x; player.y = position.y; player.dead = false;
    player.swordInHand = true; player.attacking = false; player.input = blankInput();
    this.refreshDerivedStats(player); player.health = player.maxHealth;
  }

  private acceptInput(player: InternalPlayer, input: MovementInput): void {
    if (!input || input.sequence < player.input.sequence) return;
    player.input = {
      up: Boolean(input.up), down: Boolean(input.down), left: Boolean(input.left), right: Boolean(input.right),
      attacking: Boolean(input.attacking), angle: Number.isFinite(input.angle) ? input.angle : player.angle,
      sequence: Number.isFinite(input.sequence) ? input.sequence : player.input.sequence + 1
    };
  }

  private chat(player: InternalPlayer, raw: string): void {
    const text = String(raw ?? '').replace(/[<>]/g, '').trim().slice(0, MAX_CHAT_LENGTH);
    if (!text) return;
    const message: ChatMessage = { id: player.id, name: player.name, text, time: this.now() };
    this.broadcast({ type: 'chat', payload: message });
  }

  private replenishWorld(): void {
    while (this.coins.size < MAX_COINS) {
      const value = Math.random() < 0.025 ? 25 : Math.random() < 0.14 ? 10 : 5;
      const position = this.spawnPoint();
      const coin: CoinState = { id: randomUUID(), x: position.x, y: position.y, value };
      this.coins.set(coin.id, coin);
    }
    for (const [rarity, desired] of Object.entries(CHEST_LIMITS) as Array<[ChestRarity, number]>) {
      let count = [...this.chests.values()].filter((chest) => chest.rarity === rarity).length;
      while (count < desired) { this.spawnChest(rarity); count += 1; }
    }
  }

  private spawnChest(rarity: ChestRarity): void {
    const position = this.spawnPoint();
    const stats = CHEST_STATS[rarity];
    const id = randomUUID();
    this.chests.set(id, { id, x: position.x, y: position.y, rarity, health: stats.health, maxHealth: stats.health });
  }

  private dropCoins(x: number, y: number, count: number, value: number): void {
    for (let index = 0; index < count; index += 1) {
      if (this.coins.size >= MAX_COINS + 250) break;
      const angle = Math.random() * Math.PI * 2;
      const radius = randomBetween(20, 150);
      const coin: CoinState = { id: randomUUID(), x: clamp(x + Math.cos(angle) * radius, -WORLD_HALF, WORLD_HALF), y: clamp(y + Math.sin(angle) * radius, -WORLD_HALF, WORLD_HALF), value };
      this.coins.set(coin.id, coin);
    }
  }

  private levelFor(coins: number): number {
    let level = 1;
    for (const entry of LEVELS) if (coins >= entry.threshold) level = entry.level;
    return level;
  }

  private snapshotFor(viewer: InternalPlayer): Snapshot {
    const visibility = 2_500 ** 2;
    return {
      tick: this.tickNumber, now: this.now(), selfId: viewer.id,
      players: [...this.players.values()].map(stripInternalPlayer),
      coins: [...this.coins.values()].filter((coin) => distanceSquared(viewer, coin) <= visibility),
      chests: [...this.chests.values()].filter((chest) => distanceSquared(viewer, chest) <= visibility),
      swords: [...this.swords.values()].filter((sword) => distanceSquared(viewer, sword) <= visibility).map(({ vx: _vx, vy: _vy, bornAt: _bornAt, damage: _damage, ...sword }) => sword),
      leaderboard: [...this.players.values()].filter((player) => !player.dead).sort((a, b) => b.coins - a.coins).slice(0, 10).map(({ id, name, coins, kills }) => ({ id, name, coins, kills }))
    };
  }

  getSnapshotForTests(id: string): Snapshot | undefined {
    const player = this.players.get(id);
    return player ? this.snapshotFor(player) : undefined;
  }

  private spawnPoint(): { x: number; y: number } {
    return { x: randomBetween(-WORLD_HALF + 200, WORLD_HALF - 200), y: randomBetween(-WORLD_HALF + 200, WORLD_HALF - 200) };
  }

  private cleanName(raw: unknown): string {
    return String(raw ?? 'Wanderer').replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 18) || 'Wanderer';
  }

  private cleanColor(raw: unknown): string {
    const value = String(raw ?? '#f8fafc');
    return /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#f8fafc';
  }

  private send(socket: WebSocket | null, message: ServerMessage): void {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }

  private broadcast(message: ServerMessage): void {
    for (const player of this.players.values()) this.send(player.socket, message);
  }
}

function stripInternalPlayer(player: InternalPlayer): PlayerState {
  const { input: _input, socket: _socket, lastAttackAt: _lastAttackAt, lastDamagedAt: _lastDamagedAt, lastRegenAt: _lastRegenAt, lastThrowAt: _lastThrowAt, respawnAt: _respawnAt, targetId: _targetId, wanderAngle: _wanderAngle, ...state } = player;
  return state;
}

function playerSwordReturn(player: InternalPlayer): void {
  player.swordInHand = true;
}
