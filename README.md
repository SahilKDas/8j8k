# 8j8k

A real-time multiplayer canvas arena. The browser client is written in Svelte; a Node server owns the game simulation and synchronizes clients over WebSockets.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Open a second tab to test multiplayer.

## Production

```bash
npm run build
NODE_ENV=production npm start
```

Set `PORT` to change the default port (`5173`). The same HTTP server serves the built client and upgrades `/ws` connections.

## Controls

- Move: `WASD` or arrow keys
- Aim: mouse
- Attack: left click or space
- Throw weapon: right click
- Whirlwind: `E`
- Dash: `Shift`
- Block: `X` or middle click

The server is authoritative: movement, cooldowns, damage, pickups, upgrades, NPC behavior, events, and map resets are validated in the shared world simulation.
