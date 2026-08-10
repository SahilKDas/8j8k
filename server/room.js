import { WebSocket } from 'ws';

const MAP_SIZE = 2500;
const MAX_DAMAGE = 300;
const RESET_SCORE = 14500;
const number = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function cleanName(value) {
    return String(value || 'Player').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 18) || 'Player';
}

export function sanitizePlayerState(state, fallbackName = 'Player') {
    if (!state || typeof state !== 'object') return null;
    return {
        name: cleanName(state.name || fallbackName),
        x: clamp(number(state.x), 0, MAP_SIZE),
        y: clamp(number(state.y), 0, MAP_SIZE),
        angle: number(state.angle),
        score: Math.max(0, number(state.score)),
        health: clamp(number(state.health, 100), 0, 300),
        shield: clamp(number(state.shield), 0, 100),
        kills: Math.max(0, Math.floor(number(state.kills))),
        armor: clamp(number(state.armor), 0, 0.6),
        swordLength: clamp(number(state.swordLength, 35), 15, 500),
        swordTier: Math.max(0, Math.floor(number(state.swordTier))),
        swordDamage: clamp(number(state.swordDamage, 35), 0, MAX_DAMAGE),
        swordColor: typeof state.swordColor === 'string' ? state.swordColor.slice(0, 24) : '#a0aec0',
        swordShape: typeof state.swordShape === 'string' ? state.swordShape.slice(0, 24) : 'sword',
        isAttacking: Boolean(state.isAttacking),
        isBlocking: Boolean(state.isBlocking),
        isDashing: Boolean(state.isDashing),
        isWhirlwinding: Boolean(state.isWhirlwinding),
        isDisarmed: Boolean(state.isDisarmed),
        activePowerUp: ['damage', 'speed', 'shield'].includes(state.activePowerUp) ? state.activePowerUp : null,
        dead: Boolean(state.dead)
    };
}

export class MultiplayerRoom {
    constructor({ random = Math.random } = {}) {
        this.peers = new Map();
        this.seed = Math.floor(random() * 0xffffffff) >>> 0;
        this.lastHits = new Map();
    }

    get size() {
        return this.peers.size;
    }

    send(socket, message) {
        if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    }

    connect(id, socket) {
        this.peers.set(id, { id, socket, name: 'Player', state: null });
        this.send(socket, { type: 'welcome', id, seed: this.seed });
    }

    disconnect(id) {
        this.peers.delete(id);
        for (const key of this.lastHits.keys()) if (key.startsWith(`${id}:`) || key.endsWith(`:${id}`)) this.lastHits.delete(key);
        this.broadcast({ type: 'playerLeft', id });
    }

    receive(id, raw) {
        const peer = this.peers.get(id);
        if (!peer || raw.length > 8192) return;
        let message;
        try { message = JSON.parse(raw); } catch { return; }
        if (message.type === 'join') peer.name = cleanName(message.name);
        else if (message.type === 'state') peer.state = sanitizePlayerState(message.player, peer.name);
        else if (message.type === 'hit') this.forwardHit(peer, message);
        else if (message.type === 'death') this.forwardKillCredit(peer, message);
        else if (message.type === 'reset') this.reset(peer);
    }

    forwardHit(attacker, message, now = Date.now()) {
        const target = this.peers.get(String(message.targetId));
        if (!attacker.state || !target?.state || attacker.state.dead || target.state.dead) return false;
        const distance = Math.hypot(attacker.state.x - target.state.x, attacker.state.y - target.state.y);
        const allowedRange = Math.min(650, attacker.state.swordLength + 130);
        if (distance > allowedRange) return false;
        const key = `${attacker.id}:${target.id}`;
        if (now - (this.lastHits.get(key) || 0) < 120) return false;
        this.lastHits.set(key, now);
        this.send(target.socket, {
            type: 'damage', attackerId: attacker.id,
            amount: clamp(number(message.amount), 0, MAX_DAMAGE)
        });
        return true;
    }

    forwardKillCredit(victim, message) {
        const attacker = this.peers.get(String(message.attackerId));
        if (!attacker || attacker.id === victim.id) return;
        this.send(attacker.socket, {
            type: 'killCredit', victimId: victim.id,
            victimScore: Math.max(0, number(message.victimScore))
        });
    }

    reset(peer) {
        if (!peer.state || peer.state.score < RESET_SCORE) return false;
        this.seed = Math.floor(Math.random() * 0xffffffff) >>> 0;
        this.broadcast({ type: 'resetMap', seed: this.seed, by: peer.id });
        return true;
    }

    broadcastRoster() {
        const players = [];
        for (const peer of this.peers.values()) if (peer.state) players.push({ id: peer.id, ...peer.state });
        this.broadcast({ type: 'roster', players, online: this.peers.size });
    }

    broadcast(message) {
        const payload = JSON.stringify(message);
        for (const peer of this.peers.values()) if (peer.socket.readyState === WebSocket.OPEN) peer.socket.send(payload);
    }

    close() {
        for (const peer of this.peers.values()) peer.socket.close(1001, 'Server shutting down');
        this.peers.clear();
    }
}
