import Phaser from 'phaser';
import { get } from 'svelte/store';
import { CHEST_STATS, PLAYER_RADIUS, WORLD_HALF, WORLD_SIZE } from '../../shared/config.js';
import { EVOLUTIONS } from '../../shared/evolutions.js';
import type { ChestState, CoinState, MovementInput, PlayerState, Snapshot, SwordState } from '../../shared/types.js';
import { gameSocket } from '../lib/socket.js';
import { ui } from '../lib/state.js';

interface ActorView {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Arc;
  sword: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
  healthBack: Phaser.GameObjects.Rectangle;
  health: Phaser.GameObjects.Rectangle;
  target: PlayerState;
  wasAttacking: boolean;
}

const colorNumber = (color: string): number => Phaser.Display.Color.HexStringToColor(color).color;

export class ArenaScene extends Phaser.Scene {
  private actors = new Map<string, ActorView>();
  private coinViews = new Map<string, Phaser.GameObjects.Image>();
  private chestViews = new Map<string, Phaser.GameObjects.Container>();
  private swordViews = new Map<string, Phaser.GameObjects.Rectangle>();
  private latest?: Snapshot;
  private selfId = '';
  private sequence = 0;
  private lastInputAt = 0;
  private lastFpsAt = 0;
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;
  private releaseSnapshot?: () => void;
  private releaseSettings?: () => void;
  private previousSelf?: PlayerState;
  private musicStarted = false;

  constructor() { super({ key: 'arena' }); }

  preload(): void {
    this.load.audio('opening-music', '/assets/sound/opening.mp3');
    this.load.audio('coin-sound', '/assets/sound/coin.m4a');
    this.load.audio('damage-sound', '/assets/sound/damage.mp3');
    this.load.audio('hit-sound', '/assets/sound/hitenemy.wav');
    this.load.audio('chest-sound', '/assets/sound/chest.wav');
    this.load.image('chest-uncommon', '/assets/images/chests/uncommonChest.png');
    this.load.image('chest-rare', '/assets/images/chests/rareChest.png');
    this.load.image('chest-legendary', '/assets/images/chests/legendaryChest.png');
    this.load.image('chest-mythical', '/assets/images/chests/mythicalChest.png');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#09131d');
    this.cameras.main.setBounds(-WORLD_HALF, -WORLD_HALF, WORLD_SIZE, WORLD_SIZE);
    this.physics?.world?.setBounds(-WORLD_HALF, -WORLD_HALF, WORLD_SIZE, WORLD_SIZE);
    this.createTextures();
    this.drawWorld();
    this.keys = this.input.keyboard?.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key> | undefined;
    this.input.keyboard?.on('keydown-E', () => gameSocket.ability());
    this.input.keyboard?.on('keydown-SPACE', () => gameSocket.ability());
    this.input.keyboard?.on('keydown-Q', () => gameSocket.throwSword());
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => { if (pointer.rightButtonDown()) gameSocket.throwSword(); });
    this.input.mouse?.disableContextMenu();
    this.releaseSnapshot = gameSocket.onSnapshot((snapshot) => this.applySnapshot(snapshot));
    this.releaseSettings = ui.subscribe((state) => this.cameras.main.setZoom(state.settings.cameraZoom));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.releaseSnapshot?.(); this.releaseSettings?.();
    });
  }

  update(time: number): void {
    for (const view of this.actors.values()) this.updateActor(view, time);
    if (time - this.lastInputAt > 42) { this.sendInput(); this.lastInputAt = time; }
    if (time - this.lastFpsAt > 750) {
      ui.update((state) => ({ ...state, fps: Math.round(this.game.loop.actualFps) }));
      this.lastFpsAt = time;
    }
  }

  private createTextures(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0xfacc15, 1).fillCircle(12, 12, 9);
    graphics.lineStyle(3, 0xfef08a, 0.9).strokeCircle(12, 12, 9);
    graphics.generateTexture('coin', 24, 24); graphics.clear();
    graphics.fillStyle(0xffffff, 1).fillRoundedRect(0, 0, 74, 14, 7);
    graphics.generateTexture('sword', 74, 14); graphics.clear();
    graphics.fillStyle(0xffffff, 1).fillCircle(32, 32, 28);
    graphics.generateTexture('fighter', 64, 64); graphics.destroy();
  }

  private drawWorld(): void {
    const background = this.add.graphics().setDepth(-100);
    background.fillGradientStyle(0x0f4c67, 0x176b87, 0x0b3954, 0x145d73, 1);
    background.fillRect(-WORLD_HALF, -WORLD_HALF, WORLD_SIZE / 3, WORLD_SIZE);
    background.fillGradientStyle(0x37171c, 0x552127, 0x2b1218, 0x4a1c22, 1);
    background.fillRect(-WORLD_HALF + WORLD_SIZE / 3, -WORLD_HALF, WORLD_SIZE / 3, WORLD_SIZE);
    background.fillGradientStyle(0x8d5524, 0xc17b32, 0x76421e, 0xb16d2c, 1);
    background.fillRect(-WORLD_HALF + WORLD_SIZE * 2 / 3, -WORLD_HALF, WORLD_SIZE / 3, WORLD_SIZE);

    background.lineStyle(1, 0xffffff, 0.055);
    for (let position = -WORLD_HALF; position <= WORLD_HALF; position += 250) {
      background.lineBetween(position, -WORLD_HALF, position, WORLD_HALF);
      background.lineBetween(-WORLD_HALF, position, WORLD_HALF, position);
    }
    background.lineStyle(18, 0xe2e8f0, 0.18).strokeRect(-WORLD_HALF, -WORLD_HALF, WORLD_SIZE, WORLD_SIZE);
    this.drawWorldDetails(background);
  }

  private drawWorldDetails(graphics: Phaser.GameObjects.Graphics): void {
    const random = seededRandom(8_008);
    for (let index = 0; index < 55; index += 1) {
      const x = -WORLD_HALF + random() * (WORLD_SIZE / 3 - 140);
      const y = -WORLD_HALF + 100 + random() * (WORLD_SIZE - 200);
      graphics.lineStyle(5, 0x67e8f9, 0.13).beginPath();
      graphics.moveTo(x - 50, y); graphics.lineTo(x - 18, y - 14); graphics.lineTo(x + 18, y + 14); graphics.lineTo(x + 55, y); graphics.strokePath();
      if (index % 8 === 0) { graphics.fillStyle(0x7a8f55, 0.8).fillCircle(x + 80, y + 45, 52 + random() * 50); graphics.fillStyle(0xd6b875, 0.9).fillCircle(x + 80, y + 45, 39 + random() * 35); }
    }
    for (let index = 0; index < 34; index += 1) {
      const x = -WORLD_HALF + WORLD_SIZE / 3 + 160 + random() * (WORLD_SIZE / 3 - 320);
      const y = -WORLD_HALF + 160 + random() * (WORLD_SIZE - 320);
      const radius = 55 + random() * 105;
      graphics.fillStyle(0xff5c00, 0.45).fillCircle(x, y, radius + 22);
      graphics.fillStyle(0xff7a00, 0.82).fillCircle(x, y, radius);
      graphics.lineStyle(4, 0xffd166, 0.35).strokeCircle(x, y, radius * 0.68);
    }
    for (let index = 0; index < 60; index += 1) {
      const x = -WORLD_HALF + WORLD_SIZE * 2 / 3 + 120 + random() * (WORLD_SIZE / 3 - 240);
      const y = -WORLD_HALF + 100 + random() * (WORLD_SIZE - 200);
      if (index % 11 === 0) {
        graphics.fillStyle(0x22d3ee, 0.72).fillEllipse(x, y, 190, 105);
        graphics.lineStyle(15, 0x4d7c0f, 0.6).strokeEllipse(x, y, 220, 132);
      } else {
        graphics.lineStyle(12, 0x3f6f45, 0.8).lineBetween(x, y + 28, x, y - 28);
        graphics.lineBetween(x, y - 3, x + 24, y - 17);
      }
    }
    const labels = [
      { x: -WORLD_SIZE / 3, text: 'THE SHOALS' },
      { x: 0, text: 'ASHEN WASTE' },
      { x: WORLD_SIZE / 3, text: 'SUNSCORCH' }
    ];
    for (const label of labels) this.add.text(label.x, -WORLD_HALF + 260, label.text, { color: '#ffffff', fontFamily: 'Georgia, serif', fontSize: '96px', fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0.09).setDepth(-90);
  }

  private applySnapshot(snapshot: Snapshot): void {
    const nextSelf = snapshot.players.find((player) => player.id === snapshot.selfId);
    if (nextSelf && this.previousSelf) {
      if (nextSelf.coins > this.previousSelf.coins) this.playSound('coin-sound', 0.28);
      if (nextSelf.health < this.previousSelf.health) this.playSound('damage-sound', 0.42);
    }
    if (nextSelf) this.previousSelf = { ...nextSelf };
    if (!this.musicStarted && nextSelf) {
      this.musicStarted = true;
      const music = this.sound.add('opening-music', { loop: true, volume: get(ui).settings.masterVolume * 0.18 });
      void music.play();
    }
    this.latest = snapshot;
    this.selfId = snapshot.selfId ?? this.selfId;
    this.syncPlayers(snapshot.players);
    this.syncCoins(snapshot.coins);
    this.syncChests(snapshot.chests);
    this.syncSwords(snapshot.swords);
  }

  private syncPlayers(players: PlayerState[]): void {
    const incoming = new Set(players.map((player) => player.id));
    for (const [id, view] of this.actors) if (!incoming.has(id)) { view.container.destroy(true); this.actors.delete(id); }
    for (const player of players) {
      let view = this.actors.get(player.id);
      if (!view) {
        view = this.createActor(player);
        this.actors.set(player.id, view);
        if (player.id === this.selfId) this.cameras.main.startFollow(view.container, true, 0.1, 0.1);
      }
      if (!view.wasAttacking && player.attacking) this.attackBurst(player);
      view.wasAttacking = player.attacking;
      view.target = player;
      view.container.setVisible(!player.dead);
    }
  }

  private createActor(player: PlayerState): ActorView {
    const body = this.add.circle(0, 0, PLAYER_RADIUS, colorNumber(player.color));
    const ring = this.add.circle(0, 0, PLAYER_RADIUS + 5).setStrokeStyle(3, player.npc ? 0x111827 : 0xffffff, player.npc ? 0.65 : 0.95);
    const sword = this.add.rectangle(PLAYER_RADIUS + 10, 0, 72, 12, player.evolution ? colorNumber(EVOLUTIONS[player.evolution].color) : 0xe2e8f0).setOrigin(0, 0.5);
    const name = this.add.text(0, -49, player.name, { color: '#f8fafc', fontFamily: 'Inter, Arial', fontSize: '15px', fontStyle: player.npc ? 'normal' : 'bold', stroke: '#020617', strokeThickness: 4 }).setOrigin(0.5);
    const healthBack = this.add.rectangle(0, -35, 58, 7, 0x020617, 0.82);
    const health = this.add.rectangle(-29, -35, 58, 7, 0x4ade80).setOrigin(0, 0.5);
    const container = this.add.container(player.x, player.y, [sword, ring, body, healthBack, health, name]).setDepth(player.id === this.selfId ? 20 : 10);
    return { container, body, ring, sword, name, healthBack, health, target: player, wasAttacking: false };
  }

  private updateActor(view: ActorView, time: number): void {
    const target = view.target;
    view.container.x = Phaser.Math.Linear(view.container.x, target.x, target.id === this.selfId ? 0.32 : 0.2);
    view.container.y = Phaser.Math.Linear(view.container.y, target.y, target.id === this.selfId ? 0.32 : 0.2);
    const swing = target.attacking ? Math.sin((time % 440) / 440 * Math.PI) * 1.18 - 0.55 : 0;
    view.sword.rotation = target.angle + swing;
    view.sword.setVisible(target.swordInHand);
    view.body.setFillStyle(colorNumber(target.color));
    view.ring.setStrokeStyle(3, target.abilityEndsAt > Date.now() ? 0xfde047 : target.npc ? 0x111827 : 0xffffff, 0.9);
    view.health.width = 58 * Math.max(0, target.health / target.maxHealth);
    view.health.setFillStyle(target.health / target.maxHealth < 0.3 ? 0xef4444 : 0x4ade80);
    const scale = target.evolution ? getVisualScale(target.evolution) : 1;
    view.body.setScale(scale); view.ring.setScale(scale);
    view.sword.setFillStyle(target.evolution ? colorNumber(EVOLUTIONS[target.evolution].color) : 0xe2e8f0);
  }

  private syncCoins(coins: CoinState[]): void {
    const incoming = new Set(coins.map((coin) => coin.id));
    for (const [id, view] of this.coinViews) if (!incoming.has(id)) { view.destroy(); this.coinViews.delete(id); }
    for (const coin of coins) {
      let view = this.coinViews.get(coin.id);
      if (!view) { view = this.add.image(coin.x, coin.y, 'coin').setDepth(2).setScale(coin.value >= 25 ? 1.25 : coin.value >= 10 ? 1 : 0.75); this.coinViews.set(coin.id, view); }
      view.setPosition(coin.x, coin.y).setAngle((this.time.now / 22 + coin.x) % 360);
    }
  }

  private syncChests(chests: ChestState[]): void {
    const incoming = new Set(chests.map((chest) => chest.id));
    for (const [id, view] of this.chestViews) if (!incoming.has(id)) { view.destroy(true); this.chestViews.delete(id); }
    for (const chest of chests) {
      let view = this.chestViews.get(chest.id);
      if (!view) {
        const color = CHEST_STATS[chest.rarity].color;
        const glow = this.add.rectangle(0, 3, 78, 59, color, 0.17).setStrokeStyle(3, color, 0.7);
        const textureKey = ['uncommon', 'rare', 'legendary', 'mythical'].includes(chest.rarity) ? `chest-${chest.rarity}` : '';
        const box = textureKey ? this.add.image(0, 0, textureKey).setDisplaySize(64, 52) : this.add.rectangle(0, 0, 58, 43, color).setStrokeStyle(4, 0x3f2a1d, 0.9);
        const band = this.add.rectangle(0, 0, 13, 43, 0xf8fafc, textureKey ? 0 : 0.42);
        const label = this.add.text(0, 37, chest.rarity.toUpperCase(), { color: '#fff7ed', fontSize: '11px', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
        view = this.add.container(chest.x, chest.y, [glow, box, band, label]).setDepth(3);
        this.chestViews.set(chest.id, view);
      }
      view.setPosition(chest.x, chest.y).setAlpha(0.55 + 0.45 * chest.health / chest.maxHealth);
    }
  }

  private syncSwords(swords: SwordState[]): void {
    const incoming = new Set(swords.map((sword) => sword.id));
    for (const [id, view] of this.swordViews) if (!incoming.has(id)) { view.destroy(); this.swordViews.delete(id); }
    for (const sword of swords) {
      let view = this.swordViews.get(sword.id);
      if (!view) { view = this.add.rectangle(sword.x, sword.y, 66, 11, 0xf8fafc).setOrigin(0.5).setDepth(30); this.swordViews.set(sword.id, view); }
      view.setPosition(sword.x, sword.y).setRotation(sword.angle);
    }
  }

  private attackBurst(player: PlayerState): void {
    const color = player.evolution ? colorNumber(EVOLUTIONS[player.evolution].color) : 0xffffff;
    const quality = get(ui).settings.quality;
    const particleCount = quality === 'high' ? 4 : quality === 'balanced' ? 2 : 0;
    for (let index = 0; index < particleCount; index += 1) {
      const spark = this.add.circle(player.x, player.y, 3 + index, color, 0.75).setDepth(35);
      const angle = player.angle + Phaser.Math.FloatBetween(-0.45, 0.45);
      this.tweens.add({ targets: spark, x: player.x + Math.cos(angle) * (70 + index * 17), y: player.y + Math.sin(angle) * (70 + index * 17), alpha: 0, scale: 0.2, duration: 260, onComplete: () => spark.destroy() });
    }
    if (player.id === this.selfId && get(ui).settings.screenShake) this.cameras.main.shake(80, 0.0015);
    if (player.id === this.selfId) this.playSound('hit-sound', 0.18);
  }

  private playSound(key: string, scale: number): void {
    const volume = get(ui).settings.masterVolume * scale;
    if (volume > 0) void this.sound.play(key, { volume });
  }

  private sendInput(): void {
    if (!this.keys || !this.latest) return;
    const pointer = this.input.activePointer;
    const local = this.latest.players.find((player) => player.id === this.selfId);
    if (!local) return;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const chatOpen = get(ui).chatOpen;
    const input: MovementInput = {
      up: !chatOpen && (this.keys.W.isDown || this.keys.UP.isDown),
      down: !chatOpen && (this.keys.S.isDown || this.keys.DOWN.isDown),
      left: !chatOpen && (this.keys.A.isDown || this.keys.LEFT.isDown),
      right: !chatOpen && (this.keys.D.isDown || this.keys.RIGHT.isDown),
      attacking: !chatOpen && pointer.leftButtonDown(),
      angle: Math.atan2(worldPoint.y - local.y, worldPoint.x - local.x),
      sequence: ++this.sequence
    };
    gameSocket.input(input);
  }
}

function seededRandom(seed: number): () => number {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4_294_967_296;
  };
}

function getVisualScale(evolution: keyof typeof EVOLUTIONS): number {
  return EVOLUTIONS[evolution].stats.scale ?? 1;
}
