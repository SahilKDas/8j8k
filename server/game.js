import {
  BOT_COLORS,
  MAP_SIZE,
  MAX_HP,
  PLAYER_RADIUS,
  SCORE_TO_RESET,
  UPGRADES,
  WEAPONS,
  clamp,
  distanceSquared,
  upgradeCost
} from '../src/lib/game.js';

const BOT_COUNT = 30;
const ORB_COUNT = 180;
const TICK_RATE = 30;
const BASE_SPEED = 225;
const ATTACK_RANGE = 78;
const ATTACK_ARC = Math.PI * 0.8;
const POWERUP_DURATION = 6000;
const BOT_NAMES = ['Ari', 'Bex', 'Cato', 'Dax', 'Echo', 'Fenn', 'Grit', 'Hex', 'Ivo', 'Juno', 'Kip', 'Lux'];

const randomBetween = (random, min, max) => random() * (max - min) + min;
const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const safeNumber = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

export class GameWorld {
  constructor({ random = Math.random, botCount = BOT_COUNT } = {}) {
    this.random = random;
    this.players = new Map();
    this.projectiles = [];
    this.orbs = [];
    this.lava = [];
    this.hills = [];
    this.cover = [];
    this.powerups = [];
    this.event = null;
    this.boss = null;
    this.mapVersion = 1;
    this.nextEntityId = 1;
    this.lastPowerupAt = 0;
    this.lastEventRollAt = 0;
    this.generateMap();
    for (let index = 0; index < botCount; index += 1) this.addBot(index);
  }

  id(prefix) {
    return `${prefix}_${this.nextEntityId++}`;
  }

  point(padding = 60) {
    return {
      x: randomBetween(this.random, padding, MAP_SIZE - padding),
      y: randomBetween(this.random, padding, MAP_SIZE - padding)
    };
  }

  safeSpawn() {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const point = this.point(100);
      if (this.lava.every((pool) => distanceSquared(point, pool) > (pool.radius + 80) ** 2)) return point;
    }
    return { x: MAP_SIZE / 2, y: MAP_SIZE / 2 };
  }

  generateMap() {
    this.orbs = Array.from({ length: ORB_COUNT }, () => ({ id: this.id('orb'), ...this.point(), value: 12 }));
    this.lava = Array.from({ length: 9 }, () => ({ id: this.id('lava'), ...this.point(180), radius: randomBetween(this.random, 55, 110) }));
    this.hills = Array.from({ length: 3 }, () => ({ id: this.id('hill'), ...this.point(220), radius: 145 }));
    this.cover = Array.from({ length: 16 }, () => ({ id: this.id('cover'), ...this.point(100), radius: 28, hp: 240 }));
    this.powerups = [];
    this.projectiles = [];
    this.event = null;
    this.boss = null;
  }

  makePlayer(id, name, bot = false, botType = 'melee') {
    const spawn = this.safeSpawn();
    return {
      id,
      name,
      bot,
      botType,
      color: bot ? BOT_COLORS[botType] : '#61e7c7',
      ...spawn,
      angle: 0,
      health: MAX_HP,
      maxHealth: MAX_HP,
      shield: 0,
      score: 0,
      kills: 0,
      weapon: 0,
      dead: false,
      respawnAt: 0,
      upgrades: { speed: 0, attack: 0, vitality: 0 },
      input: { x: 0, y: 0 },
      blockingUntil: 0,
      dashingUntil: 0,
      attackingUntil: 0,
      whirlwindUntil: 0,
      powerup: null,
      powerupUntil: 0,
      cooldowns: { attack: 0, dash: 0, throw: 0, block: 0, whirlwind: 0 },
      aiAngle: this.random() * Math.PI * 2,
      aiChangeAt: 0
    };
  }

  addHuman(id, name) {
    const cleanName = String(name || 'Wanderer').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 18) || 'Wanderer';
    const player = this.makePlayer(id, cleanName);
    this.players.set(id, player);
    return player;
  }

  addBot(index = this.players.size) {
    const roll = this.random();
    const botType = roll < 0.12 ? 'healer' : roll < 0.28 ? 'ranger' : roll < 0.4 ? 'tank' : roll < 0.5 ? 'thief' : 'melee';
    const id = this.id('bot');
    const player = this.makePlayer(id, `${BOT_NAMES[index % BOT_NAMES.length]}-${index + 1}`, true, botType);
    if (botType === 'tank') {
      player.maxHealth = 170;
      player.health = 170;
    }
    this.players.set(id, player);
    return player;
  }

  removeHuman(id) {
    const player = this.players.get(id);
    if (player && !player.bot) this.players.delete(id);
  }

  setInput(id, message) {
    const player = this.players.get(id);
    if (!player || player.bot || player.dead) return;
    const x = clamp(safeNumber(message.x), -1, 1);
    const y = clamp(safeNumber(message.y), -1, 1);
    const length = Math.hypot(x, y) || 1;
    player.input = length > 1 ? { x: x / length, y: y / length } : { x, y };
    player.angle = safeNumber(message.angle, player.angle);
  }

  action(id, kind, now = Date.now()) {
    const player = this.players.get(id);
    if (!player || player.dead) return false;
    if (kind === 'attack') return this.attack(player, now);
    if (kind === 'dash' && now >= player.cooldowns.dash) {
      player.dashingUntil = now + 170;
      player.cooldowns.dash = now + 1900;
      return true;
    }
    if (kind === 'block' && now >= player.cooldowns.block) {
      player.blockingUntil = now + 380;
      player.cooldowns.block = now + 1050;
      return true;
    }
    if (kind === 'whirlwind' && now >= player.cooldowns.whirlwind) {
      player.whirlwindUntil = now + 550;
      player.cooldowns.whirlwind = now + 4800;
      for (const target of this.players.values()) {
        if (target.id !== player.id && !target.dead && distanceSquared(player, target) < 120 ** 2) {
          this.damage(target, 26, player, now);
        }
      }
      return true;
    }
    if (kind === 'throw' && now >= player.cooldowns.throw) {
      player.cooldowns.throw = now + 2600;
      this.projectiles.push({
        id: this.id('blade'), owner: player.id, kind: 'blade', x: player.x, y: player.y,
        vx: Math.cos(player.angle) * 650, vy: Math.sin(player.angle) * 650,
        damage: WEAPONS[player.weapon].damage * 0.8, expires: now + 1200
      });
      return true;
    }
    return false;
  }

  attack(player, now) {
    const cooldown = 430 * (1 - player.upgrades.attack * 0.08);
    if (now < player.cooldowns.attack) return false;
    player.cooldowns.attack = now + cooldown;
    player.attackingUntil = now + 190;
    const damage = WEAPONS[player.weapon].damage * (player.powerup === 'berserk' ? 1.7 : 1);
    for (const target of this.players.values()) {
      if (target.id === player.id || target.dead || distanceSquared(player, target) > ATTACK_RANGE ** 2) continue;
      const direction = Math.atan2(target.y - player.y, target.x - player.x);
      if (Math.abs(angleDifference(direction, player.angle)) <= ATTACK_ARC / 2) this.damage(target, damage, player, now);
    }
    if (this.boss && distanceSquared(player, this.boss) < (ATTACK_RANGE + this.boss.radius) ** 2) {
      this.boss.health -= damage;
      if (this.boss.health <= 0) this.killBoss(player);
    }
    return true;
  }

  damage(target, amount, attacker, now) {
    if (target.dead || target.id === attacker?.id) return;
    if (now < target.blockingUntil) amount *= 0.25;
    if (target.botType === 'tank') amount *= 0.72;
    if (target.shield > 0) {
      const absorbed = Math.min(target.shield, amount);
      target.shield -= absorbed;
      amount -= absorbed;
    }
    target.health -= amount;
    if (target.health > 0) return;
    target.health = 0;
    target.dead = true;
    target.respawnAt = target.bot ? now + 1800 : 0;
    target.input = { x: 0, y: 0 };
    const scoringPlayer = attacker && this.players.get(attacker.id);
    if (scoringPlayer && scoringPlayer.id !== target.id) {
      scoringPlayer.kills += 1;
      scoringPlayer.score += target.botType === 'tank' ? 180 : 100;
      scoringPlayer.health = Math.min(scoringPlayer.maxHealth, scoringPlayer.health + 12);
      this.updateWeapon(scoringPlayer);
    }
  }

  updateWeapon(player) {
    let weapon = 0;
    WEAPONS.forEach((candidate, index) => { if (player.kills >= candidate.kills) weapon = index; });
    player.weapon = weapon;
  }

  respawn(id) {
    const player = this.players.get(id);
    if (!player || (!player.dead && !player.bot)) return false;
    const spawn = this.safeSpawn();
    Object.assign(player, spawn, {
      health: player.maxHealth,
      shield: 0,
      dead: false,
      respawnAt: 0,
      score: player.bot ? Math.floor(player.score * 0.5) : 0,
      kills: player.bot ? player.kills : 0,
      weapon: player.bot ? player.weapon : 0,
      upgrades: player.bot ? player.upgrades : { speed: 0, attack: 0, vitality: 0 },
      powerup: null,
      powerupUntil: 0
    });
    if (!player.bot) {
      player.maxHealth = MAX_HP;
      player.health = MAX_HP;
    }
    return true;
  }

  buyUpgrade(id, kind) {
    const player = this.players.get(id);
    const definition = UPGRADES[kind];
    if (!player || player.dead || !definition) return false;
    const level = player.upgrades[kind];
    const cost = upgradeCost(kind, level);
    if (level >= definition.max || player.score < cost) return false;
    player.score -= cost;
    player.upgrades[kind] += 1;
    if (kind === 'vitality') {
      player.maxHealth += 20;
      player.health += 20;
    }
    return true;
  }

  resetMap(id) {
    const player = this.players.get(id);
    if (!player || player.score < SCORE_TO_RESET) return false;
    this.mapVersion += 1;
    this.generateMap();
    for (const entity of this.players.values()) {
      const spawn = this.safeSpawn();
      Object.assign(entity, spawn, { score: 0, kills: 0, weapon: 0, health: entity.maxHealth, dead: false });
    }
    return true;
  }

  closestPlayer(source, range = Infinity, predicate = () => true) {
    let best = null;
    let bestDistance = range ** 2;
    for (const target of this.players.values()) {
      if (target.id === source.id || target.dead || !predicate(target)) continue;
      const candidateDistance = distanceSquared(source, target);
      if (candidateDistance < bestDistance) {
        best = target;
        bestDistance = candidateDistance;
      }
    }
    return best;
  }

  updateBot(bot, now) {
    if (bot.dead) {
      if (now >= bot.respawnAt) this.respawn(bot.id);
      return;
    }
    const isHealer = bot.botType === 'healer';
    const target = this.closestPlayer(bot, isHealer ? 500 : 700, (player) => isHealer ? player.bot && player.botType !== 'healer' : true);
    if (!target) {
      if (now >= bot.aiChangeAt) {
        bot.aiAngle = this.random() * Math.PI * 2;
        bot.aiChangeAt = now + randomBetween(this.random, 900, 2400);
      }
      bot.input = { x: Math.cos(bot.aiAngle) * 0.45, y: Math.sin(bot.aiAngle) * 0.45 };
      return;
    }
    const angle = Math.atan2(target.y - bot.y, target.x - bot.x);
    const distance = Math.sqrt(distanceSquared(bot, target));
    bot.angle = angle;
    if (isHealer) {
      if (distance > 80) bot.input = { x: Math.cos(angle), y: Math.sin(angle) };
      else {
        bot.input = { x: 0, y: 0 };
        target.health = Math.min(target.maxHealth, target.health + 0.22);
      }
    } else if (bot.botType === 'ranger') {
      const direction = distance < 220 ? -1 : distance > 390 ? 1 : 0;
      bot.input = { x: Math.cos(angle) * direction, y: Math.sin(angle) * direction };
      if (now >= bot.cooldowns.throw) {
        bot.cooldowns.throw = now + 1500;
        this.projectiles.push({ id: this.id('bolt'), owner: bot.id, kind: 'bolt', x: bot.x, y: bot.y, vx: Math.cos(angle) * 430, vy: Math.sin(angle) * 430, damage: 18, expires: now + 1600 });
      }
    } else {
      const direction = bot.botType === 'thief' && bot.health < bot.maxHealth * 0.4 ? -1 : 1;
      bot.input = { x: Math.cos(angle) * direction, y: Math.sin(angle) * direction };
      if (distance < ATTACK_RANGE) this.attack(bot, now);
      if (distance > 180 && now >= bot.cooldowns.dash && this.random() < 0.015) this.action(bot.id, 'dash', now);
    }
  }

  movePlayer(player, dt, now) {
    if (player.dead) return;
    let speed = BASE_SPEED * (1 + player.upgrades.speed * 0.08);
    if (player.botType === 'tank') speed *= 0.72;
    if (player.botType === 'thief') speed *= 1.25;
    if (player.powerup === 'haste') speed *= 1.45;
    if (now < player.dashingUntil) speed *= 2.9;
    const oldX = player.x;
    const oldY = player.y;
    player.x = clamp(player.x + player.input.x * speed * dt, PLAYER_RADIUS, MAP_SIZE - PLAYER_RADIUS);
    player.y = clamp(player.y + player.input.y * speed * dt, PLAYER_RADIUS, MAP_SIZE - PLAYER_RADIUS);
    for (const obstacle of this.cover) {
      const minimum = PLAYER_RADIUS + obstacle.radius;
      if (distanceSquared(player, obstacle) >= minimum ** 2) continue;
      player.x = oldX;
      player.y = oldY;
      break;
    }
  }

  updateProjectiles(dt, now) {
    for (const projectile of this.projectiles) {
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      const owner = this.players.get(projectile.owner);
      for (const target of this.players.values()) {
        if (!owner || target.id === owner.id || target.dead || distanceSquared(projectile, target) > (PLAYER_RADIUS + 8) ** 2) continue;
        this.damage(target, projectile.damage, owner, now);
        projectile.expires = 0;
        break;
      }
    }
    this.projectiles = this.projectiles.filter((projectile) => projectile.expires > now && projectile.x > 0 && projectile.y > 0 && projectile.x < MAP_SIZE && projectile.y < MAP_SIZE);
  }

  updatePickups(player, dt, now) {
    if (player.dead) return;
    const scoreMultiplier = this.hills.some((hill) => distanceSquared(player, hill) < hill.radius ** 2) ? 2 : 1;
    for (const orb of this.orbs) {
      if (orb.taken || distanceSquared(player, orb) > (PLAYER_RADIUS + 9) ** 2) continue;
      orb.taken = true;
      player.score += orb.value * scoreMultiplier;
      player.health = Math.min(player.maxHealth, player.health + 3);
    }
    for (const pool of this.lava) {
      if (distanceSquared(player, pool) < (pool.radius - PLAYER_RADIUS / 2) ** 2) this.damage(player, 26 * dt, { id: 'lava' }, now);
    }
    for (const powerup of this.powerups) {
      if (powerup.taken || distanceSquared(player, powerup) > (PLAYER_RADIUS + 14) ** 2) continue;
      powerup.taken = true;
      player.powerup = powerup.kind;
      player.powerupUntil = now + POWERUP_DURATION;
      if (powerup.kind === 'aegis') player.shield = 70;
    }
    if (player.powerup && now >= player.powerupUntil) player.powerup = null;
  }

  spawnPowerup(now) {
    const kinds = ['berserk', 'haste', 'aegis'];
    this.powerups.push({ id: this.id('power'), ...this.point(100), kind: kinds[Math.floor(this.random() * kinds.length)] });
    if (this.powerups.length > 6) this.powerups.shift();
    this.lastPowerupAt = now;
  }

  updateEvent(now) {
    if (this.event && now >= this.event.endsAt) this.event = null;
    if (!this.event && now - this.lastEventRollAt > 45000) {
      this.lastEventRollAt = now;
      if (this.random() < 0.35) this.event = { kind: 'bloodMoon', endsAt: now + 18000 };
    }
    if (!this.boss) {
      const champion = [...this.players.values()].find((player) => player.score >= 2000);
      if (champion) this.spawnBoss();
    }
  }

  spawnBoss() {
    this.boss = { id: this.id('boss'), name: 'The Warden', x: MAP_SIZE / 2, y: MAP_SIZE / 2, angle: 0, radius: 44, health: 2400, maxHealth: 2400, cooldown: 0 };
  }

  updateBoss(dt, now) {
    if (!this.boss) return;
    const target = this.closestPlayer(this.boss, 900, (player) => !player.bot);
    if (!target) return;
    this.boss.angle = Math.atan2(target.y - this.boss.y, target.x - this.boss.x);
    if (distanceSquared(this.boss, target) > 90 ** 2) {
      this.boss.x += Math.cos(this.boss.angle) * 115 * dt;
      this.boss.y += Math.sin(this.boss.angle) * 115 * dt;
    } else if (now >= this.boss.cooldown) {
      this.boss.cooldown = now + 1100;
      this.damage(target, 42, { id: this.boss.id }, now);
    }
  }

  killBoss(player) {
    player.score += 1000;
    this.boss = null;
  }

  tick(dt = 1 / TICK_RATE, now = Date.now()) {
    dt = clamp(dt, 0, 0.1);
    if (now - this.lastPowerupAt > 12000) this.spawnPowerup(now);
    this.updateEvent(now);
    for (const player of this.players.values()) {
      if (player.bot) this.updateBot(player, now);
      this.movePlayer(player, dt, now);
      this.updatePickups(player, dt, now);
      if (!player.dead && this.event?.kind === 'bloodMoon' && player.bot) player.health = Math.min(player.maxHealth, player.health + 0.03);
    }
    this.updateProjectiles(dt, now);
    this.updateBoss(dt, now);
    this.orbs = this.orbs.filter((orb) => !orb.taken);
    while (this.orbs.length < ORB_COUNT) this.orbs.push({ id: this.id('orb'), ...this.point(), value: 12 });
    this.powerups = this.powerups.filter((powerup) => !powerup.taken);
  }

  snapshot(now = Date.now()) {
    return {
      type: 'snapshot',
      now,
      mapVersion: this.mapVersion,
      players: [...this.players.values()].map(({ input, cooldowns, aiAngle, aiChangeAt, respawnAt, ...player }) => player),
      orbs: this.orbs,
      lava: this.lava,
      hills: this.hills,
      cover: this.cover,
      powerups: this.powerups,
      projectiles: this.projectiles.map(({ vx, vy, damage, expires, ...projectile }) => projectile),
      boss: this.boss,
      event: this.event,
      leaderboard: [...this.players.values()].sort((a, b) => b.score - a.score).slice(0, 8).map(({ id, name, score, kills, bot }) => ({ id, name, score, kills, bot }))
    };
  }
}
