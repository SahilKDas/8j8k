import type { ClientMessage, EvolutionName, MovementInput, ServerMessage, Snapshot } from '../../shared/types.js';
import { receiveChat, receiveSnapshot, ui } from './state.js';

type SnapshotListener = (snapshot: Snapshot) => void;

class GameSocket {
  private socket?: WebSocket;
  private openPromise?: Promise<void>;
  private snapshotListeners = new Set<SnapshotListener>();
  private pingTimer?: number;

  async join(name: string, color: string): Promise<void> {
    ui.update((state) => ({ ...state, screen: 'connecting', connection: 'connecting', error: '' }));
    await this.connect();
    this.send({ type: 'join', payload: { name, color } });
  }

  connect(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.openPromise) return this.openPromise;
    this.openPromise = new Promise((resolve, reject) => {
      const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
      this.socket = new WebSocket(`${protocol}://${location.host}/ws`);
      this.socket.addEventListener('open', () => {
        ui.update((state) => ({ ...state, connection: 'online' }));
        this.pingTimer = window.setInterval(() => this.send({ type: 'ping', payload: performance.now() }), 2_000);
        resolve();
      });
      this.socket.addEventListener('message', (event) => this.receive(event.data));
      this.socket.addEventListener('close', () => this.disconnect('Connection lost. Reload or return to the menu to reconnect.'));
      this.socket.addEventListener('error', () => {
        this.disconnect('Could not connect to the arena server.');
        reject(new Error('WebSocket connection failed'));
      });
    });
    return this.openPromise;
  }

  private receive(raw: string): void {
    let message: ServerMessage;
    try { message = JSON.parse(raw) as ServerMessage; } catch { return; }
    switch (message.type) {
      case 'welcome':
      case 'snapshot':
        receiveSnapshot(message.payload);
        for (const listener of this.snapshotListeners) listener(message.payload);
        break;
      case 'chat': receiveChat(message.payload); break;
      case 'announcement': receiveChat({ id: 'system', name: 'Arena', text: message.payload, time: Date.now(), system: true }); break;
      case 'pong': ui.update((state) => ({ ...state, ping: Math.max(0, Math.round(performance.now() - message.payload)) })); break;
      case 'error': ui.update((state) => ({ ...state, error: message.payload, connection: 'error' })); break;
    }
  }

  onSnapshot(listener: SnapshotListener): () => void {
    this.snapshotListeners.add(listener);
    return () => this.snapshotListeners.delete(listener);
  }

  input(payload: MovementInput): void { this.send({ type: 'input', payload }); }
  ability(): void { this.send({ type: 'ability' }); }
  throwSword(): void { this.send({ type: 'throw' }); }
  evolve(payload: EvolutionName): void { this.send({ type: 'evolve', payload }); }
  chat(payload: string): void { this.send({ type: 'chat', payload }); }
  respawn(): void { this.send({ type: 'respawn' }); }

  private send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  private disconnect(error: string): void {
    if (this.pingTimer) window.clearInterval(this.pingTimer);
    this.pingTimer = undefined;
    this.socket = undefined;
    this.openPromise = undefined;
    ui.update((state) => ({ ...state, connection: 'error', error }));
  }
}

export const gameSocket = new GameSocket();
