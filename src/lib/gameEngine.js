// Direct Svelte lifecycle port of the original V2 canvas engine.
export function createGame() {
const lifecycle = new AbortController();
let animationFrameId = 0;
let networkTimer = 0;
let reconnectTimer = 0;
let frameCounter = 0;
let fpsWindowStart = performance.now();
let socket = null;
let destroyed = false;
let setupStarted = false;
let onlinePlayers = 1;
let rngState = 0x6a386b32;

const MAP_SIZE = 2500;
const PLAYER_RADIUS = 15;
const PLAYER_SPEED = 3.5;
const BOT_SPEED = 2.5;
const ORB_RADIUS = 7;
const MAX_ORBS = 200;
const NUM_BOTS = 45;
const BASE_SWORD_LENGTH = 35;
const SWORD_WIDTH = 8;
const ATTACK_COOLDOWN = 400;
const SWING_DURATION = 200;
const SWORD_ARC = Math.PI * 0.8;
const MAX_HP = 100;
const ORB_HEAL_AMOUNT = 5;
const ARMOR_PER_KILL = 0.04;
const MAX_ARMOR = 0.60;
const THROWN_SWORD_SPEED = 10;
const THROW_COOLDOWN = 3000;
const NUM_LAVA_POOLS = 10;
const LAVA_DAMAGE_PER_SECOND = 30;
const BLOCK_DURATION = 300;
const BLOCK_COOLDOWN = 1000;
const BOT_BLOCK_CHANCE = 0.4;
const MINIMAP_SIZE = 200;
const SCORE_TO_RESET = 14500;
const DASH_SPEED_MULTIPLIER = 3;
const DASH_DURATION = 150;
const DASH_COOLDOWN = 2000;
const BOSS_SPAWN_SCORE_INTERVAL = 2000;

const NUM_KOTH_ZONES = 3;
const KOTH_ZONE_RADIUS = 150;
const KOTH_SCORE_MULTIPLIER = 2;
const HEALER_BOT_HEAL_RATE = 15;
const SHURIKEN_SPEED = 8;
const SHURIKEN_DAMAGE = 20;
const SHURIKEN_RANGE = 450;
const WHIRLWIND_DURATION = 500;
const WHIRLWIND_COOLDOWN = 5000;
const WHIRLWIND_RADIUS = 100;
const NUM_COVER_OBJECTS = 15;
const COVER_HEALTH = 300;
const MAX_POWERUPS = 5;
const POWERUP_SPAWN_INTERVAL = 15000; // ms
const POWERUP_DURATION = 5000; // ms
const BLOOD_MOON_CHANCE = 0.1; // 10% chance every 30 seconds
const BLOOD_MOON_DURATION = 30000; // 30 seconds
const BLOOD_MOON_SPEED_BOOST = 1.4;

const STUN_DURATION = 1500;
const STUN_SLAM_WINDUP = 800;
const STUN_SLAM_RADIUS = 50;
const STUN_COOLDOWN = 4000;
const ALCHEMIST_POOL_RADIUS = 60;
const ALCHEMIST_POOL_DURATION = 8000;
const ALCHEMIST_POOL_DAMAGE_PER_SECOND = 25;
const ALCHEMIST_THROW_COOLDOWN = 3000;
const ALCHEMIST_PROJECTILE_SPEED = 6;
const THIEF_SPEED_MULTIPLIER = 1.8;
const THIEF_STEAL_PERCENT = 0.1;
const THIEF_BONUS_MULTIPLIER = 1.5;


const SWORD_TIERS = {
    0: { name: 'Iron Sword', color: '#a0aec0', damage: 35, shape: 'sword' },
    2: { name: 'Steel Scimitar', color: '#e2e8f0', damage: 40, shape: 'scimitar' },
    5: { name: 'Golden Axe', color: '#f6e05e', damage: 50, shape: 'axe' },
    10: { name: 'Diamond Spear', color: '#63b3ed', damage: 45, shape: 'spear' },
    15: { name: 'Obsidian Greatsword', color: '#9f7aea', damage: 60, shape: 'greatsword' },
    25: { name: 'Celestial Claymore', color: '#f0e68c', damage: 70, shape: 'claymore' },
    40: { name: 'Volcanic Halberd', color: '#ff4500', damage: 80, shape: 'halberd' },
    60: { name: 'Void Reaper Scythe', color: '#4b0082', damage: 100, shape: 'scythe' },
    80: { name: 'Azure Katana', color: '#3182ce', damage: 120, shape: 'katana' },
    100: { name: 'Sunfire Trident', color: '#fbd38d', damage: 150, shape: 'trident' }
};

const BOSS_LIST = {
    goliath: { name: "Goliath", radius: 45, maxHealth: 3000, damage: 80, speed: 2.8, chargeSpeed: 12, chargeDuration: 800, slamRadius: 250, slamWindup: 1500 },
    frostwraith: { name: "Frostwraith", radius: 35, maxHealth: 2500, speed: 3.5, novaProjectileCount: 24, novaProjectileSpeed: 7, novaProjectileDamage: 30, spikeZoneRadius: 100, spikeZoneWindup: 1000, spikeZoneDamage: 60, teleportCooldown: 7000 }
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimapCanvas');
const minimapCtx = minimapCanvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const deathScreen = document.getElementById('death-screen');
const nameInput = document.getElementById('name-input');
const startButton = document.getElementById('start-button');
const respawnButton = document.getElementById('respawn-button');
const scoreDisplay = document.getElementById('score-display');
const finalScoreDisplay = document.getElementById('final-score');
const leaderboardList = document.getElementById('leaderboard-list');
const playerStatsList = document.getElementById('player-stats-list');
const bossUI = document.getElementById('boss-ui');
const bossName = document.getElementById('boss-name');
const bossHpBar = document.getElementById('boss-hp-bar');
const upgradesList = document.getElementById('upgrades-list');
const instructionsModal = document.getElementById('instructions-modal');
const instructionsButton = document.getElementById('instructions-button');
const closeInstructionsButton = document.getElementById('close-instructions-button');
const bloodMoonOverlay = document.getElementById('blood-moon-overlay');
const bloodMoonAnnouncementContainer = document.getElementById('blood-moon-announcement-container');
const resetMapContainer = document.getElementById('reset-map-container');
const resetMapButton = document.getElementById('reset-map-button');

let localPlayer = {}, players = {}, orbs = {}, xpOrbs = [];
let projectiles = { thrownSwords: [], shurikens: [], frostbolts: [], vials: [] };
let lavaPools = [], kothZones = [], coverObjects = [], powerUps = [], activeAoeZones = [], particles = [];
let screenShake = 0, playerId = `local_${crypto.randomUUID().slice(0, 8)}`, isDead = true, gameStarted = false;
let camera = { x: 0, y: 0 };
const keys = {}, mouse = { x: 0, y: 0, down: false, rightDown: false, middleDown: false };
let lastFrameTime = Date.now(), lastUiUpdateTime = 0, mapResetting = false, mapResetTime = 0;
let currentBoss = null, lastBossSpawnScore = 0, bossSpawnCounter = 0, lastPowerUpSpawnTime = 0;
let isBloodMoonActive = false, bloodMoonEndTime = 0, lastEventCheckTime = 0;

const random = () => {
    rngState |= 0;
    rngState = (rngState + 0x6D2B79F5) | 0;
    let value = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
};
const getRandom = (min, max) => random() * (max - min) + min;
const distanceSq = (a, b) => (a.x - b.x)**2 + (a.y - b.y)**2;
const distance = (a, b) => Math.sqrt(distanceSq(a, b));
const normalizeAngle = (angle) => ((angle % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);

function generateBotName() {
    const consonants = 'bcdfghjklmnpqrstvwxyz';
    const vowels = 'aeiou';
    let name = '';
    name += consonants[Math.floor(random() * consonants.length)];
    name += vowels[Math.floor(random() * vowels.length)];
    name += consonants[Math.floor(random() * consonants.length)];
    name += vowels[Math.floor(random() * vowels.length)];
    return name.charAt(0).toUpperCase() + name.slice(1);
}

function sendNetwork(message) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function serializeLocalPlayer() {
    if (!localPlayer?.isLocal) return null;
    const {
        name, x, y, angle, score, health, shield, kills, armor, swordLength, swordTier,
        swordDamage, swordColor, swordShape, isAttacking, isBlocking, isDashing,
        isWhirlwinding, isDisarmed, activePowerUp
    } = localPlayer;
    return {
        name, x, y, angle, score, health, shield, kills, armor, swordLength, swordTier,
        swordDamage, swordColor, swordShape, isAttacking, isBlocking, isDashing,
        isWhirlwinding, isDisarmed, activePowerUp, dead: isDead
    };
}

function makeRemotePlayer(state) {
    const remote = createPlayer(state.id, state.name, false);
    remote.isRemote = true;
    remote.isLocal = false;
    remote.botType = 'remote';
    remote.team = 0;
    remote.targetX = state.x;
    remote.targetY = state.y;
    return remote;
}

function mergeRemotePlayer(remote, state) {
    remote.targetX = state.x;
    remote.targetY = state.y;
    remote.name = state.name;
    remote.angle = state.angle;
    remote.score = state.score;
    remote.health = state.dead ? 0 : state.health;
    remote.shield = state.shield;
    remote.kills = state.kills;
    remote.armor = state.armor;
    remote.swordLength = state.swordLength;
    remote.swordTier = state.swordTier;
    remote.swordDamage = state.swordDamage;
    remote.swordColor = state.swordColor;
    remote.swordShape = state.swordShape;
    if (state.isAttacking && !remote.isAttacking) remote.attackStartTime = Date.now();
    if (state.isWhirlwinding && !remote.isWhirlwinding) remote.lastWhirlwindTime = Date.now();
    remote.isAttacking = state.isAttacking;
    remote.isBlocking = state.isBlocking;
    remote.isDashing = state.isDashing;
    remote.isWhirlwinding = state.isWhirlwinding;
    remote.isDisarmed = state.isDisarmed;
    remote.activePowerUp = state.activePowerUp;
}

function syncRoster(message) {
    onlinePlayers = message.online || 1;
    const present = new Set();
    for (const state of message.players || []) {
        if (state.id === playerId) continue;
        present.add(state.id);
        let remote = players[state.id];
        if (!remote?.isRemote) {
            remote = makeRemotePlayer(state);
            players[state.id] = remote;
        }
        mergeRemotePlayer(remote, state);
    }
    for (const [id, player] of Object.entries(players)) {
        if (player?.isRemote && !present.has(id)) delete players[id];
    }
}

function receiveNetworkDamage(message) {
    if (!localPlayer?.isLocal || isDead || !Number.isFinite(message.amount)) return;
    const attacker = players[message.attackerId] || {
        id: message.attackerId, health: MAX_HP, botType: 'remote', team: 0,
        activePowerUp: null, isRemote: true
    };
    const wasAlive = localPlayer.health > 0;
    const victimScore = localPlayer.score;
    takeDamage(localPlayer, message.amount, attacker);
    if (wasAlive && localPlayer.health <= 0) {
        sendNetwork({ type: 'death', attackerId: message.attackerId, victimScore });
    }
}

function receiveKillCredit(message) {
    if (!localPlayer?.isLocal || isDead) return;
    const scoreGained = 10 + Math.floor(Math.max(0, message.victimScore || 0) / 2);
    localPlayer.score += scoreGained;
    localPlayer.swordLength = BASE_SWORD_LENGTH + 25 * Math.log(localPlayer.score + 1);
    localPlayer.kills++;
    updateArmor(localPlayer);
    updateSwordTier(localPlayer);
}

function startNetworkSync() {
    if (networkTimer) return;
    networkTimer = window.setInterval(() => {
        const player = serializeLocalPlayer();
        if (player) sendNetwork({ type: 'state', player });
    }, 50);
}

function adoptNetworkId(id) {
    if (!id || id === playerId) return;
    const previousId = playerId;
    playerId = id;
    if (localPlayer?.isLocal) {
        delete players[previousId];
        localPlayer.id = id;
        players[id] = localPlayer;
    }
}

function connectMultiplayer() {
    if (destroyed) return;
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${protocol}://${location.host}/ws`);
    socket.addEventListener('message', (event) => {
        let message;
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === 'welcome') {
            adoptNetworkId(message.id);
            if (!setupStarted) {
                rngState = message.seed >>> 0;
                setupGame();
            }
            if (localPlayer?.isLocal) sendNetwork({ type: 'join', name: localPlayer.name });
            startNetworkSync();
        } else if (message.type === 'roster') syncRoster(message);
        else if (message.type === 'playerLeft') {
            if (players[message.id]?.isRemote) delete players[message.id];
        } else if (message.type === 'damage') receiveNetworkDamage(message);
        else if (message.type === 'killCredit') receiveKillCredit(message);
        else if (message.type === 'resetMap') {
            rngState = message.seed >>> 0;
            resetMap(false);
        }
    });
    socket.addEventListener('close', () => {
        socket = null;
        onlinePlayers = 1;
        for (const [id, player] of Object.entries(players)) if (player?.isRemote) delete players[id];
        if (!destroyed) reconnectTimer = window.setTimeout(connectMultiplayer, 1500);
    });
    socket.addEventListener('error', () => socket?.close());
}

window.addEventListener('resize', resizeCanvas, { signal: lifecycle.signal });
resizeCanvas();

function setupGame() {
    if (setupStarted) return;
    setupStarted = true;
    generateInitialOrbs(MAX_ORBS);
    generateLavaPools(NUM_LAVA_POOLS);
    generateKothZones(NUM_KOTH_ZONES);
    generateCover(NUM_COVER_OBJECTS);

    for(let i = 0; i < NUM_BOTS; i++) {
        const botId = `bot_${i}`;
        players[botId] = createPlayer(botId, generateBotName(), false);
    }
    gameLoop();
}

function joinGame(name) {
     gameStarted = true;
     localPlayer = createPlayer(playerId, name || `Player`, true);
     players[playerId] = localPlayer;
     respawnPlayer();
     sendNetwork({ type: 'join', name: localPlayer.name });
}

function respawnPlayer() {
    isDead = false;
    const spawnPoint = getSafeSpawnPoint();
    localPlayer.x = spawnPoint.x;
    localPlayer.y = spawnPoint.y;
    localPlayer.health = MAX_HP;
    localPlayer.shield = 0;
    localPlayer.score = 0;
    localPlayer.kills = 0;
    localPlayer.armor = 0;
    localPlayer.swordLength = BASE_SWORD_LENGTH;
    localPlayer.isDisarmed = false;
    localPlayer.pastPositions = [];
    localPlayer.activePowerUp = null;
    localPlayer.powerUpEndTime = 0;
    localPlayer.isSlowed = false;
    localPlayer.slowEndTime = 0;
    localPlayer.isStunned = false;
    localPlayer.stunEndTime = 0;
    localPlayer.upgrades = { speed: 0, attackSpeed: 0, healthRegen: 0 };

    updateSwordTier(localPlayer);
    startScreen.style.display = 'none';
    deathScreen.classList.add('hidden');
}

function createPlayer(id, name, isLocal) {
    const spawnPoint = getSafeSpawnPoint();
    const player = {
        id, name, isLocal, x: spawnPoint.x, y: spawnPoint.y, angle: 0, score: 0, health: MAX_HP, shield: 0,
        swordLength: BASE_SWORD_LENGTH, kills: 0, armor: 0, swordTier: 0, swordDamage: SWORD_TIERS[0].damage, swordColor: SWORD_TIERS[0].color, swordShape: SWORD_TIERS[0].shape,
        isAttacking: false, attackStartTime: 0, lastAttackTime: 0, isDisarmed: false, lastThrowTime: 0, isBlocking: false, lastBlockTime: 0,
        isDashing: false, lastDashTime: 0, isWhirlwinding: false, lastWhirlwindTime: 0, lastHitTime: 0, pastPositions: [],
        team: 0, botType: 'melee', aiState: 'wandering', target: null, lastActionTime: 0,
        upgrades: { speed: 0, attackSpeed: 0, healthRegen: 0 },
        activePowerUp: null, powerUpEndTime: 0, isSlowed: false, slowEndTime: 0, isStunned: false, stunEndTime: 0,
      };

      if (!isLocal) {
          player.team = random() < 0.3 ? (random() < 0.5 ? 1 : 2) : 0;
          if (player.team === 0) {
            const rand = random();
            if (rand < 0.05) player.botType = 'healer';
            else if (rand < 0.15) player.botType = 'shuriken';
            else if (rand < 0.25) player.botType = 'tank';
            else if (rand < 0.40) player.botType = 'alchemist';
            else if (rand < 0.55) player.botType = 'stunner';
            else if (rand < 0.65) player.botType = 'thief';
          }
      }
      if (player.botType === 'thief') player.stolenScore = 0;
      if (player.botType === 'tank') { player.health = MAX_HP * 3; player.armor = 0.5; }
      if (player.botType === 'stunner') player.health = MAX_HP * 1.5;

      updateSwordTier(player);
      return player;
}

function generateInitialOrbs(count) {
    orbs = {};
    for (let i = 0; i < count; i++) orbs[`orb_${i}`] = { x: getRandom(ORB_RADIUS, MAP_SIZE - ORB_RADIUS), y: getRandom(ORB_RADIUS, MAP_SIZE - ORB_RADIUS), color: `hsl(${getRandom(0, 360)}, 100%, 50%)` };
}

function generateLavaPools(count) {
    lavaPools = [];
    for (let i = 0; i < count; i++) lavaPools.push({ x: getRandom(100, MAP_SIZE - 100), y: getRandom(100, MAP_SIZE - 100), radius: getRandom(80, 200), pulse: random() });
}

function generateKothZones(count) {
    kothZones = [];
     for (let i = 0; i < count; i++) kothZones.push({ x: getRandom(KOTH_ZONE_RADIUS, MAP_SIZE - KOTH_ZONE_RADIUS), y: getRandom(KOTH_ZONE_RADIUS, MAP_SIZE - KOTH_ZONE_RADIUS), radius: KOTH_ZONE_RADIUS, pulse: random() });
}

function generateCover(count) {
    coverObjects = [];
    for(let i=0; i<count; i++) coverObjects.push({ x: getRandom(200, MAP_SIZE - 200), y: getRandom(200, MAP_SIZE - 200), radius: getRandom(20, 50), health: COVER_HEALTH, maxHealth: COVER_HEALTH });
}

function getSafeSpawnPoint() {
    let spawnPoint = { x: 0, y: 0 }, isSafe = false;
    while (!isSafe) {
        spawnPoint.x = getRandom(PLAYER_RADIUS, MAP_SIZE - PLAYER_RADIUS);
        spawnPoint.y = getRandom(PLAYER_RADIUS, MAP_SIZE - PLAYER_RADIUS);
        isSafe = true;
        if (localPlayer && localPlayer.health > 0 && gameStarted && distance(spawnPoint, localPlayer) < window.innerWidth / 2) isSafe = false;
    }
    return spawnPoint;
}

function gameLoop() {
    const now = Date.now();
    const deltaTime = (now - lastFrameTime) / 1000.0;
    lastFrameTime = now;
    frameCounter++;
    const frameNow = performance.now();
    if (frameNow - fpsWindowStart >= 1000) {
        canvas.dataset.fps = String(Math.round(frameCounter * 1000 / (frameNow - fpsWindowStart)));
        frameCounter = 0;
        fpsWindowStart = frameNow;
    }

    if (gameStarted) {
        if (!isDead) handleInput();
        updateRandomEvents(now);
        updatePlayers(deltaTime);
        if (currentBoss) {
            if (currentBoss.type === 'goliath') updateGoliath(deltaTime);
            else if (currentBoss.type === 'frostwraith') updateFrostwraith(deltaTime);
        }
        updateProjectiles();
        updateParticles(deltaTime);
        updateAoeZones(deltaTime);
        checkCollisions(deltaTime);
        spawnPowerUps(now);
    }
    draw();
    animationFrameId = requestAnimationFrame(gameLoop);
}

function handleInput() {
    if (localPlayer.isStunned) return;
    if (localPlayer && (mouse.down || keys[' '])) attack(localPlayer);
    if (localPlayer && mouse.rightDown) throwSword(localPlayer);
    if (localPlayer && (mouse.middleDown || keys['x'])) startBlocking(localPlayer);
    if (localPlayer && keys['shift']) startDashing(localPlayer);
    if (localPlayer && keys['e']) startWhirlwind(localPlayer);
}

function updatePlayers(deltaTime) {
    Object.values(players).forEach(player => {
        if (!player) return;
        if (player.isLocal) { if (!isDead) updateLocalPlayer(player, deltaTime); }
        else if (player.isRemote) { updateRemotePlayer(player); }
        else { updateBot(player, deltaTime); }
        if (player.activePowerUp && Date.now() > player.powerUpEndTime) player.activePowerUp = null;
        if (player.isDashing && Date.now() - player.lastDashTime > DASH_DURATION) player.isDashing = false;
        if (player.isDisarmed && Date.now() - player.lastThrowTime > THROW_COOLDOWN) player.isDisarmed = false;
        if (player.isAttacking && Date.now() - player.attackStartTime > SWING_DURATION) player.isAttacking = false;
        if (player.isBlocking && Date.now() - player.lastBlockTime > BLOCK_DURATION) player.isBlocking = false;
        if (player.isWhirlwinding && Date.now() - player.lastWhirlwindTime > WHIRLWIND_DURATION) player.isWhirlwinding = false;
        if (player.isStunned && Date.now() > player.stunEndTime) player.isStunned = false;

        if (!player.isRemote) {
            for (const pool of lavaPools) { if(distanceSq(player, pool) < (pool.radius + PLAYER_RADIUS)**2) takeDamage(player, LAVA_DAMAGE_PER_SECOND * deltaTime, null); }
            for (const zone of activeAoeZones) { if(zone.type === 'poison' && distanceSq(player, zone) < (zone.radius + PLAYER_RADIUS)**2) takeDamage(player, ALCHEMIST_POOL_DAMAGE_PER_SECOND * deltaTime, null); }
        }
    });
}

function updateRemotePlayer(player) {
    player.x += (player.targetX - player.x) * 0.28;
    player.y += (player.targetY - player.y) * 0.28;
}

function updateLocalPlayer(player, deltaTime) {
    if (player.isStunned) {
        if (random() < 0.3) {
            const angle = random() * Math.PI * 2, radius = PLAYER_RADIUS * 1.2;
            particles.push({ x: player.x + Math.cos(angle) * radius, y: player.y + Math.sin(angle) * radius, vx: 0, vy: 0, life: 0.2, color: '#f59e0b', radius: random() * 3 });
        }
        return;
    }
    player.health = Math.min(MAX_HP, player.health + player.upgrades.healthRegen * deltaTime);
    player.pastPositions.push({ x: player.x, y: player.y });
    if (player.pastPositions.length > 10) player.pastPositions.shift();
    let dx = 0, dy = 0;
    if (keys['w'] || keys['ArrowUp']) dy -= 1; if (keys['s'] || keys['ArrowDown']) dy += 1;
    if (keys['a'] || keys['ArrowLeft']) dx -= 1; if (keys['d'] || keys['ArrowRight']) dx += 1;
    let currentSpeed = PLAYER_SPEED * (1 + player.upgrades.speed * 0.1);
    if(player.activePowerUp === 'speed') currentSpeed *= 1.8;
    if (player.isDashing) currentSpeed *= DASH_SPEED_MULTIPLIER;
    if (player.isSlowed && Date.now() < player.slowEndTime) currentSpeed *= 0.5;
    const magnitude = Math.sqrt(dx*dx + dy*dy);
    if (magnitude > 0) { dx = (dx / magnitude) * currentSpeed; dy = (dy / magnitude) * currentSpeed; }
    player.x += dx; player.y += dy;
    for(const cover of coverObjects) { if(!cover) continue; const dist = distance(player, cover); if (dist < PLAYER_RADIUS + cover.radius) { const angle = Math.atan2(player.y - cover.y, player.x - cover.x); player.x = cover.x + Math.cos(angle) * (PLAYER_RADIUS + cover.radius); player.y = cover.y + Math.sin(angle) * (PLAYER_RADIUS + cover.radius); } }
    player.x = Math.max(PLAYER_RADIUS, Math.min(MAP_SIZE - PLAYER_RADIUS, player.x));
    player.y = Math.max(PLAYER_RADIUS, Math.min(MAP_SIZE - PLAYER_RADIUS, player.y));
    const canvasCenter = { x: canvas.width / 2, y: canvas.height / 2 };
    player.angle = Math.atan2(mouse.y - canvasCenter.y, mouse.x - canvasCenter.x);
}

function updateBot(bot, deltaTime) {
    if (bot.health <= 0) return;
    if (currentBoss && !['healer', 'thief'].includes(bot.botType)) return;
    if (bot.isStunned && Date.now() < bot.stunEndTime) return;

    switch(bot.botType) {
        case 'healer': updateHealerBot(bot, deltaTime); break;
        case 'shuriken': updateShurikenBot(bot, deltaTime); break;
        case 'tank': updateTankBot(bot, deltaTime); break;
        case 'stunner': updateStunBot(bot, deltaTime); break;
        case 'alchemist': updateAlchemistBot(bot, deltaTime); break;
        case 'thief': updateThiefBot(bot, deltaTime); break;
        case 'melee': default: updateMeleeBot(bot, deltaTime); break;
    }
    for(const cover of coverObjects) { if(!cover) continue; const dist = distance(bot, cover); if (dist < PLAYER_RADIUS + cover.radius) { const angle = Math.atan2(bot.y - cover.y, bot.x - cover.x); bot.x = cover.x + Math.cos(angle) * (PLAYER_RADIUS + cover.radius); bot.y = cover.y + Math.sin(angle) * (PLAYER_RADIUS + cover.radius); } }
    bot.x = Math.max(PLAYER_RADIUS, Math.min(MAP_SIZE - PLAYER_RADIUS, bot.x));
    bot.y = Math.max(PLAYER_RADIUS, Math.min(MAP_SIZE - PLAYER_RADIUS, bot.y));
}

function updateMeleeBot(bot) {
    let aggressionRange = 600, retargetTime = 1500, speed = BOT_SPEED;
    if (bot.team !== 0) aggressionRange = 900;
    if(isBloodMoonActive) { aggressionRange *= 1.5; retargetTime = 700; speed *= BLOOD_MOON_SPEED_BOOST; }
    if (bot.target && (!players[bot.target.id] || players[bot.target.id].health <= 0 || (bot.team !== 0 && bot.target.team === bot.team) )) bot.target = null;
    if (bot.health < MAX_HP * 0.4) bot.aiState = 'fleeing';
    else if (bot.target) bot.aiState = 'hunting';
    else bot.aiState = 'wandering';
    if (Date.now() - bot.lastActionTime > retargetTime) { bot.lastActionTime = Date.now(); if (bot.aiState !== 'fleeing') bot.target = findClosestTarget(bot, aggressionRange); }
    let targetX = 0, targetY = 0;
    switch(bot.aiState) {
        case 'fleeing': if (bot.target) { targetX = bot.x - (bot.target.x - bot.x); targetY = bot.y - (bot.target.y - bot.y); } else { targetX = bot.x > MAP_SIZE / 2 ? MAP_SIZE : 0; targetY = bot.y > MAP_SIZE / 2 ? MAP_SIZE : 0; } speed *= 1.2; break;
        case 'hunting': if (bot.target) { targetX = bot.target.x; targetY = bot.target.y; if (distanceSq(bot, bot.target) < (bot.swordLength + PLAYER_RADIUS)**2) attack(bot); } break;
        default: if (!bot.target || distanceSq(bot, bot.target) < 50**2) bot.target = { x: bot.x + getRandom(-300, 300), y: bot.y + getRandom(-300, 300) }; targetX = bot.target.x; targetY = bot.target.y; speed *= 0.7; break;
    }
    const targetAngle = Math.atan2(targetY - bot.y, targetX - bot.x);
    bot.angle += Math.sin(targetAngle - bot.angle) * 0.1;
    bot.x += Math.cos(bot.angle) * speed; bot.y += Math.sin(bot.angle) * speed;
}

function updateHealerBot(bot, deltaTime) {
    if (!localPlayer || localPlayer.health <= 0 || localPlayer.health >= MAX_HP) { if (!bot.target || distanceSq(bot, bot.target) < 50**2) bot.target = { x: bot.x + getRandom(-300, 300), y: bot.y + getRandom(-300, 300) }; }
    else { bot.target = localPlayer; }
    if (bot.target) {
        const targetAngle = Math.atan2(bot.target.y - bot.y, bot.target.x - bot.x);
        bot.angle += Math.sin(targetAngle - bot.angle) * 0.1;
        if (distanceSq(bot, bot.target) > 100**2) { bot.x += Math.cos(bot.angle) * BOT_SPEED; bot.y += Math.sin(bot.angle) * BOT_SPEED; }
        else if (bot.target === localPlayer) { localPlayer.health = Math.min(MAX_HP, localPlayer.health + HEALER_BOT_HEAL_RATE * deltaTime); if(random() < 0.2) createParticles(bot.x, bot.y, 1, 'rgba(72, 187, 120, 0.7)', 2, 1); }
    }
}

function updateShurikenBot(bot) {
    if (!bot.target || bot.target.health <= 0 || Date.now() - bot.lastActionTime > 3000) bot.target = findClosestTarget(bot, SHURIKEN_RANGE);
    if (!bot.target) return;
    const dist = distance(bot, bot.target), targetAngle = Math.atan2(bot.target.y - bot.y, bot.target.x - bot.x);
    bot.angle = targetAngle;
    if (dist > 300) { bot.x += Math.cos(bot.angle) * BOT_SPEED; bot.y += Math.sin(bot.angle) * BOT_SPEED; }
    else if (dist < 200) { bot.x -= Math.cos(bot.angle) * BOT_SPEED; bot.y -= Math.sin(bot.angle) * BOT_SPEED; }
    if (Date.now() - bot.lastActionTime > 1500) { bot.lastActionTime = Date.now(); projectiles.shurikens.push({ ownerId: bot.id, x: bot.x, y: bot.y, angle: bot.angle, origin: { x: bot.x, y: bot.y }, hitPlayers: new Set() }); }
}

function updateTankBot(bot, deltaTime) {
    let speed = BOT_SPEED * 0.7;
    if(isBloodMoonActive) speed *= BLOOD_MOON_SPEED_BOOST;
    if (!bot.target || bot.target.health <= 0 || Date.now() - bot.lastActionTime > 2000) bot.target = findClosestTarget(bot, 1000);
    if (!bot.target) return;
    const targetAngle = Math.atan2(bot.target.y - bot.y, bot.target.x - bot.x);
    bot.angle += Math.sin(targetAngle - bot.angle) * 0.05;
    bot.x += Math.cos(bot.angle) * speed; bot.y += Math.sin(bot.angle) * speed;
}

function updateStunBot(bot, deltaTime) {
    let speed = BOT_SPEED * 0.8;
    if (isBloodMoonActive) speed *= BLOOD_MOON_SPEED_BOOST;
    if (bot.aiState === 'slamming') {
        if (Date.now() - bot.lastActionTime > STUN_SLAM_WINDUP) {
            activeAoeZones.push({ x: bot.x, y: bot.y, radius: STUN_SLAM_RADIUS, windup: 0, duration: 300, damage: 10, startTime: Date.now(), type: 'stun' });
            bot.lastActionTime = Date.now(); bot.aiState = 'wandering';
        }
        return;
    }
    if (!bot.target || bot.target.health <= 0) bot.target = findClosestTarget(bot, 800);
    if (!bot.target) return;
    const targetAngle = Math.atan2(bot.target.y - bot.y, bot.target.x - bot.x);
    bot.angle = targetAngle;
    if (distanceSq(bot, bot.target) > (STUN_SLAM_RADIUS * 1.5)**2) { bot.x += Math.cos(bot.angle) * speed; bot.y += Math.sin(bot.angle) * speed; }
    else if (Date.now() - bot.lastActionTime > STUN_COOLDOWN) { bot.aiState = 'slamming'; bot.lastActionTime = Date.now(); }
}

function updateAlchemistBot(bot, deltaTime) {
    if (!bot.target || bot.target.health <= 0) bot.target = findClosestTarget(bot, 1000);
    if (!bot.target) return;
    const targetAngle = Math.atan2(bot.target.y - bot.y, bot.target.x - bot.x); bot.angle = targetAngle;
    const dist = distance(bot, bot.target);
    if (dist > 500) bot.x += Math.cos(targetAngle) * BOT_SPEED;
    else if (dist < 300) bot.x -= Math.cos(targetAngle) * BOT_SPEED;
    if (Date.now() - bot.lastActionTime > ALCHEMIST_THROW_COOLDOWN) {
        bot.lastActionTime = Date.now();
        projectiles.vials.push({ ownerId: bot.id, x: bot.x, y: bot.y, angle: bot.angle, origin: { x: bot.x, y: bot.y }, targetPos: {x: bot.target.x, y: bot.target.y} });
    }
}

function updateThiefBot(bot, deltaTime) {
    let speed = BOT_SPEED * THIEF_SPEED_MULTIPLIER;
    if (isBloodMoonActive) speed *= BLOOD_MOON_SPEED_BOOST;
    if (bot.aiState === 'fleeing' && Date.now() - bot.lastActionTime > 5000) bot.aiState = 'wandering';
    if (bot.aiState !== 'fleeing') {
        if (!bot.target || bot.target.health <= 0) bot.target = findClosestTarget(bot, 1200);
        if (bot.target) {
            const targetAngle = Math.atan2(bot.target.y - bot.y, bot.target.x - bot.x); bot.angle = targetAngle;
            bot.x += Math.cos(bot.angle) * speed; bot.y += Math.sin(bot.angle) * speed;
            if (distanceSq(bot, bot.target) < (PLAYER_RADIUS + 10)**2) {
                const stolen = Math.floor(bot.target.score * THIEF_STEAL_PERCENT);
                bot.target.score -= stolen;
                bot.stolenScore += stolen;
                bot.aiState = 'fleeing';
                bot.lastActionTime = Date.now();
            }
        }
    } else { // Fleeing
        bot.angle += 0.1; bot.x += Math.cos(bot.angle) * speed; bot.y += Math.sin(bot.angle) * speed;
    }
}


function updateProjectiles() {
    projectiles.thrownSwords = projectiles.thrownSwords.filter(s => { s.x += Math.cos(s.angle) * THROWN_SWORD_SPEED; s.y += Math.sin(s.angle) * THROWN_SWORD_SPEED; s.rotation += 0.2; return distanceSq(s, s.origin) < 500**2; });
    projectiles.shurikens = projectiles.shurikens.filter(s => { s.x += Math.cos(s.angle) * SHURIKEN_SPEED; s.y += Math.sin(s.angle) * SHURIKEN_SPEED; return distanceSq(s, s.origin) < SHURIKEN_RANGE**2; });
    projectiles.frostbolts = projectiles.frostbolts.filter(fb => { fb.x += Math.cos(fb.angle) * BOSS_LIST.frostwraith.novaProjectileSpeed; fb.y += Math.sin(fb.angle) * BOSS_LIST.frostwraith.novaProjectileSpeed; return distanceSq(fb, fb.origin) < 600**2; });
    projectiles.vials = projectiles.vials.filter(vial => {
        vial.x += Math.cos(vial.angle) * ALCHEMIST_PROJECTILE_SPEED;
        vial.y += Math.sin(vial.angle) * ALCHEMIST_PROJECTILE_SPEED;
        if(distanceSq(vial, vial.targetPos) < 20**2 || distanceSq(vial, vial.origin) > 500**2) {
            activeAoeZones.push({ x: vial.x, y: vial.y, radius: ALCHEMIST_POOL_RADIUS, windup: 0, duration: ALCHEMIST_POOL_DURATION, damage: 0, startTime: Date.now(), type: 'poison'});
            return false;
        }
        return true;
    });
}

function updateParticles(deltaTime) {
    for(let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.x += p.vx; p.y += p.vy; p.life -= deltaTime; if(p.life <= 0) particles.splice(i, 1); }
}

function updateAoeZones(deltaTime) {
    for (let i = activeAoeZones.length - 1; i >= 0; i--) {
        const zone = activeAoeZones[i];
        const now = Date.now();
        if (now - zone.startTime > zone.windup + zone.duration) { activeAoeZones.splice(i, 1); continue; }
        if (now - zone.startTime > zone.windup && !zone.hasDamaged) {
            if (zone.type === 'stun') {
                Object.values(players).forEach(p => { if (p && p.health > 0 && distanceSq(p, zone) < (p.radius + zone.radius)**2) { p.isStunned = true; p.stunEndTime = Date.now() + STUN_DURATION; } });
            }
            Object.values(players).forEach(p => { if (p && p.health > 0 && distanceSq(p, zone) < (p.radius + zone.radius)**2) takeDamage(p, zone.damage, null); });
            zone.hasDamaged = true;
        }
    }
}

function updateRandomEvents(now) {
    if(isBloodMoonActive && now > bloodMoonEndTime) {
        isBloodMoonActive = false;
        bloodMoonOverlay.classList.add('hidden');
    }

    if (now - lastEventCheckTime > 30000) { // Check every 30 seconds
        lastEventCheckTime = now;
        if (!isBloodMoonActive && random() < BLOOD_MOON_CHANCE) {
            isBloodMoonActive = true;
            bloodMoonEndTime = now + BLOOD_MOON_DURATION;
            bloodMoonOverlay.classList.remove('hidden');
            bloodMoonAnnouncementContainer.classList.remove('hidden');
            setTimeout(() => bloodMoonAnnouncementContainer.classList.add('hidden'), 5000);
        }
    }
}

function findClosestTarget(self, range) {
     let closest = null, closestDistSq = range ** 2;
     for(const id in players) {
         if (!players[id] || id === self.id || players[id].botType === 'healer' || players[id].isRemote) continue;
         const other = players[id];
         if (!other || other.health <= 0) continue;
         if (self.team !== 0 && self.team === other.team) continue;
         const dSq = distanceSq(self, other);
         if (dSq < closestDistSq) { closestDistSq = dSq; closest = other; }
     }
     return closest;
}

function updateArmor(player) { if (player.botType === 'tank') return; player.armor = Math.min(MAX_ARMOR, player.kills * ARMOR_PER_KILL); }

function updateSwordTier(player) {
    let currentTier = player.swordTier, nextTier = 0;
    for (const killCount in SWORD_TIERS) { if (player.kills >= killCount) nextTier = killCount; }
    if (nextTier > currentTier) createParticles(player.x, player.y, 30, SWORD_TIERS[nextTier].color, 4, 1.5);
    const tierInfo = SWORD_TIERS[nextTier];
    player.swordTier = nextTier; player.swordDamage = tierInfo.damage; player.swordColor = tierInfo.color; player.swordShape = tierInfo.shape;
}

function spawnBoss() {
    const spawnPoint = getSafeSpawnPoint();
    const bossType = bossSpawnCounter % 2 === 0 ? 'goliath' : 'frostwraith';
    const settings = BOSS_LIST[bossType];
    currentBoss = { ...settings, type: bossType, x: spawnPoint.x, y: spawnPoint.y, health: settings.maxHealth, aiState: 'idle', lastActionTime: Date.now(), actionData: {}, lastHitTime: 0, damageContributors: new Set() };
    bossName.textContent = settings.name;
    bossSpawnCounter++;
}

function updateGoliath(deltaTime) {
    if (!currentBoss || currentBoss.health <= 0) return;
    const now = Date.now();
    if (!currentBoss.target || currentBoss.target.health <= 0) currentBoss.target = findClosestTarget(currentBoss, MAP_SIZE);
    if (!currentBoss.target) return;

    const distToTarget = distance(currentBoss, currentBoss.target);
    const targetAngle = Math.atan2(currentBoss.target.y - currentBoss.y, currentBoss.target.x - currentBoss.x);

    switch(currentBoss.aiState) {
        case 'chasing':
            currentBoss.angle += Math.sin(targetAngle - currentBoss.angle) * 0.1;
            currentBoss.x += Math.cos(currentBoss.angle) * currentBoss.speed;
            currentBoss.y += Math.sin(currentBoss.angle) * currentBoss.speed;
            if (now - currentBoss.lastActionTime > 5000) {
                currentBoss.lastActionTime = now;
                if (distToTarget > 200 && random() < 0.6) { currentBoss.aiState = 'charging'; currentBoss.actionData.chargeAngle = targetAngle; currentBoss.lastActionTime = now; }
                else { currentBoss.aiState = 'slamming'; currentBoss.actionData.slamStartTime = now; }
            }
            break;
        case 'charging':
            currentBoss.x += Math.cos(currentBoss.actionData.chargeAngle) * currentBoss.chargeSpeed;
            currentBoss.y += Math.sin(currentBoss.actionData.chargeAngle) * currentBoss.chargeSpeed;
            Object.values(players).forEach(p => { if (p && p.health > 0 && distanceSq(currentBoss, p) < (currentBoss.radius + PLAYER_RADIUS)**2) takeDamage(p, currentBoss.damage * 1.5, null); });
            if (now - currentBoss.lastActionTime > currentBoss.chargeDuration) { currentBoss.aiState = 'chasing'; currentBoss.lastActionTime = now; }
            break;
        case 'slamming':
            if (now - currentBoss.actionData.slamStartTime > currentBoss.slamWindup) {
                addScreenShake(20);
                activeAoeZones.push({x: currentBoss.x, y: currentBoss.y, radius: currentBoss.slamRadius, windup: 0, duration: 500, damage: 0, startTime: now, type: 'goliathSlam' });
                Object.values(players).forEach(p => { if (p && p.health > 0 && distanceSq(currentBoss, p) < (currentBoss.slamRadius + PLAYER_RADIUS)**2) takeDamage(p, currentBoss.damage, null); });
                currentBoss.aiState = 'chasing';
                currentBoss.lastActionTime = now;
            }
            break;
    }
    currentBoss.x = Math.max(currentBoss.radius, Math.min(MAP_SIZE - currentBoss.radius, currentBoss.x));
    currentBoss.y = Math.max(currentBoss.radius, Math.min(MAP_SIZE - currentBoss.radius, currentBoss.y));
}

function updateFrostwraith(deltaTime) {
    if (!currentBoss || currentBoss.health <= 0) return;
    const now = Date.now();
    if (!currentBoss.target || currentBoss.target.health <= 0) currentBoss.target = findClosestTarget(currentBoss, MAP_SIZE);
    if (!currentBoss.target) return;

    const distToTarget = distance(currentBoss, currentBoss.target);
    const targetAngle = Math.atan2(currentBoss.target.y - currentBoss.y, currentBoss.target.x - currentBoss.x);
    currentBoss.angle = targetAngle;

    if (now - currentBoss.lastActionTime > currentBoss.teleportCooldown) {
        createParticles(currentBoss.x, currentBoss.y, 50, '#63b3ed', 5, 1);
        const newPos = getSafeSpawnPoint();
        currentBoss.x = newPos.x;
        currentBoss.y = newPos.y;
        currentBoss.lastActionTime = now;
        createParticles(currentBoss.x, currentBoss.y, 50, '#63b3ed', 5, 1);
        return;
    }

    if (now - (currentBoss.actionData.lastAttackTime || 0) > 3000) {
        if (random() > 0.5) {
             for(let i=0; i < currentBoss.novaProjectileCount; i++) projectiles.frostbolts.push({ ownerId: 'boss', x: currentBoss.x, y: currentBoss.y, angle: (i / currentBoss.novaProjectileCount) * Math.PI * 2, origin: {x: currentBoss.x, y: currentBoss.y}, hitPlayers: new Set() });
        } else {
            activeAoeZones.push({ x: currentBoss.target.x, y: currentBoss.target.y, radius: currentBoss.spikeZoneRadius, windup: currentBoss.spikeZoneWindup, duration: 2000, damage: currentBoss.spikeZoneDamage, startTime: now, type: 'iceSpike' });
        }
        currentBoss.actionData.lastAttackTime = now;
    }

    if (distToTarget < 400) { currentBoss.x -= Math.cos(targetAngle) * currentBoss.speed * 0.5; currentBoss.y -= Math.sin(targetAngle) * currentBoss.speed * 0.5; }
    else if (distToTarget > 600) { currentBoss.x += Math.cos(targetAngle) * currentBoss.speed; currentBoss.y += Math.sin(targetAngle) * currentBoss.speed; }
}


function spawnPowerUps(now) {
    if (now - lastPowerUpSpawnTime > POWERUP_SPAWN_INTERVAL && powerUps.length < MAX_POWERUPS) {
        lastPowerUpSpawnTime = now;
        const types = ['damage', 'speed', 'shield'];
        powerUps.push({ x: getRandom(100, MAP_SIZE - 100), y: getRandom(100, MAP_SIZE - 100), type: types[Math.floor(random() * types.length)], radius: 12 });
    }
}

function attack(player) {
    if (player.isDisarmed || player.isBlocking || player.isDashing || player.isWhirlwinding) return;
    const now = Date.now();
    const cooldown = ATTACK_COOLDOWN / (1 + player.upgrades.attackSpeed * 0.1);
    if (now - player.lastAttackTime > cooldown) { player.isAttacking = true; player.attackStartTime = now; player.lastAttackTime = now; }
}

function throwSword(player) {
    if (player.isDisarmed || player.isBlocking || player.isDashing) return;
    const now = Date.now();
    if (now - player.lastThrowTime > THROW_COOLDOWN) {
        player.lastThrowTime = now;
        player.isDisarmed = true;
        projectiles.thrownSwords.push({ ownerId: player.id, x: player.x, y: player.y, origin: { x: player.x, y: player.y }, angle: player.angle, length: player.swordLength, color: player.swordColor, shape: player.swordShape, damage: player.swordDamage * 1.5, rotation: 0, hitPlayers: new Set() });
    }
}

function startBlocking(player) {
    const now = Date.now();
    if (now - player.lastBlockTime > BLOCK_COOLDOWN) { player.isBlocking = true; player.lastBlockTime = now; }
}

function startDashing(player) {
    const now = Date.now();
    if (now - player.lastDashTime > DASH_COOLDOWN) { player.isDashing = true; player.lastDashTime = now; }
}

function startWhirlwind(player) {
    const now = Date.now();
    if (now - player.lastWhirlwindTime > WHIRLWIND_COOLDOWN) { player.isWhirlwinding = true; player.lastWhirlwindTime = now; }
}

function resetMap(requestSharedReset = true) {
    if (requestSharedReset && socket?.readyState === WebSocket.OPEN) {
        sendNetwork({ type: 'reset' });
        return;
    }
    mapResetting = true;
    mapResetTime = Date.now();

    Object.values(players).forEach(p => {
        if (p) {
            const spawnPoint = getSafeSpawnPoint();
            p.x = spawnPoint.x; p.y = spawnPoint.y; p.health = MAX_HP; p.score = 0; p.kills = 0; p.armor = 0; p.swordLength = BASE_SWORD_LENGTH;
            p.isDisarmed = false; p.isAttacking = false; p.isBlocking = false; p.isDashing = false;
            if (p.isLocal) p.upgrades = { speed: 0, attackSpeed: 0, healthRegen: 0 };
            updateSwordTier(p);
        }
    });
    generateInitialOrbs(MAX_ORBS);
    generateLavaPools(NUM_LAVA_POOLS);
    generateKothZones(NUM_KOTH_ZONES);
    generateCover(NUM_COVER_OBJECTS);
    projectiles = { thrownSwords: [], shurikens: [], frostbolts: [], vials: [] };
    xpOrbs = []; particles = []; powerUps = [];
    currentBoss = null;
    lastBossSpawnScore = 0;
    resetMapContainer.classList.add('hidden');
    isBloodMoonActive = false;
    if (bloodMoonOverlay) bloodMoonOverlay.classList.add('hidden');
}


function checkCollisions(deltaTime) {
    const allPlayers = Object.values(players).filter(p => p && p.health > 0);

    let scoreMultiplier = 1;
    if (localPlayer && localPlayer.health > 0) {
        for(const zone of kothZones) {
            if(distanceSq(localPlayer, zone) < zone.radius**2) {
                scoreMultiplier = KOTH_SCORE_MULTIPLIER;
                break;
            }
        }
    }

    for(const player of allPlayers) {
        if (player.isLocal) {
            for (const orbId in orbs) {
                const orb = orbs[orbId];
                if (distanceSq(player, orb) < (PLAYER_RADIUS + ORB_RADIUS)**2) {
                    player.score += (1 * scoreMultiplier);
                    player.health = Math.min(MAX_HP, player.health + ORB_HEAL_AMOUNT);
                    player.swordLength = BASE_SWORD_LENGTH + 25 * Math.log(player.score + 1);
                    delete orbs[orbId];
                    const newOrbId = `orb_${Date.now()}_${random()}`;
                    orbs[newOrbId] = { x: getRandom(ORB_RADIUS, MAP_SIZE - ORB_RADIUS), y: getRandom(ORB_RADIUS, MAP_SIZE - ORB_RADIUS), color: `hsl(${getRandom(0, 360)}, 100%, 50%)` };
                }
            }
            for (let i = xpOrbs.length - 1; i >= 0; i--) {
                const orb = xpOrbs[i];
                if (distanceSq(player, orb) < (PLAYER_RADIUS + orb.radius)**2) {
                    player.score += (orb.value * scoreMultiplier);
                    player.swordLength = BASE_SWORD_LENGTH + 25 * Math.log(player.score + 1);
                    xpOrbs.splice(i, 1);
                }
            }
            for (let i = powerUps.length - 1; i >= 0; i--) {
                const pu = powerUps[i];
                if (distanceSq(player, pu) < (PLAYER_RADIUS + pu.radius)**2) {
                    player.activePowerUp = pu.type;
                    player.powerUpEndTime = Date.now() + POWERUP_DURATION;
                    if (pu.type === 'shield') player.shield = MAX_HP * 0.5;
                    powerUps.splice(i, 1);
                }
            }
        }

        if (!player.isRemote && player.isAttacking) checkMeleeHit(player, allPlayers, scoreMultiplier);
        if (!player.isRemote && player.isWhirlwinding) checkWhirlwindHit(player, allPlayers, scoreMultiplier);
    }

    checkProjectileHits(allPlayers, scoreMultiplier);

    Object.values(players).forEach(p => { if (p && p.health <= 0) handleDeath(p); });

    if (!currentBoss) {
        const totalScore = Object.values(players).reduce((sum, p) => sum + (p ? p.score : 0), 0);
        if (totalScore > lastBossSpawnScore + BOSS_SPAWN_SCORE_INTERVAL) {
            spawnBoss();
            lastBossSpawnScore = Math.floor(totalScore / BOSS_SPAWN_SCORE_INTERVAL) * BOSS_SPAWN_SCORE_INTERVAL;
        }
    }
}

function checkMeleeHit(attacker, targets, scoreMultiplier) {
     const swingProgress = (Date.now() - attacker.attackStartTime) / SWING_DURATION;
     const currentSwingAngle = attacker.angle - (SWORD_ARC / 2) + (SWORD_ARC * swingProgress);

     for (const target of targets) {
         if (!target || target.health <= 0 || attacker.id === target.id) continue;
         if (attacker.team !== 0 && attacker.team === target.team) continue;
         if (distanceSq(attacker, target) < (attacker.swordLength + PLAYER_RADIUS)**2) {
              const angleToTarget = Math.atan2(target.y - attacker.y, target.x - attacker.x);
              const angleDiff = Math.abs(normalizeAngle(currentSwingAngle) - normalizeAngle(angleToTarget));
              if (Math.min(angleDiff, 2 * Math.PI - angleDiff) < SWORD_ARC * 0.3) {
                  takeDamage(target, attacker.swordDamage, attacker, scoreMultiplier);
              }
         }
     }
     if (currentBoss && currentBoss.health > 0) {
         if (distanceSq(attacker, currentBoss) < (attacker.swordLength + currentBoss.radius)**2) {
            const angleToTarget = Math.atan2(currentBoss.y - attacker.y, currentBoss.x - attacker.x);
            const angleDiff = Math.abs(normalizeAngle(currentSwingAngle) - normalizeAngle(angleToTarget));
            if (Math.min(angleDiff, 2 * Math.PI - angleDiff) < SWORD_ARC * 0.3) {
                takeBossDamage(attacker.swordDamage, attacker.id);
            }
         }
     }
}

function checkWhirlwindHit(attacker, targets, scoreMultiplier) {
    const hitKey = `${attacker.id}-${attacker.lastWhirlwindTime}`;
    for (const target of targets) {
        if (!target || target.health <= 0 || attacker.id === target.id) continue;
        if (target.lastWhirlwindHit === hitKey) continue;
        if (attacker.team !== 0 && attacker.team === target.team) continue;
        if (distanceSq(attacker, target) < (WHIRLWIND_RADIUS + PLAYER_RADIUS)**2) {
            takeDamage(target, attacker.swordDamage * 0.5, attacker, scoreMultiplier);
            target.lastWhirlwindHit = hitKey;
        }
    }
    if (currentBoss && currentBoss.health > 0 && currentBoss.lastWhirlwindHit !== hitKey) {
        if (distanceSq(attacker, currentBoss) < (WHIRLWIND_RADIUS + currentBoss.radius)**2) {
            takeBossDamage(attacker.swordDamage * 0.5, attacker.id);
            currentBoss.lastWhirlwindHit = hitKey;
        }
    }
}

function checkProjectileHits(targets, scoreMultiplier) {
    for (let i = projectiles.thrownSwords.length - 1; i >= 0; i--) {
        const sword = projectiles.thrownSwords[i];
        let removed = false;
        for (const target of targets) {
            if (!target || target.health <= 0) continue;
            const owner = players[sword.ownerId];
            if (sword.ownerId === target.id || sword.hitPlayers.has(target.id)) continue;
            if (owner && owner.team !== 0 && owner.team === target.team) continue;
            if (distanceSq(sword, target) < (PLAYER_RADIUS + SWORD_WIDTH)**2) {
                if (target.isBlocking) { projectiles.thrownSwords.splice(i, 1); removed = true; break; }
                else { if (owner) takeDamage(target, sword.damage, owner, scoreMultiplier); sword.hitPlayers.add(target.id); }
            }
        }
        if (removed) continue;
        if (currentBoss && currentBoss.health > 0) {
            if (distanceSq(sword, currentBoss) < (currentBoss.radius + SWORD_WIDTH)**2) { takeBossDamage(sword.damage, sword.ownerId); projectiles.thrownSwords.splice(i, 1); }
        }
    }

    for (let i = projectiles.shurikens.length - 1; i >= 0; i--) {
        const shuriken = projectiles.shurikens[i];
        let removed = false;
        for (const target of targets) {
            if (!target || target.health <= 0 || shuriken.hitPlayers.has(target.id)) continue;
            if (target.id === shuriken.ownerId) continue;
             if (distanceSq(shuriken, target) < PLAYER_RADIUS**2) {
                takeDamage(target, SHURIKEN_DAMAGE, players[shuriken.ownerId], scoreMultiplier);
                projectiles.shurikens.splice(i, 1); removed = true; break;
            }
        }
        if(removed) continue;
    }

    for (let i = projectiles.frostbolts.length - 1; i >= 0; i--) {
        const fb = projectiles.frostbolts[i];
        let removed = false;
        for (const target of targets) {
             if (distanceSq(fb, target) < (PLAYER_RADIUS + 5)**2) {
                takeDamage(target, BOSS_LIST.frostwraith.novaProjectileDamage, null);
                target.isSlowed = true;
                target.slowEndTime = Date.now() + 2000; // 2 sec slow
                projectiles.frostbolts.splice(i, 1); removed = true; break;
            }
        }
         if(removed) continue;
    }
}

function takeDamage(target, damage, attacker, scoreMultiplier = 1) {
    if (target.health <= 0 || (attacker && target.id === attacker.id)) return;
    if (target.isRemote) {
        if (attacker?.isLocal) sendNetwork({ type: 'hit', targetId: target.id, amount: damage });
        return;
    }
    if (attacker && attacker.botType === 'healer') return;
    if (attacker && target.team !== 0 && attacker.team === target.team) return;

    target.lastHitTime = Date.now();
    let finalDamage = damage;
    if (attacker && attacker.activePowerUp === 'damage') finalDamage *= 2;

    if (target.shield > 0) {
        const shieldDamage = Math.min(target.shield, finalDamage);
        target.shield -= shieldDamage;
        finalDamage -= shieldDamage;
    }
    if (finalDamage <= 0) return;

    const damageTaken = finalDamage * (1 - target.armor);
    target.health -= damageTaken;

    if (target.health <= 0) {
         if (attacker && attacker.health > 0) {
             const scoreGained = 10 + Math.floor(target.score / 2);
             attacker.score += (scoreGained * (attacker.isLocal ? scoreMultiplier : 1));
             attacker.swordLength = BASE_SWORD_LENGTH + 25 * Math.log(attacker.score + 1);
             attacker.kills++;
             updateArmor(attacker);
             updateSwordTier(attacker);
         }
    }
}

function takeBossDamage(damage, attackerId) {
    if (!currentBoss || currentBoss.health <= 0) return;
    let finalDamage = damage;
    const attacker = players[attackerId];
    if(attacker && attacker.activePowerUp === 'damage') finalDamage *= 2;
    currentBoss.health -= finalDamage;
    currentBoss.lastHitTime = Date.now();
    currentBoss.damageContributors.add(attackerId);
    if (currentBoss.health <= 0) handleBossDeath();
}

function handleDeath(player) {
     if (player.isLocal) {
         if (isDead) return;
         isDead = true;
         addScreenShake(15);
         createParticles(player.x, player.y, 50, 'white', 5, 2);
         deathScreen.classList.remove('hidden');
         finalScoreDisplay.textContent = Math.floor(player.score) || 0;
     } else if (!player.isRemote) {
        createParticles(player.x, player.y, 20, '#4A5568', 3, 1);
         if (player.score > 0) xpOrbs.push({ x: player.x, y: player.y, radius: 10 + Math.log(player.score + 1), value: player.score });
         const id = player.id;
         delete players[id];
         setTimeout(() => {
             if (!players[id]) players[id] = createPlayer(id, generateBotName(), false);
         }, 5000);
     }
}

function handleBossDeath() {
    createParticles(currentBoss.x, currentBoss.y, 200, 'red', 10, 3);
    addScreenShake(30);
    const rewardPerPlayer = 1000;
    const totalReward = rewardPerPlayer * (currentBoss.damageContributors ? currentBoss.damageContributors.size : 1);
    if (totalReward > 0) xpOrbs.push({ x: currentBoss.x, y: currentBoss.y, radius: 50, value: totalReward });
    if(currentBoss.damageContributors) currentBoss.damageContributors.forEach(id => { const p = players[id]; if (p && p.health > 0) p.score += rewardPerPlayer; });
    currentBoss = null;
}
function addScreenShake(amount) { screenShake = Math.max(screenShake, amount); }

function createParticles(x, y, count, color, speed, life) {
    for (let i = 0; i < count; i++) {
        const angle = random() * Math.PI * 2;
        const currentSpeed = random() * speed;
        particles.push({ x, y, vx: Math.cos(angle) * currentSpeed, vy: Math.sin(angle) * currentSpeed, life: random() * life, color, radius: random() * 3 + 1 });
    }
}


const CULL_BUFFER = 200;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    minimapCanvas.width = MINIMAP_SIZE;
    minimapCanvas.height = MINIMAP_SIZE;
}

function isVisible(obj, radius) {
    return obj.x + radius > camera.x - CULL_BUFFER &&
           obj.x - radius < camera.x + canvas.width + CULL_BUFFER &&
           obj.y + radius > camera.y - CULL_BUFFER &&
           obj.y - radius < camera.y + canvas.height + CULL_BUFFER;
}

function draw() {
     if (localPlayer && localPlayer.x && !isDead) { camera.x = localPlayer.x - canvas.width / 2; camera.y = localPlayer.y - canvas.height / 2; }

    if (screenShake > 0) {
        ctx.save();
        const shakeX = (random() - 0.5) * screenShake;
        const shakeY = (random() - 0.5) * screenShake;
        ctx.translate(shakeX, shakeY);
        screenShake *= 0.9;
        if (screenShake < 0.5) screenShake = 0;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    drawGrid();
    lavaPools.forEach(p => { if (isVisible(p, p.radius)) drawLava(p) });
    kothZones.forEach(z => { if (isVisible(z, z.radius)) drawKothZone(z) });
    Object.values(orbs).forEach(o => { if (o && isVisible(o, ORB_RADIUS)) drawOrb(o) });
    xpOrbs.forEach(o => { if (isVisible(o, o.radius)) drawXpOrb(o) });

    coverObjects.forEach(c => { if(c && isVisible(c, c.radius)) drawCover(c) });
    powerUps.forEach(p => { if(isVisible(p, p.radius)) drawPowerUp(p) });

    Object.values(projectiles).flat().forEach(p => { if (isVisible(p, 20)) drawProjectile(p) });

    activeAoeZones.forEach(drawAoeZone);
    Object.values(players).forEach(p => { if(p && isVisible(p, PLAYER_RADIUS)) drawPlayer(p) });
    if (currentBoss && isVisible(currentBoss, currentBoss.radius)) drawBoss();

    particles.forEach(drawParticle);

    ctx.restore();

    if (screenShake > 0) ctx.restore();


    if (mapResetting) {
        if (Date.now() - mapResetTime < 2000) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
            ctx.font = "bold 60px Roboto";
            ctx.textAlign = "center";
            ctx.fillText("MAP RESET!", canvas.width / 2, canvas.height / 2);
        } else {
            mapResetting = false;
        }
    }

    const now = Date.now();
    if (now - lastUiUpdateTime > 200) {
        updateUI();
        lastUiUpdateTime = now;
    }

    drawMinimap();
}

function drawGrid() {
    ctx.strokeStyle = "rgba(0,0,0,0.2)"; ctx.lineWidth = 1;
    const gridSize = 50;
    const startX = Math.floor(camera.x / gridSize) * gridSize, endX = Math.ceil((camera.x + canvas.width) / gridSize) * gridSize;
    const startY = Math.floor(camera.y / gridSize) * gridSize, endY = Math.ceil((camera.y + canvas.height) / gridSize) * gridSize;
    for (let x = startX; x < endX; x += gridSize) { ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke(); }
    for (let y = startY; y < endY; y += gridSize) { ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke(); }
}

function drawLava(pool) {
    const now = Date.now(), radius = pool.radius + Math.sin(now / 500 + pool.pulse) * 10;
    ctx.fillStyle = `rgba(255, ${100 + Math.sin(now / 300 + pool.pulse) * 20}, 0, 0.7)`;
    ctx.beginPath(); ctx.arc(pool.x, pool.y, radius, 0, Math.PI * 2); ctx.fill();
}

function drawKothZone(zone) {
    const now = Date.now(), alpha = 0.1 + Math.sin(now / 700 + zone.pulse) * 0.1;
    ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`; ctx.strokeStyle = `rgba(255, 215, 0, ${alpha * 2})`;
    ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}

function drawOrb(orb) { if(!orb) return; ctx.beginPath(); ctx.arc(orb.x, orb.y, ORB_RADIUS, 0, Math.PI * 2); ctx.fillStyle = orb.color; ctx.fill(); }

function drawXpOrb(orb) {
    ctx.fillStyle = '#48bb78'; ctx.beginPath(); ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "white"; ctx.font = "bold 12px Roboto"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(orb.value, orb.x, orb.y);
}

function drawWeapon(ctx, shape, length, width, color, alpha = 1) {
    ctx.fillStyle = color;
    if (alpha < 1) { const r = parseInt(color.slice(1, 3), 16), g = parseInt(color.slice(3, 5), 16), b = parseInt(color.slice(5, 7), 16); ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`; }
    ctx.beginPath();
    switch(shape) {
        case 'katana': ctx.moveTo(0, -width/2); ctx.quadraticCurveTo(length * 0.9, -width*0.1, length, 0); ctx.quadraticCurveTo(length * 0.9, width*0.1, 0, width/2); break;
        case 'trident': ctx.rect(0, -width/4, length*0.7, width/2); ctx.moveTo(length*0.7, -width/4); ctx.lineTo(length, 0); ctx.lineTo(length*0.7, width/4); ctx.moveTo(length*0.6, -width*0.8); ctx.lineTo(length*0.85, -width*0.5); ctx.lineTo(length*0.6, -width*0.2); ctx.moveTo(length*0.6, width*0.8); ctx.lineTo(length*0.85, width*0.5); ctx.lineTo(length*0.6, width*0.2); break;
        case 'scimitar': ctx.moveTo(0, -width/2); ctx.quadraticCurveTo(length * 0.7, 0, length, width * 1.5); ctx.quadraticCurveTo(length * 0.7, width/2, 0, width/2); break;
        case 'axe': const headSize = length * 0.6; ctx.rect(0, -width/2, length*0.8, width); ctx.moveTo(length*0.8, -headSize/2); ctx.arc(length*0.8, 0, headSize/2, -Math.PI/2.2, Math.PI/2.2); break;
        case 'spear': ctx.rect(0, -width/3, length*0.9, width/1.5); ctx.moveTo(length*0.9, -width*0.8); ctx.lineTo(length, 0); ctx.lineTo(length*0.9, width*0.8); break;
        case 'greatsword': ctx.moveTo(0, -width); ctx.lineTo(length * 0.8, -width * 0.7); ctx.lineTo(length, 0); ctx.lineTo(length * 0.8, width * 0.7); ctx.lineTo(0, width); break;
        case 'claymore': ctx.moveTo(0, -width * 1.5); ctx.lineTo(0, width * 1.5); ctx.lineTo(-width, width * 1.5); ctx.lineTo(-width, -width * 1.5); ctx.closePath(); ctx.moveTo(0, -width/2); ctx.lineTo(length, 0); ctx.lineTo(0, width/2); break;
        case 'halberd': ctx.rect(0, -width/4, length*0.9, width/2); ctx.moveTo(length*0.9, -width*1.2); ctx.lineTo(length, -width*0.8); ctx.lineTo(length, width*0.8); ctx.lineTo(length*0.9, width*1.2); ctx.moveTo(length*0.9, -width*0.2); ctx.lineTo(length+width, 0); ctx.lineTo(length*0.9, width*0.2); break;
        case 'scythe': ctx.rect(0, -width/4, length*0.95, width/2); ctx.moveTo(length*0.95, -width/4); ctx.quadraticCurveTo(length, -length*0.4, length*0.6, -length*0.5); ctx.quadraticCurveTo(length*0.5, -length*0.55, length*0.4, -length*0.4); break;
        default: ctx.moveTo(0, -width/2); ctx.lineTo(length, 0); ctx.lineTo(0, width/2); break;
    }
    ctx.closePath(); ctx.fill();
}

function drawProjectile(p) {
    if (p.rotation) drawThrownSword(p);
    else if (p.radius) drawPowerUp(p);
    else if (projectiles.shurikens.includes(p)) drawShuriken(p);
    else if (projectiles.frostbolts.includes(p)) drawFrostbolt(p);
}

function drawThrownSword(sword) { ctx.save(); ctx.translate(sword.x, sword.y); ctx.rotate(sword.rotation); drawWeapon(ctx, sword.shape, sword.length, SWORD_WIDTH, sword.color); ctx.restore(); }

function drawShuriken(shuriken) {
    ctx.save(); ctx.translate(shuriken.x, shuriken.y); ctx.rotate(Date.now() / 100);
    ctx.fillStyle = '#4A5568'; ctx.beginPath();
    for (let i = 0; i < 4; i++) { const angle = i * Math.PI / 2; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(angle) * 10, Math.sin(angle) * 10); ctx.lineTo(Math.cos(angle + Math.PI/4) * 5, Math.sin(angle + Math.PI/4) * 5); }
    ctx.closePath(); ctx.fill(); ctx.restore();
}

function drawFrostbolt(fb) { ctx.fillStyle = '#63b3ed'; ctx.beginPath(); ctx.arc(fb.x, fb.y, 5, 0, Math.PI * 2); ctx.fill(); }

function drawParticle(p) { ctx.fillStyle = p.color; ctx.globalAlpha = p.life > 1 ? 1 : p.life; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }

function drawCover(cover) {
    const healthPercent = cover.health / cover.maxHealth;
    ctx.fillStyle = `rgb(${150 + 105 * healthPercent}, ${150 + 105 * healthPercent}, 255)`; ctx.strokeStyle = '#a0aec0';
    ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cover.x, cover.y, cover.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (healthPercent < 0.6) { ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cover.x, cover.y - cover.radius); ctx.lineTo(cover.x, cover.y + cover.radius); ctx.stroke(); }
    if (healthPercent < 0.3) { ctx.beginPath(); ctx.moveTo(cover.x - cover.radius, cover.y); ctx.lineTo(cover.x + cover.radius, cover.y); ctx.stroke(); }
}

function drawPowerUp(pu) {
    let color = 'white';
    if (pu.type === 'damage') color = '#ef4444'; if (pu.type === 'speed') color = '#f59e0b'; if (pu.type === 'shield') color = '#3b82f6';
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(pu.x, pu.y, pu.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'white'; ctx.lineWidth = 3; ctx.stroke();
}

function drawAoeZone(zone) {
    const now = Date.now(), elapsed = now - zone.startTime;
    if(zone.type === 'iceSpike') {
        if (elapsed < zone.windup) { const progress = elapsed / zone.windup; ctx.fillStyle = `rgba(99, 179, 237, ${0.1 + progress * 0.3})`; ctx.beginPath(); ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2); ctx.fill(); }
        else {
             const fade = 1 - ((elapsed - zone.windup) / zone.duration);
            ctx.fillStyle = `rgba(199, 229, 255, ${0.8 * fade})`;
             for(let i=0; i < 10; i++) {
                 const angle = i * Math.PI * 2 / 10, dist = (i % 2 === 0 ? 0.7 : 0.4) * zone.radius;
                 ctx.beginPath(); ctx.moveTo(zone.x + Math.cos(angle)*dist, zone.y + Math.sin(angle)*dist - 30 * fade);
                 ctx.lineTo(zone.x + Math.cos(angle)*dist - 10, zone.y + Math.sin(angle)*dist);
                 ctx.lineTo(zone.x + Math.cos(angle)*dist + 10, zone.y + Math.sin(angle)*dist);
                 ctx.closePath(); ctx.fill();
             }
        }
    } else if (zone.type === 'goliathSlam') {
        const shockwaveProgress = (now - zone.startTime) / zone.duration;
        if(shockwaveProgress < 1) {
            ctx.strokeStyle = `rgba(255, 0, 0, ${1 - shockwaveProgress})`; ctx.lineWidth = 15 * (1 - shockwaveProgress);
            ctx.beginPath(); ctx.arc(zone.x, zone.y, zone.radius * shockwaveProgress, 0, Math.PI * 2); ctx.stroke();
        }
    }
}

function drawPlayer(player) {
    if (player.health <= 0) return;
    const hitFlash = Date.now() - player.lastHitTime < 100;

    let playerColor = "#000000";
    if (hitFlash) playerColor = "white";
    else { switch (player.botType) { case 'healer': playerColor = '#48BB78'; break; case 'shuriken': playerColor = '#A0AEC0'; break; } if (player.isLocal || player.isRemote) playerColor = "#FFFFFF"; }

    if (player.activePowerUp) {
        let auraColor = '';
        if (player.activePowerUp === 'damage') auraColor = 'rgba(239, 68, 68, 0.3)';
        if (player.activePowerUp === 'speed') auraColor = 'rgba(245, 158, 11, 0.3)';
        if(auraColor) { ctx.fillStyle = auraColor; ctx.beginPath(); ctx.arc(player.x, player.y, PLAYER_RADIUS * 1.5, 0, Math.PI*2); ctx.fill(); }
    }
    if (!player.isLocal && player.team !== 0) { ctx.strokeStyle = player.team === 1 ? "#63b3ed" : "#f56565"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(player.x, player.y, PLAYER_RADIUS + 4, 0, Math.PI * 2); ctx.stroke(); }
    if (player.isLocal && player.isDashing) { for(let i = 0; i < player.pastPositions.length; i++) { const pos = player.pastPositions[i]; ctx.beginPath(); ctx.arc(pos.x, pos.y, PLAYER_RADIUS, 0, Math.PI * 2); ctx.fillStyle = `rgba(255, 255, 255, ${0.05 * i})`; ctx.fill(); } }
    if (player.isWhirlwinding) { const progress = (Date.now() - player.lastWhirlwindTime) / WHIRLWIND_DURATION; ctx.strokeStyle = `rgba(255, 255, 255, ${1 - progress})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(player.x, player.y, WHIRLWIND_RADIUS * progress, 0, Math.PI * 2); ctx.stroke(); }

    let swordAngle = player.angle; const length = player.isDisarmed ? 15 : player.swordLength;
    if (player.isAttacking) {
        const swingProgress = (Date.now() - player.attackStartTime) / SWING_DURATION;
        for (let i = 0; i < 3; i++) {
            const p = swingProgress - (i * 0.1);
            if (p > 0 && p < 1) { ctx.save(); ctx.translate(player.x, player.y); const arcAngle = player.angle - (SWORD_ARC / 2) + (SWORD_ARC * p); ctx.rotate(arcAngle); drawWeapon(ctx, player.swordShape, length, SWORD_WIDTH, player.swordColor, 0.3 - i*0.1); ctx.restore(); }
        }
        swordAngle = player.angle - (SWORD_ARC / 2) + (SWORD_ARC * swingProgress);
    }
    ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(swordAngle); if (!player.isDisarmed) drawWeapon(ctx, player.swordShape, length, SWORD_WIDTH, player.swordColor); ctx.restore();

    ctx.beginPath(); ctx.arc(player.x, player.y, PLAYER_RADIUS, 0, Math.PI * 2); ctx.fillStyle = playerColor; ctx.fill();
    if(player.shield > 0) { ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 4; ctx.globalAlpha = 0.5 + (player.shield / (MAX_HP * 0.5)) * 0.5; ctx.beginPath(); ctx.arc(player.x, player.y, PLAYER_RADIUS + 6, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    if (player.isSlowed && Date.now() < player.slowEndTime) { ctx.fillStyle = 'rgba(99, 179, 237, 0.4)'; ctx.beginPath(); ctx.arc(player.x, player.y, PLAYER_RADIUS, 0, Math.PI * 2); ctx.fill(); }
    if (player.isBlocking) { ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(player.angle); ctx.fillStyle = "rgba(100, 180, 255, 0.5)"; ctx.strokeStyle = "rgba(200, 220, 255, 0.8)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(PLAYER_RADIUS, 0, PLAYER_RADIUS * 1.5, -Math.PI / 3, Math.PI / 3); ctx.stroke(); ctx.fill(); ctx.restore(); }

    ctx.fillStyle = "white"; ctx.font = "12px Roboto"; ctx.textAlign = "center"; ctx.fillText(player.name, player.x, player.y - PLAYER_RADIUS - 15);
    const hpWidth = 30;
    ctx.fillStyle = "#4a5568"; ctx.fillRect(player.x - hpWidth / 2, player.y - PLAYER_RADIUS - 10, hpWidth, 5);
    ctx.fillStyle = "#48bb78"; ctx.fillRect(player.x - hpWidth / 2, player.y - PLAYER_RADIUS - 10, hpWidth * (player.health / MAX_HP), 5);
}

function drawBoss() {
    if (!currentBoss || currentBoss.health <= 0) return;
    const hitFlash = Date.now() - currentBoss.lastHitTime < 100;

    if (currentBoss.type === 'goliath') {
        ctx.save(); ctx.translate(currentBoss.x, currentBoss.y); ctx.rotate(currentBoss.angle);
        const length = 100, width = 20; ctx.fillStyle = '#4a5568'; ctx.fillRect(-20, -width/2, length*0.8, width);
        ctx.beginPath(); ctx.fillStyle = '#e53e3e'; ctx.moveTo(length*0.8, -length*0.6); ctx.arc(length*0.8, 0, length*0.6, -Math.PI/2.1, Math.PI/2.1); ctx.closePath(); ctx.fill();
        ctx.restore();
    } else if (currentBoss.type === 'frostwraith') {
        const now = Date.now();
        for(let i=0; i < 3; i++) {
            const angle = (now / 500) + (i * Math.PI * 2 / 3);
            const dist = 30 + Math.sin(now/300 + i) * 5;
            ctx.fillStyle = `rgba(99, 179, 237, 0.7)`;
            ctx.beginPath();
            ctx.arc(currentBoss.x + Math.cos(angle) * dist, currentBoss.y + Math.sin(angle) * dist, 8, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.beginPath(); ctx.arc(currentBoss.x, currentBoss.y, currentBoss.radius, 0, Math.PI * 2); ctx.fillStyle = hitFlash ? 'white' : '#1a202c'; ctx.fill();
    ctx.strokeStyle = currentBoss.type === 'goliath' ? '#e53e3e' : '#63b3ed'; ctx.lineWidth = 5; ctx.stroke();
}

function drawMinimap() {
    const scale = minimapCanvas.width / MAP_SIZE;
    minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    minimapCtx.fillStyle = 'rgba(0, 0, 0, 0.3)'; minimapCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    minimapCtx.fillStyle = 'rgba(255, 215, 0, 0.2)';
    kothZones.forEach(zone => { minimapCtx.beginPath(); minimapCtx.arc(zone.x * scale, zone.y * scale, zone.radius * scale, 0, Math.PI * 2); minimapCtx.fill(); });
    minimapCtx.fillStyle = 'rgba(255, 100, 0, 0.5)';
    lavaPools.forEach(pool => { minimapCtx.beginPath(); minimapCtx.arc(pool.x * scale, pool.y * scale, pool.radius * scale, 0, Math.PI * 2); minimapCtx.fill(); });
    if (currentBoss && currentBoss.health > 0) { minimapCtx.fillStyle = '#e53e3e'; minimapCtx.beginPath(); minimapCtx.arc(currentBoss.x * scale, currentBoss.y * scale, 5, 0, Math.PI * 2); minimapCtx.fill(); }

    Object.values(players).forEach(p => {
        if (p && p.health > 0) {
            if (p.isLocal || p.isRemote) minimapCtx.fillStyle = '#ffffff';
            else if (p.botType === 'healer') minimapCtx.fillStyle = '#48BB78'; else if (p.botType === 'shuriken') minimapCtx.fillStyle = '#A0AEC0';
            else if (p.team === 1) minimapCtx.fillStyle = '#63b3ed'; else if (p.team === 2) minimapCtx.fillStyle = '#f56565';
            else minimapCtx.fillStyle = '#000000';
            minimapCtx.beginPath(); minimapCtx.arc(p.x * scale, p.y * scale, 3, 0, Math.PI * 2); minimapCtx.fill();
        }
    });
}

function updateUI() {
    if (localPlayer && !isDead) {
        scoreDisplay.textContent = `Score: ${Math.floor(localPlayer.score)}`;
        if (localPlayer.score >= SCORE_TO_RESET) { resetMapContainer.classList.remove('hidden'); }
        else { resetMapContainer.classList.add('hidden'); }
        updatePlayerStatsUI();
        updateUpgradesUI();
    } else {
        upgradesList.innerHTML = '';
        resetMapContainer.classList.add('hidden');
    }
    updateLeaderboard();
    updateBossUI();
}

function updateLeaderboard() {
    const sortedPlayers = Object.values(players).filter(p=>p).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 10);
    leaderboardList.innerHTML = '';
    sortedPlayers.forEach(p => { if (!p) return; const li = document.createElement('li'); li.className = `flex justify-between ${p.isLocal ? 'font-bold text-blue-300' : ''}`; li.innerHTML = `<span>${p.name}</span><span>${Math.floor(p.score)}</span>`; leaderboardList.appendChild(li); });
}

function updatePlayerStatsUI() {
    if (!localPlayer || typeof localPlayer.swordTier === 'undefined' || !gameStarted || isDead) { playerStatsList.innerHTML = ''; return; }
    const swordTierInfo = SWORD_TIERS[localPlayer.swordTier]; if (!swordTierInfo) return;
    const now = Date.now(), dashCD = Math.min(1, (now - localPlayer.lastDashTime) / DASH_COOLDOWN), wwCD = Math.min(1, (now - localPlayer.lastWhirlwindTime) / WHIRLWIND_COOLDOWN);
    playerStatsList.innerHTML = `
        <li class="flex justify-between"><span>Kills:</span> <span>${localPlayer.kills}</span></li>
        <li class="flex justify-between"><span>Online:</span> <span>${onlinePlayers}</span></li>
        <li class="flex justify-between"><span>Armor:</span> <span>${Math.round(localPlayer.armor * 100)}%</span></li>
        <li class="flex justify-between"><span>Weapon:</span> <span style="color: ${swordTierInfo.color};">${swordTierInfo.name}</span></li>
        <li class="flex justify-between items-center"><span>Dash [Shift]:</span><div class="w-2/5 bg-gray-600 rounded-full h-2.5"><div class="bg-blue-400 h-2.5 rounded-full" style="width: ${dashCD * 100}%"></div></div></li>
        <li class="flex justify-between items-center"><span>Whirlwind [E]:</span><div class="w-2/5 bg-gray-600 rounded-full h-2.5"><div class="bg-purple-400 h-2.5 rounded-full" style="width: ${wwCD * 100}%"></div></div></li>
    `;
}

const UPGRADE_DEFINITIONS = { speed: { name: 'Move Speed', baseCost: 50, maxLevel: 5 }, attackSpeed: { name: 'Attack Speed', baseCost: 75, maxLevel: 5 }, healthRegen: { name: 'HP Regen', baseCost: 100, maxLevel: 3 } };
function getUpgradeCost(type) { const def = UPGRADE_DEFINITIONS[type], level = localPlayer.upgrades[type]; return def.baseCost * (level + 1) * (level * 0.5 + 1); }
function purchaseUpgrade(type) { if (!localPlayer || isDead || !localPlayer.upgrades) return; const def = UPGRADE_DEFINITIONS[type], level = localPlayer.upgrades[type]; if (level >= def.maxLevel) return; const cost = getUpgradeCost(type); if (localPlayer.score >= cost) { localPlayer.score -= cost; localPlayer.upgrades[type]++; } }

function updateUpgradesUI() {
    if (!localPlayer || !localPlayer.upgrades) { upgradesList.innerHTML = ''; return; }
    upgradesList.innerHTML = '';
    for (const type in UPGRADE_DEFINITIONS) {
        const def = UPGRADE_DEFINITIONS[type], level = localPlayer.upgrades[type], cost = getUpgradeCost(type), isMaxLevel = level >= def.maxLevel, canAfford = localPlayer.score >= cost;
        const li = document.createElement('li'); li.className = 'flex justify-between items-center text-sm';
        li.innerHTML = `<span>${def.name} [${level}/${def.maxLevel}]</span><button data-upgrade-type="${type}" class="ui-element px-2 py-1 rounded ${isMaxLevel ? 'bg-gray-500 cursor-not-allowed' : canAfford ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 opacity-50 cursor-not-allowed'} text-xs">${isMaxLevel ? 'MAX' : `Cost: ${Math.round(cost)}`}</button>`;
        upgradesList.appendChild(li);
    }
}

function updateBossUI() {
    if (currentBoss && currentBoss.health > 0) { bossUI.classList.remove('hidden'); const hpPercent = (currentBoss.health / currentBoss.maxHealth) * 100; bossHpBar.style.width = `${hpPercent}%`; }
    else { bossUI.classList.add('hidden'); }
}

// --- Event Listeners ---
window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; }, { signal: lifecycle.signal });
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; }, { signal: lifecycle.signal });
window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { signal: lifecycle.signal });
window.addEventListener('mousedown', (e) => { if(e.button === 0) mouse.down = true; if(e.button === 1) { mouse.middleDown = true; e.preventDefault(); } if(e.button === 2) { mouse.rightDown = true; e.preventDefault(); } }, { signal: lifecycle.signal });
window.addEventListener('mouseup', (e) => { if(e.button === 0) mouse.down = false; if(e.button === 1) { mouse.middleDown = false; e.preventDefault(); } if(e.button === 2) { mouse.rightDown = false; e.preventDefault(); } }, { signal: lifecycle.signal });
window.addEventListener('contextmenu', e => e.preventDefault(), { signal: lifecycle.signal });
startButton.addEventListener('click', () => joinGame(nameInput.value), { signal: lifecycle.signal });
respawnButton.addEventListener('click', () => respawnPlayer(), { signal: lifecycle.signal });
instructionsButton.addEventListener('click', () => instructionsModal.classList.remove('hidden'), { signal: lifecycle.signal });
closeInstructionsButton.addEventListener('click', () => instructionsModal.classList.add('hidden'), { signal: lifecycle.signal });
resetMapButton.addEventListener('click', () => resetMap(), { signal: lifecycle.signal });
upgradesList.addEventListener('click', (e) => { if (e.target && e.target.dataset.upgradeType) purchaseUpgrade(e.target.dataset.upgradeType); }, { signal: lifecycle.signal });

connectMultiplayer();

return {
    destroy() {
        destroyed = true;
        lifecycle.abort();
        cancelAnimationFrame(animationFrameId);
        clearInterval(networkTimer);
        clearTimeout(reconnectTimer);
        socket?.close();
    }
};
}
