import Phaser from 'phaser';
import { get } from 'svelte/store';
import { BASE_SPEED, CHEST_STATS, PLAYER_RADIUS, WORLD_HALF, WORLD_SIZE } from '../../shared/config.js';
import { EVOLUTIONS, getStats } from '../../shared/evolutions.js';
import type { ChestRarity, ChestState, CoinState, MovementInput, PlayerState, ShurikenState, Snapshot, SwordState } from '../../shared/types.js';
import { gameSocket } from '../lib/socket.js';
import { ui } from '../lib/state.js';

interface ActorView {
  container: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Ellipse;
  aura: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Arc;
  body: Phaser.GameObjects.Arc;
  core: Phaser.GameObjects.Arc;
  emblem: Phaser.GameObjects.Text;
  sword: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  healthBack: Phaser.GameObjects.Rectangle;
  health: Phaser.GameObjects.Rectangle;
  target: PlayerState;
  displayAngle: number;
  spinAngle: number;
  velocityX: number;
  velocityY: number;
  snapshotAt: number;
  wasAttacking: boolean;
  renderWasAttacking: boolean;
}

interface ShurikenView {
  image: Phaser.GameObjects.Image;
  targetX: number;
  targetY: number;
  velocityX: number;
  velocityY: number;
  snapshotAt: number;
  deflected: boolean;
}

const colorNumber = (color: string): number => Phaser.Display.Color.HexStringToColor(color).color;
const blankInput = (): MovementInput => ({ up: false, down: false, left: false, right: false, attacking: false, angle: 0, sequence: 0 });

export class ArenaScene extends Phaser.Scene {
  private actors = new Map<string, ActorView>();
  private coinViews = new Map<string, Phaser.GameObjects.Image>();
  private chestViews = new Map<string, Phaser.GameObjects.Container>();
  private swordViews = new Map<string, Phaser.GameObjects.Image>();
  private shurikenViews = new Map<string, ShurikenView>();
  private latest?: Snapshot;
  private selfId = '';
  private sequence = 0;
  private lastInputAt = 0;
  private lastFpsAt = 0;
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;
  private releaseSnapshot?: () => void;
  private releaseSettings?: () => void;
  private currentInput = blankInput();

  constructor() { super({ key: 'arena' }); }

  preload(): void {
    this.load.svg('sword', '/sword.svg');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#071520');
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
      this.releaseSnapshot?.();
      this.releaseSettings?.();
    });
  }

  update(time: number, delta: number): void {
    const frameSeconds = Math.min(delta / 1000, 0.05);
    this.currentInput = this.readInput();
    for (const [id, view] of this.actors) this.updateActor(view, time, frameSeconds, id === this.selfId);
    this.updateShurikenViews(time, frameSeconds);
    if (time - this.lastInputAt > 33) {
      gameSocket.input({ ...this.currentInput, sequence: ++this.sequence });
      this.lastInputAt = time;
    }
    if (time - this.lastFpsAt > 750) {
      ui.update((state) => ({ ...state, fps: Math.round(this.game.loop.actualFps) }));
      this.lastFpsAt = time;
    }
  }

  private createTextures(): void {
    const graphics = this.add.graphics();

    graphics.fillStyle(0x17202b, 0.35).fillEllipse(15, 18, 23, 10);
    graphics.fillStyle(0xf59e0b, 1).fillCircle(15, 14, 11);
    graphics.lineStyle(3, 0xfef3c7, 0.95).strokeCircle(15, 14, 9);
    graphics.fillStyle(0xfffbeb, 0.8).fillEllipse(12, 10, 5, 3);
    graphics.generateTexture('coin', 30, 26);
    graphics.clear();

    graphics.fillStyle(0x05070b, 0.28).fillCircle(18, 19, 14);
    graphics.fillStyle(0xb8c2d1, 1).fillTriangle(18, 0, 23, 14, 13, 14);
    graphics.fillTriangle(36, 18, 22, 23, 22, 13);
    graphics.fillTriangle(18, 36, 13, 22, 23, 22);
    graphics.fillTriangle(0, 18, 14, 13, 14, 23);
    graphics.fillStyle(0x475569, 1).fillCircle(18, 18, 7);
    graphics.fillStyle(0xe2e8f0, 0.85).fillCircle(16, 16, 2);
    graphics.generateTexture('shuriken', 36, 36);
    graphics.clear();

    const rarities: ChestRarity[] = ['normal', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'];
    for (const rarity of rarities) {
      const color = CHEST_STATS[rarity].color;
      graphics.fillStyle(0x050b11, 0.35).fillEllipse(40, 54, 68, 17);
      graphics.fillStyle(0x261812, 1).fillRoundedRect(7, 18, 66, 36, 8);
      graphics.fillStyle(color, 1).fillRoundedRect(10, 12, 60, 36, 8);
      graphics.fillStyle(0xffffff, 0.17).fillRoundedRect(14, 15, 52, 10, 4);
      graphics.lineStyle(4, 0x3a2518, 1).strokeRoundedRect(10, 12, 60, 36, 8);
      graphics.fillStyle(0xe8c16b, 1).fillRoundedRect(35, 10, 10, 40, 3);
      graphics.fillStyle(0x23170f, 1).fillCircle(40, 33, 4);
      if (rarity === 'legendary' || rarity === 'mythical') {
        graphics.lineStyle(2, 0xffffff, 0.65).strokeCircle(40, 31, 15);
      }
      graphics.generateTexture(`chest-${rarity}`, 80, 64);
      graphics.clear();
    }
    graphics.destroy();
  }

  private drawWorld(): void {
    const background = this.add.graphics().setDepth(-100);
    const third = WORLD_SIZE / 3;
    background.fillGradientStyle(0x0c536d, 0x14718b, 0x082f46, 0x0e5c73, 1).fillRect(-WORLD_HALF, -WORLD_HALF, third, WORLD_SIZE);
    background.fillGradientStyle(0x352128, 0x55262c, 0x21161d, 0x442027, 1).fillRect(-WORLD_HALF + third, -WORLD_HALF, third, WORLD_SIZE);
    background.fillGradientStyle(0xa56a2c, 0xd99a42, 0x79451f, 0xb9772f, 1).fillRect(-WORLD_HALF + third * 2, -WORLD_HALF, third, WORLD_SIZE);

    background.fillStyle(0xffffff, 0.025);
    for (let x = -WORLD_HALF; x < WORLD_HALF; x += 500) background.fillRect(x, -WORLD_HALF, 2, WORLD_SIZE);
    for (let y = -WORLD_HALF; y < WORLD_HALF; y += 500) background.fillRect(-WORLD_HALF, y, WORLD_SIZE, 2);
    background.lineStyle(18, 0xe2e8f0, 0.16).strokeRect(-WORLD_HALF, -WORLD_HALF, WORLD_SIZE, WORLD_SIZE);
    this.drawWorldDetails(background);
  }

  private drawWorldDetails(graphics: Phaser.GameObjects.Graphics): void {
    const random = seededRandom(8_008);
    const third = WORLD_SIZE / 3;

    for (let index = 0; index < 72; index += 1) {
      const x = -WORLD_HALF + 90 + random() * (third - 180);
      const y = -WORLD_HALF + 90 + random() * (WORLD_SIZE - 180);
      const width = 70 + random() * 150;
      graphics.lineStyle(4 + random() * 5, index % 3 === 0 ? 0xa5f3fc : 0x67e8f9, 0.11 + random() * 0.12);
      graphics.beginPath();
      graphics.moveTo(x - width / 2, y);
      graphics.lineTo(x - width / 4, y - 9);
      graphics.lineTo(x, y + 4);
      graphics.lineTo(x + width / 4, y - 7);
      graphics.lineTo(x + width / 2, y);
      graphics.strokePath();
      if (index % 12 === 0) {
        graphics.fillStyle(0xb99257, 0.9).fillEllipse(x + 80, y + 45, 120, 72);
        graphics.fillStyle(0x55754f, 0.95).fillEllipse(x + 80, y + 34, 92, 54);
        graphics.fillStyle(0x7dd3fc, 0.55).fillEllipse(x + 80, y + 31, 48, 25);
      }
    }

    for (let index = 0; index < 48; index += 1) {
      const x = -WORLD_HALF + third + 130 + random() * (third - 260);
      const y = -WORLD_HALF + 130 + random() * (WORLD_SIZE - 260);
      const radius = 28 + random() * 82;
      if (index % 5 === 0) {
        graphics.fillStyle(0x0d0a0c, 0.62).fillEllipse(x, y + radius * 0.4, radius * 2.2, radius * 0.8);
        graphics.fillStyle(0x6f2a24, 0.9).fillTriangle(x - radius, y + radius * 0.35, x, y - radius, x + radius, y + radius * 0.35);
        graphics.lineStyle(5, 0xff7a1a, 0.42).lineBetween(x, y - radius * 0.82, x + radius * 0.12, y + radius * 0.18);
      } else {
        graphics.fillStyle(0xff5a1f, 0.2).fillCircle(x, y, radius + 16);
        graphics.fillStyle(0xfa4a0a, 0.52).fillCircle(x, y, radius);
        graphics.lineStyle(4, 0xffc46b, 0.36).strokeCircle(x, y, radius * 0.66);
      }
    }

    for (let index = 0; index < 80; index += 1) {
      const x = -WORLD_HALF + third * 2 + 90 + random() * (third - 180);
      const y = -WORLD_HALF + 90 + random() * (WORLD_SIZE - 180);
      if (index % 10 === 0) {
        graphics.fillStyle(0x123f48, 0.82).fillEllipse(x, y, 180, 92);
        graphics.lineStyle(12, 0x5d8046, 0.7).strokeEllipse(x, y, 205, 112);
      } else if (index % 3 === 0) {
        graphics.fillStyle(0x6f4727, 0.45).fillEllipse(x, y + 18, 80, 24);
        graphics.fillStyle(0x755237, 0.92).fillTriangle(x - 34, y + 15, x - 4, y - 30, x + 39, y + 15);
      } else {
        graphics.lineStyle(10, 0x315e3b, 0.88).lineBetween(x, y + 31, x, y - 29);
        graphics.lineBetween(x, y - 3, x + 24, y - 18);
        graphics.lineBetween(x, y + 8, x - 19, y - 6);
      }
    }

    const labels = [
      { x: -third, text: 'THE SHOALS' },
      { x: 0, text: 'EMBER RIFT' },
      { x: third, text: 'SUNSCORCH' }
    ];
    for (const label of labels) {
      this.add.text(label.x, -WORLD_HALF + 245, label.text, {
        color: '#ffffff', fontFamily: 'Segoe UI Variable, Segoe UI, sans-serif', fontSize: '84px', fontStyle: 'bold', letterSpacing: 12
      }).setOrigin(0.5).setAlpha(0.075).setDepth(-90);
    }
  }

  private applySnapshot(snapshot: Snapshot): void {
    this.latest = snapshot;
    this.selfId = snapshot.selfId ?? this.selfId;
    this.syncPlayers(snapshot.players);
    this.syncCoins(snapshot.coins);
    this.syncChests(snapshot.chests);
    this.syncSwords(snapshot.swords);
    this.syncShurikens(snapshot.shurikens);
  }

  private syncPlayers(players: PlayerState[]): void {
    const incoming = new Set(players.map((player) => player.id));
    for (const [id, view] of this.actors) {
      if (!incoming.has(id)) { view.container.destroy(true); this.actors.delete(id); }
    }
    for (const player of players) {
      let view = this.actors.get(player.id);
      if (!view) {
        view = this.createActor(player);
        this.actors.set(player.id, view);
        if (player.id === this.selfId) this.cameras.main.startFollow(view.container, true, 0.16, 0.16);
      } else {
        const elapsed = Math.max(16, this.time.now - view.snapshotAt) / 1000;
        view.velocityX = (player.x - view.target.x) / elapsed;
        view.velocityY = (player.y - view.target.y) / elapsed;
        view.snapshotAt = this.time.now;
      }
      if (!view.wasAttacking && player.attacking) this.attackBurst(player);
      view.wasAttacking = player.attacking;
      view.target = player;
      view.container.setVisible(!player.dead);
    }
  }

  private createActor(player: PlayerState): ActorView {
    const color = colorNumber(player.color);
    const shadow = this.add.ellipse(0, 13, 68, 33, 0x020617, 0.32);
    const aura = this.add.circle(0, 0, PLAYER_RADIUS + 11, color, 0.12).setStrokeStyle(2, color, 0.22);
    const sword = this.add.image(PLAYER_RADIUS + 8, 0, 'sword').setOrigin(0.5, 0.84).setScale(0.74);
    const ring = this.add.circle(0, 0, PLAYER_RADIUS + 5, 0x0b1220, 0.94).setStrokeStyle(2, player.npc ? 0x64748b : 0xeaf7ff, 0.92);
    const body = this.add.circle(0, 0, PLAYER_RADIUS, color);
    const core = this.add.circle(-7, -8, PLAYER_RADIUS * 0.5, 0xffffff, 0.13);
    const emblem = this.add.text(0, 1, player.npcKind === 'shuriken' ? '✦' : player.evolution ? player.evolution.slice(0, 1).toUpperCase() : '•', {
      color: '#ffffff', fontFamily: 'Segoe UI Variable, Segoe UI, sans-serif', fontSize: '15px', fontStyle: 'bold'
    }).setOrigin(0.5).setAlpha(player.npc ? 0.62 : 0.9);
    const name = this.add.text(0, -55, player.name, {
      color: '#f8fbff', fontFamily: 'Segoe UI Variable, Segoe UI, sans-serif', fontSize: '14px', fontStyle: player.npc ? 'normal' : 'bold', stroke: '#071018', strokeThickness: 5
    }).setOrigin(0.5);
    const healthBack = this.add.rectangle(0, -39, 62, 6, 0x020617, 0.82).setStrokeStyle(1, 0xffffff, 0.18);
    const health = this.add.rectangle(-30, -39, 60, 4, 0x52e6a0).setOrigin(0, 0.5);
    const container = this.add.container(player.x, player.y, [shadow, aura, sword, ring, body, core, emblem, healthBack, health, name]).setDepth(player.id === this.selfId ? 20 : 10);
    return { container, shadow, aura, ring, body, core, emblem, sword, name, healthBack, health, target: player, displayAngle: player.angle, spinAngle: player.swordAngle, velocityX: 0, velocityY: 0, snapshotAt: this.time.now, wasAttacking: false, renderWasAttacking: false };
  }

  private updateActor(view: ActorView, time: number, delta: number, isSelf: boolean): void {
    const target = view.target;
    if (isSelf) this.predictLocal(view, delta);
    else {
      const extrapolation = Math.min(0.08, Math.max(0, (time - view.snapshotAt) / 1000));
      const desiredX = target.x + view.velocityX * extrapolation;
      const desiredY = target.y + view.velocityY * extrapolation;
      const follow = 1 - Math.exp(-15 * delta);
      view.container.x = Phaser.Math.Linear(view.container.x, desiredX, follow);
      view.container.y = Phaser.Math.Linear(view.container.y, desiredY, follow);
    }

    const wantedAngle = isSelf ? this.currentInput.angle : target.angle;
    const angleFollow = 1 - Math.exp(-(isSelf ? 28 : 18) * delta);
    view.displayAngle += shortestAngle(wantedAngle - view.displayAngle) * angleFollow;
    const attacking = (isSelf ? this.currentInput.attacking : target.attacking) && target.swordInHand;
    if (attacking) {
      if (!view.renderWasAttacking) view.spinAngle = view.displayAngle;
      view.spinAngle += Math.PI * 2 * delta;
      if (!isSelf) view.spinAngle += shortestAngle(target.swordAngle - view.spinAngle) * (1 - Math.exp(-7 * delta));
    } else view.spinAngle += shortestAngle(view.displayAngle - view.spinAngle) * (1 - Math.exp(-24 * delta));
    view.renderWasAttacking = attacking;
    const bladeAngle = attacking ? view.spinAngle : view.displayAngle;
    const scale = target.evolution ? getVisualScale(target.evolution) : 1;
    const handleRadius = PLAYER_RADIUS * scale + 9;
    view.sword.setPosition(Math.cos(bladeAngle) * handleRadius, Math.sin(bladeAngle) * handleRadius);
    view.sword.rotation = bladeAngle + Math.PI / 2;
    view.sword.setVisible(target.swordInHand);

    const color = colorNumber(target.color);
    const classColor = target.evolution ? colorNumber(EVOLUTIONS[target.evolution].color) : color;
    view.body.setFillStyle(color);
    view.aura.setFillStyle(classColor, target.abilityEndsAt > Date.now() ? 0.26 : 0.1);
    view.aura.setStrokeStyle(target.abilityEndsAt > Date.now() ? 4 : 2, classColor, target.abilityEndsAt > Date.now() ? 0.7 : 0.2);
    view.ring.setStrokeStyle(2.5, target.npc ? 0x64748b : 0xeaf7ff, 0.9);
    view.health.width = 60 * Math.max(0, target.health / target.maxHealth);
    view.health.setFillStyle(target.health / target.maxHealth < 0.3 ? 0xff5c6c : 0x52e6a0);
    view.body.setScale(scale);
    view.core.setScale(scale);
    view.ring.setScale(scale);
    view.aura.setScale(scale + Math.sin(time / 360) * 0.025);
    view.emblem.setText(target.npcKind === 'shuriken' ? '✦' : target.evolution ? target.evolution.slice(0, 1).toUpperCase() : '•');
    view.sword.setScale(0.74 * Math.min(scale, 1.22));
    view.shadow.setScale(0.92 + Math.sin(time / 280 + target.x) * 0.02, 1);
  }

  private predictLocal(view: ActorView, delta: number): void {
    const input = this.currentInput;
    const dx = Number(input.right) - Number(input.left);
    const dy = Number(input.down) - Number(input.up);
    const magnitude = Math.hypot(dx, dy) || 1;
    const moving = dx !== 0 || dy !== 0;
    const stats = getStats(view.target.evolution, view.target.abilityEndsAt > Date.now());
    const distance = BASE_SPEED * stats.speed * delta;
    if (moving) {
      view.container.x += dx / magnitude * distance;
      view.container.y += dy / magnitude * distance;
    }
    const error = Math.hypot(view.target.x - view.container.x, view.target.y - view.container.y);
    const correction = error > 140 ? 0.34 : 1 - Math.exp(-(moving ? 2.3 : 11) * delta);
    view.container.x = Phaser.Math.Linear(view.container.x, view.target.x, correction);
    view.container.y = Phaser.Math.Linear(view.container.y, view.target.y, correction);
    view.container.x = Phaser.Math.Clamp(view.container.x, -WORLD_HALF + PLAYER_RADIUS, WORLD_HALF - PLAYER_RADIUS);
    view.container.y = Phaser.Math.Clamp(view.container.y, -WORLD_HALF + PLAYER_RADIUS, WORLD_HALF - PLAYER_RADIUS);
  }

  private syncCoins(coins: CoinState[]): void {
    const incoming = new Set(coins.map((coin) => coin.id));
    for (const [id, view] of this.coinViews) if (!incoming.has(id)) { view.destroy(); this.coinViews.delete(id); }
    for (const coin of coins) {
      let view = this.coinViews.get(coin.id);
      if (!view) {
        view = this.add.image(coin.x, coin.y, 'coin').setDepth(2).setScale(coin.value >= 25 ? 1.25 : coin.value >= 10 ? 1 : 0.76);
        this.coinViews.set(coin.id, view);
      }
      view.setPosition(coin.x, coin.y).setRotation(Math.sin(this.time.now / 420 + coin.x) * 0.12);
    }
  }

  private syncChests(chests: ChestState[]): void {
    const incoming = new Set(chests.map((chest) => chest.id));
    for (const [id, view] of this.chestViews) if (!incoming.has(id)) { view.destroy(true); this.chestViews.delete(id); }
    for (const chest of chests) {
      let view = this.chestViews.get(chest.id);
      if (!view) {
        const color = CHEST_STATS[chest.rarity].color;
        const glow = this.add.ellipse(0, 8, 92, 66, color, 0.11).setStrokeStyle(2, color, 0.42);
        const box = this.add.image(0, 0, `chest-${chest.rarity}`);
        const label = this.add.text(0, 42, chest.rarity.toUpperCase(), {
          color: '#fff7ed', fontFamily: 'Segoe UI Variable, Segoe UI, sans-serif', fontSize: '10px', fontStyle: 'bold', stroke: '#071018', strokeThickness: 4, letterSpacing: 1
        }).setOrigin(0.5);
        view = this.add.container(chest.x, chest.y, [glow, box, label]).setDepth(3);
        this.chestViews.set(chest.id, view);
      }
      view.setPosition(chest.x, chest.y).setAlpha(0.58 + 0.42 * chest.health / chest.maxHealth);
      view.y += Math.sin(this.time.now / 520 + chest.x) * 1.5;
    }
  }

  private syncSwords(swords: SwordState[]): void {
    const incoming = new Set(swords.map((sword) => sword.id));
    for (const [id, view] of this.swordViews) if (!incoming.has(id)) { view.destroy(); this.swordViews.delete(id); }
    for (const sword of swords) {
      let view = this.swordViews.get(sword.id);
      if (!view) {
        view = this.add.image(sword.x, sword.y, 'sword').setOrigin(0.5).setDepth(30).setScale(0.58);
        this.swordViews.set(sword.id, view);
      }
      view.setPosition(sword.x, sword.y).setRotation(sword.angle + Math.PI / 2);
    }
  }

  private syncShurikens(shurikens: ShurikenState[]): void {
    const incoming = new Set(shurikens.map((shuriken) => shuriken.id));
    for (const [id, view] of this.shurikenViews) {
      if (!incoming.has(id)) { view.image.destroy(); this.shurikenViews.delete(id); }
    }
    for (const shuriken of shurikens) {
      let view = this.shurikenViews.get(shuriken.id);
      if (!view) {
        const image = this.add.image(shuriken.x, shuriken.y, 'shuriken').setDepth(31).setScale(0.82);
        view = { image, targetX: shuriken.x, targetY: shuriken.y, velocityX: 0, velocityY: 0, snapshotAt: this.time.now, deflected: shuriken.deflected };
        this.shurikenViews.set(shuriken.id, view);
      } else {
        const elapsed = Math.max(16, this.time.now - view.snapshotAt) / 1000;
        view.velocityX = (shuriken.x - view.targetX) / elapsed;
        view.velocityY = (shuriken.y - view.targetY) / elapsed;
        view.targetX = shuriken.x;
        view.targetY = shuriken.y;
        view.snapshotAt = this.time.now;
      }
      view.deflected = shuriken.deflected;
      view.image.setTint(shuriken.deflected ? 0x67e8f9 : 0xffffff);
    }
  }

  private updateShurikenViews(time: number, delta: number): void {
    for (const view of this.shurikenViews.values()) {
      const extrapolation = Math.min(0.06, Math.max(0, (time - view.snapshotAt) / 1000));
      const desiredX = view.targetX + view.velocityX * extrapolation;
      const desiredY = view.targetY + view.velocityY * extrapolation;
      const follow = 1 - Math.exp(-22 * delta);
      view.image.x = Phaser.Math.Linear(view.image.x, desiredX, follow);
      view.image.y = Phaser.Math.Linear(view.image.y, desiredY, follow);
      view.image.rotation += Math.PI * 6 * delta;
      view.image.setScale(0.82 + Math.sin(time / 70) * 0.035);
    }
  }

  private attackBurst(player: PlayerState): void {
    const color = player.evolution ? colorNumber(EVOLUTIONS[player.evolution].color) : 0xffffff;
    const quality = get(ui).settings.quality;
    const particleCount = quality === 'high' ? 7 : quality === 'balanced' ? 4 : 1;
    const arc = this.add.graphics().setDepth(34);
    arc.lineStyle(7, color, 0.38).beginPath();
    arc.arc(player.x, player.y, 92, player.swordAngle - 0.82, player.swordAngle + 0.82).strokePath();
    this.tweens.add({ targets: arc, alpha: 0, scale: 1.12, duration: 190, ease: 'Quad.Out', onComplete: () => arc.destroy() });
    for (let index = 0; index < particleCount; index += 1) {
      const spark = this.add.circle(player.x, player.y, 2 + index * 0.35, color, 0.72).setDepth(35);
      const angle = player.angle + Phaser.Math.FloatBetween(-0.55, 0.55);
      this.tweens.add({ targets: spark, x: player.x + Math.cos(angle) * (74 + index * 10), y: player.y + Math.sin(angle) * (74 + index * 10), alpha: 0, scale: 0.15, duration: 220 + index * 15, ease: 'Quad.Out', onComplete: () => spark.destroy() });
    }
    if (player.id === this.selfId && get(ui).settings.screenShake) this.cameras.main.shake(70, 0.0012);
  }

  private readInput(): MovementInput {
    if (!this.keys || !this.latest) return this.currentInput;
    const pointer = this.input.activePointer;
    const view = this.actors.get(this.selfId);
    const local = view?.target ?? this.latest.players.find((player) => player.id === this.selfId);
    if (!local) return this.currentInput;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const chatOpen = get(ui).chatOpen;
    const originX = view?.container.x ?? local.x;
    const originY = view?.container.y ?? local.y;
    return {
      up: !chatOpen && (this.keys.W.isDown || this.keys.UP.isDown),
      down: !chatOpen && (this.keys.S.isDown || this.keys.DOWN.isDown),
      left: !chatOpen && (this.keys.A.isDown || this.keys.LEFT.isDown),
      right: !chatOpen && (this.keys.D.isDown || this.keys.RIGHT.isDown),
      attacking: !chatOpen && pointer.leftButtonDown(),
      angle: Math.atan2(worldPoint.y - originY, worldPoint.x - originX),
      sequence: this.sequence
    };
  }
}

function shortestAngle(value: number): number {
  return Math.atan2(Math.sin(value), Math.cos(value));
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
