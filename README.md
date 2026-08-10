# 6j8k V2 — Svelte multiplayer port

This is a faithful Svelte port of the original `V2` game from [`6j8k.version1_and_version2`](https://github.com/SahilKDas/6j8k.version1_and_version2/tree/main/V2), with WebSocket multiplayer added alongside the original NPC simulation.

The V2 canvas renderer, CSS, NPC archetypes, bosses, events, map features, combat, upgrades, particles, minimap, and controls are preserved. Svelte owns the page lifecycle and UI markup; the original canvas engine continues to animate on `requestAnimationFrame`. A lightweight WebSocket room synchronizes connected human players at 20 Hz, interpolates remote movement, validates PvP range and rate limits, and coordinates shared map resets.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Open another browser tab to test multiplayer.

## Production

```bash
npm run build
NODE_ENV=production npm start
```

Set `PORT` to change the default port (`5173`). The HTTP server serves the built Svelte client and upgrades `/ws` connections.

## Controls

- Move: `WASD` or arrow keys
- Aim: mouse
- Attack: left click or space
- Throw weapon: right click
- Whirlwind: `E`
- Dash: `Shift`
- Block: `X` or middle click
