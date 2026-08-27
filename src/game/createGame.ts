import Phaser from 'phaser';
import { ArenaScene } from './ArenaScene.js';

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#09131d',
    scene: [ArenaScene],
    render: { antialias: true, roundPixels: false },
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    input: { activePointers: 3 },
    fps: { target: 60, smoothStep: true }
  });
}
