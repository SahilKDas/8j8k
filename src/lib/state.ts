import { derived, writable } from 'svelte/store';
import { getAvailableEvolutions } from '../../shared/evolutions.js';
import type { ChatMessage, PlayerState, Snapshot } from '../../shared/types.js';

export interface GameSettings {
  quality: 'high' | 'balanced' | 'performance';
  cameraZoom: number;
  screenShake: boolean;
}

export interface UiState {
  screen: 'menu' | 'connecting' | 'playing';
  connection: 'offline' | 'connecting' | 'online' | 'error';
  error: string;
  snapshot: Snapshot | null;
  self: PlayerState | null;
  chat: ChatMessage[];
  ping: number;
  fps: number;
  showHelp: boolean;
  showSettings: boolean;
  showShop: boolean;
  chatOpen: boolean;
  settings: GameSettings;
}

const defaultSettings: GameSettings = { quality: 'high', cameraZoom: 1, screenShake: true };

function loadSettings(): GameSettings {
  if (typeof localStorage === 'undefined') return defaultSettings;
  try { return { ...defaultSettings, ...JSON.parse(localStorage.getItem('8j8k-settings') || '{}') }; }
  catch { return defaultSettings; }
}

export const ui = writable<UiState>({
  screen: 'menu', connection: 'offline', error: '', snapshot: null, self: null,
  chat: [], ping: 0, fps: 0, showHelp: false, showSettings: false,
  showShop: false, chatOpen: false, settings: loadSettings()
});

export const evolutionChoices = derived(ui, ($ui) => $ui.self ? getAvailableEvolutions($ui.self.evolution, $ui.self.coins) : []);

export function setSettings(settings: Partial<GameSettings>): void {
  ui.update((state) => {
    const next = { ...state.settings, ...settings };
    if (typeof localStorage !== 'undefined') localStorage.setItem('8j8k-settings', JSON.stringify(next));
    return { ...state, settings: next };
  });
}

export function receiveSnapshot(snapshot: Snapshot): void {
  const self = snapshot.players.find((player) => player.id === snapshot.selfId) ?? null;
  ui.update((state) => ({ ...state, snapshot, self, screen: 'playing', connection: 'online', error: '' }));
}

export function receiveChat(message: ChatMessage): void {
  ui.update((state) => ({ ...state, chat: [...state.chat.slice(-4), message] }));
}
