# 8j8k

A real-time multiplayer blade arena built with Svelte, TypeScript, Sass, Phaser 4.2.1, and WebSockets.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in two or more browser windows to test multiplayer. The HTTP app, game API, and WebSocket endpoint are served from the same port.

## Commands

- `npm run dev` — start the development server with Vite middleware and WebSockets
- `npm run check` — run Svelte diagnostics and strict TypeScript checking
- `npm test` — run progression, world, networking, and validation tests
- `npm run build` — create the production client bundle
- `npm start` — start the combined app and multiplayer server

## Architecture

- `src/` contains the Svelte interface, Sass design system, typed client state, WebSocket client, and Phaser scene.
- `server/` contains the authoritative multiplayer simulation and HTTP/WebSocket server.
- `shared/` contains the protocol, world configuration, progression tree, and shared types.
- `public/assets/` contains local sound and chest assets.

The server owns movement validation, NPC decisions, melee hits, thrown weapons, coins, chests, health, abilities, evolution eligibility, respawning, chat sanitization, and leaderboard state. Clients render interpolated snapshots and send only bounded input commands.

## License

GNU General Public License version 3. See `LICENSE`.
