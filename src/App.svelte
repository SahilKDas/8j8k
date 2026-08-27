<script lang="ts">
  import { tick } from 'svelte';
  import { WORLD_HALF, WORLD_SIZE } from '../shared/config.js';
  import { EVOLUTIONS } from '../shared/evolutions.js';
  import GameCanvas from './components/GameCanvas.svelte';
  import { gameSocket } from './lib/socket.js';
  import { evolutionChoices, setSettings, ui } from './lib/state.js';

  const colors = ['#f8fafc', '#60a5fa', '#22c55e', '#f97316', '#e879f9', '#facc15', '#fb7185', '#2dd4bf'];
  let name = typeof localStorage === 'undefined' ? '' : localStorage.getItem('8j8k-name') || '';
  let color = typeof localStorage === 'undefined' ? colors[0] : localStorage.getItem('8j8k-color') || colors[0];
  let chatText = '';
  let chatInput: HTMLInputElement;

  async function play(): Promise<void> {
    const cleanName = name.trim().slice(0, 18) || 'Wanderer';
    localStorage.setItem('8j8k-name', cleanName);
    localStorage.setItem('8j8k-color', color);
    try { await gameSocket.join(cleanName, color); }
    catch { ui.update((state) => ({ ...state, screen: 'menu' })); }
  }

  async function openChat(): Promise<void> {
    ui.update((state) => ({ ...state, chatOpen: true }));
    await tick(); chatInput?.focus();
  }

  function submitChat(): void {
    if (chatText.trim()) gameSocket.chat(chatText);
    chatText = '';
    ui.update((state) => ({ ...state, chatOpen: false }));
  }

  function keydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && $ui.screen === 'playing' && !$ui.self?.dead) {
      event.preventDefault();
      if ($ui.chatOpen) submitChat(); else void openChat();
    }
    if (event.key === 'Escape') ui.update((state) => ({ ...state, chatOpen: false, showHelp: false, showSettings: false, showShop: false }));
  }

  const minimapPosition = (value: number) => `${((value + WORLD_HALF) / WORLD_SIZE) * 100}%`;
  const classLabel = (name: keyof typeof EVOLUTIONS | null | undefined) => name ? EVOLUTIONS[name].label : 'Unbound';
  const abilityProgress = () => {
    if (!$ui.self?.evolution) return 0;
    const definition = EVOLUTIONS[$ui.self.evolution];
    return Math.max(0, Math.min(1, 1 - ($ui.self.abilityReadyAt - Date.now()) / definition.abilityCooldown));
  };
</script>

<svelte:window onkeydown={keydown} />

<main class:in-game={$ui.screen === 'playing'}>
  <GameCanvas />

  {#if $ui.screen === 'playing' && $ui.self}
    <section class="hud" aria-label="Game interface">
      <header class="topbar glass">
        <div class="brand"><span class="brand-mark">8</span><strong>8j8k</strong><small>Arena</small></div>
        <div class="server"><span class:online={$ui.connection === 'online'}></span>{$ui.connection} · {$ui.ping} ms · {$ui.fps} fps</div>
        <div class="top-actions">
          <button onclick={() => ui.update((state) => ({ ...state, showHelp: true }))}>?</button>
          <button onclick={() => ui.update((state) => ({ ...state, showSettings: true }))}>⚙</button>
        </div>
      </header>

      <aside class="left-stack">
        <div class="profile-card glass">
          <div class="portrait" style={`--player-color:${$ui.self.color}`}><span>{$ui.self.level}</span></div>
          <div><small>{$ui.self.evolution ? 'EVOLUTION' : 'FIGHTER'}</small><strong>{classLabel($ui.self.evolution)}</strong><span>{$ui.self.name}</span></div>
        </div>
        <div class="stats glass">
          <div><span>Coins</span><strong>◉ {Math.floor($ui.self.coins).toLocaleString()}</strong></div>
          <div><span>Stabs</span><strong>⚔ {$ui.self.kills}</strong></div>
          <div><span>Health</span><strong>{Math.ceil($ui.self.health)} / {Math.ceil($ui.self.maxHealth)}</strong></div>
          <div class="health-track"><i style={`width:${Math.max(0, $ui.self.health / $ui.self.maxHealth * 100)}%`}></i></div>
        </div>
        <div class="leaderboard glass">
          <h2>Leaderboard</h2>
          <ol>
            {#each $ui.snapshot?.leaderboard ?? [] as entry, index (entry.id)}
              <li class:self={entry.id === $ui.self.id}><b>{index + 1}</b><span>{entry.name}</span><strong>{entry.coins.toLocaleString()}</strong></li>
            {/each}
          </ol>
        </div>
      </aside>

      <aside class="right-stack">
        <div class="minimap glass" aria-label="Arena minimap">
          <div class="map-biomes"><i></i><i></i><i></i></div>
          {#each $ui.snapshot?.players ?? [] as fighter (fighter.id)}
            <span class:self={fighter.id === $ui.self.id} class:npc={fighter.npc} class="map-dot" style={`left:${minimapPosition(fighter.x)};top:${minimapPosition(fighter.y)};--dot:${fighter.color}`} title={fighter.name}></span>
          {/each}
          <small>15K ARENA</small>
        </div>
        <div class="ability-card glass">
          <button class:ready={abilityProgress() >= 1} disabled={!$ui.self.evolution || abilityProgress() < 1} onclick={() => gameSocket.ability()}>
            <span>E</span><strong>{$ui.self.evolution ? EVOLUTIONS[$ui.self.evolution].abilityName : 'Choose a class'}</strong>
            <i><em style={`width:${abilityProgress() * 100}%`}></em></i>
          </button>
          <button class="throw" onclick={() => gameSocket.throwSword()}><span>Q</span><strong>Throw blade</strong></button>
        </div>
      </aside>

      <div class="chat-feed">
        {#each $ui.chat as message (message.time + message.id)}
          <p class:system={message.system}><strong>{message.name}</strong> {message.text}</p>
        {/each}
      </div>
      {#if $ui.chatOpen}
        <form class="chat-input glass" onsubmit={(event) => { event.preventDefault(); submitChat(); }}>
          <input bind:this={chatInput} bind:value={chatText} maxlength="120" placeholder="Send a message…" />
          <button>Send</button>
        </form>
      {/if}
      <div class="control-hint glass"><span><kbd>WASD</kbd> move</span><span><kbd>Mouse</kbd> aim & slash</span><span><kbd>Q</kbd> throw</span><span><kbd>E</kbd> ability</span><span><kbd>Enter</kbd> chat</span></div>

      {#if $evolutionChoices.length > 0}
        <div class="evolution-dock glass">
          <small>EVOLUTION AVAILABLE</small>
          <div>{#each $evolutionChoices as choice (choice.name)}<button style={`--class-color:${choice.color}`} onclick={() => gameSocket.evolve(choice.name)}><i></i><span><strong>{choice.label}</strong>{choice.description}</span></button>{/each}</div>
        </div>
      {/if}
    </section>

    {#if $ui.self.dead}
      <div class="overlay death-overlay">
        <section class="modal death-card">
          <small>RUN ENDED</small><h1>You were outplayed.</h1>
          <div><span>Coins secured<strong>{Math.floor($ui.self.coins).toLocaleString()}</strong></span><span>Stabs<strong>{$ui.self.kills}</strong></span><span>Class<strong>{classLabel($ui.self.evolution)}</strong></span></div>
          <button class="primary" onclick={() => gameSocket.respawn()}>Return to the arena</button>
        </section>
      </div>
    {/if}
  {/if}

  {#if $ui.screen === 'menu' || $ui.screen === 'connecting'}
    <div class="menu-shell">
      <div class="menu-atmosphere"></div>
      <section class="hero-panel">
        <div class="logo"><span>8</span><h1>8j8k</h1></div>
        <p class="eyebrow">MULTIPLAYER BLADE ARENA</p>
        <h2>Evolve. Outfight.<br/><em>Own the arena.</em></h2>
        <p class="lede">Cut through a living battlefield of rivals, roaming fighters, treasure chests and branching combat classes.</p>
        <div class="join-card glass">
          <label>CALLSIGN<input bind:value={name} maxlength="18" placeholder="Wanderer" /></label>
          <div class="colors"><span>ARMOR COLOR</span>{#each colors as swatch}<button class:selected={swatch === color} style={`--swatch:${swatch}`} aria-label={`Use ${swatch}`} onclick={() => color = swatch}></button>{/each}</div>
          <button class="primary play" disabled={$ui.screen === 'connecting'} onclick={play}>{$ui.screen === 'connecting' ? 'Connecting…' : 'Enter arena'}<span>→</span></button>
          {#if $ui.error}<p class="error">{$ui.error}</p>{/if}
        </div>
        <div class="menu-actions"><button onclick={() => ui.update((state) => ({ ...state, showHelp: true }))}>How to play</button><button onclick={() => ui.update((state) => ({ ...state, showShop: true }))}>Armory</button><button onclick={() => ui.update((state) => ({ ...state, showSettings: true }))}>Settings</button></div>
      </section>
      <section class="feature-strip"><article><b>01</b><span><strong>12 evolutions</strong>Build into a specialized endgame class.</span></article><article><b>02</b><span><strong>Living world</strong>NPC rivals, treasure tiers and biome landmarks.</span></article><article><b>03</b><span><strong>Real multiplayer</strong>Authoritative WebSocket combat and shared progression.</span></article></section>
    </div>
  {/if}

  {#if $ui.showHelp}
    <div class="overlay">
      <section class="modal help-modal"><button class="close" onclick={() => ui.update((state) => ({ ...state, showHelp: false }))}>×</button><p class="eyebrow">FIELD MANUAL</p><h1>Fight your way upward.</h1><div class="help-grid"><article><kbd>WASD</kbd><h3>Move</h3><p>Cross a 15,000-unit arena and use terrain landmarks to orient yourself.</p></article><article><kbd>Mouse 1</kbd><h3>Spin slash</h3><p>Hold to sweep the blade around you. A well-timed swing deflects incoming shurikens.</p></article><article><kbd>Q</kbd><h3>Throw</h3><p>Give up your melee blade briefly for a high-risk ranged attack.</p></article><article><kbd>E</kbd><h3>Ability</h3><p>Every evolution unlocks a defining power with its own cooldown.</p></article></div><h2>Progression</h2><p>Collect coins and break rarity-tiered chests. At score milestones, choose a branch in the evolution tree. Defeating rivals earns bounties, while death costs part of your hoard.</p></section>
    </div>
  {/if}

  {#if $ui.showSettings}
    <div class="overlay">
      <section class="modal settings-modal"><button class="close" onclick={() => ui.update((state) => ({ ...state, showSettings: false }))}>×</button><p class="eyebrow">SYSTEM</p><h1>Settings</h1><label>Camera zoom<input type="range" min="0.75" max="1.3" step="0.05" value={$ui.settings.cameraZoom} oninput={(event) => setSettings({ cameraZoom: Number(event.currentTarget.value) })}/><output>{$ui.settings.cameraZoom.toFixed(2)}×</output></label><label>Graphics<select value={$ui.settings.quality} onchange={(event) => setSettings({ quality: event.currentTarget.value as 'high' | 'balanced' | 'performance' })}><option value="high">High</option><option value="balanced">Balanced</option><option value="performance">Performance</option></select></label><label class="toggle">Screen shake<input type="checkbox" checked={$ui.settings.screenShake} onchange={(event) => setSettings({ screenShake: event.currentTarget.checked })}/></label></section>
    </div>
  {/if}

  {#if $ui.showShop}
    <div class="overlay">
      <section class="modal shop-modal"><button class="close" onclick={() => ui.update((state) => ({ ...state, showShop: false }))}>×</button><p class="eyebrow">ARMORY</p><h1>Combat archive</h1><p>Preview every class path before choosing your evolution in the arena.</p><div class="class-grid">{#each Object.values(EVOLUTIONS) as item (item.name)}<article style={`--class-color:${item.color}`}><i></i><div><small>{item.unlockAt.toLocaleString()} COINS</small><h3>{item.label}</h3><p>{item.description}</p><strong>{item.abilityName}</strong></div></article>{/each}</div></section>
    </div>
  {/if}
</main>
