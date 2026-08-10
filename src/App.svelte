<script>
  import { onMount } from 'svelte';
  import GameCanvas from './lib/GameCanvas.svelte';
  import { SCORE_TO_RESET, UPGRADES, WEAPONS, upgradeCost } from './lib/game.js';

  let socket;
  let reconnectTimer;
  let status = 'connecting';
  let localId = '';
  let state = null;
  let name = localStorage.getItem('8j8k-name') || '';
  let activeName = '';
  let instructionsOpen = false;
  let mapNotice = 0;
  let previousMapVersion = null;

  $: me = state?.players?.find((player) => player.id === localId);
  $: weapon = WEAPONS[me?.weapon || 0];
  $: isPlaying = Boolean(me);

  function connect() {
    status = 'connecting';
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${protocol}://${location.host}/ws`);
    socket.addEventListener('open', () => { status = 'connected'; });
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'welcome') {
        localId = message.id;
        if (activeName) send({ type: 'join', name: activeName });
      } else if (message.type === 'snapshot') {
        if (previousMapVersion !== null && previousMapVersion !== message.mapVersion) {
          mapNotice = Date.now() + 4200;
        }
        previousMapVersion = message.mapVersion;
        state = message;
      }
    });
    socket.addEventListener('close', () => {
      status = 'disconnected';
      localId = '';
      state = null;
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 1500);
    });
    socket.addEventListener('error', () => socket.close());
  }

  function send(message) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }

  function join() {
    activeName = name.trim().slice(0, 18) || 'Wanderer';
    localStorage.setItem('8j8k-name', activeName);
    send({ type: 'join', name: activeName });
  }

  function onNameKeydown(event) {
    if (event.key === 'Enter') join();
  }

  onMount(() => {
    connect();
    return () => { clearTimeout(reconnectTimer); socket?.close(); };
  });
</script>

<main class:blood-moon={state?.event?.kind === 'bloodMoon'}>
  <GameCanvas {state} {localId} {send} />

  <header class="brand">
    <span class="brand-mark">8J</span>
    <div><strong>8j8k</strong><small>OPEN ARENA // {state?.mapVersion ? `SECTOR ${state.mapVersion}` : 'LINKING'}</small></div>
  </header>

  <div class="connection" class:offline={status !== 'connected'}>
    <i></i>{status === 'connected' ? 'Live' : status}
  </div>

  {#if isPlaying && me}
    <aside class="panel upgrades-panel">
      <div class="panel-heading"><span>Loadout</span><small>{Math.round(me.score)} CR</small></div>
      <div class="weapon-card">
        <span class="weapon-swatch" style:background={weapon.color}></span>
        <div><strong>{weapon.name}</strong><small>{Math.round(weapon.damage)} base damage</small></div>
      </div>
      <div class="upgrade-list">
        {#each Object.entries(UPGRADES) as [kind, upgrade]}
          {@const level = me.upgrades?.[kind] || 0}
          {@const cost = upgradeCost(kind, level)}
          <button class:affordable={me.score >= cost && level < upgrade.max} disabled={level >= upgrade.max} on:click={() => send({ type: 'upgrade', kind })}>
            <div><strong>{upgrade.label}</strong><small>{upgrade.detail}</small></div>
            <span>{level >= upgrade.max ? 'MAX' : `${cost} CR`}</span>
          </button>
        {/each}
      </div>
    </aside>

    <aside class="panel leaderboard-panel">
      <div class="panel-heading"><span>Signal board</span><small>TOP 8</small></div>
      <ol>
        {#each state?.leaderboard || [] as player, index}
          <li class:mine={player.id === localId}>
            <span class="rank">{String(index + 1).padStart(2, '0')}</span>
            <span class="leader-name">{player.name}{player.bot ? ' ∙' : ''}</span>
            <strong>{Math.round(player.score)}</strong>
          </li>
        {/each}
      </ol>
    </aside>

    <section class="player-hud">
      <div class="score"><small>SCORE</small><strong>{Math.round(me.score).toLocaleString()}</strong><span>/ {SCORE_TO_RESET.toLocaleString()}</span></div>
      <div class="health-track"><i style:width={`${Math.max(0, me.health / me.maxHealth * 100)}%`}></i></div>
      <div class="hud-meta"><span>{Math.ceil(me.health)} / {me.maxHealth} HP</span><span>{me.kills} eliminations</span></div>
      {#if me.powerup}<div class="power-status">{me.powerup} active</div>{/if}
    </section>

    <div class="controls-hint">
      <span><kbd>WASD</kbd> MOVE</span><span><kbd>CLICK</kbd> STRIKE</span><span><kbd>SHIFT</kbd> DASH</span><span><kbd>E</kbd> WHIRL</span>
    </div>

    {#if me.score >= SCORE_TO_RESET}
      <button class="reset-button" on:click={() => send({ type: 'reset' })}>RESET SECTOR</button>
    {/if}
  {/if}

  {#if state?.boss}
    <section class="boss-hud">
      <div><span>ANOMALY DETECTED</span><strong>{state.boss.name}</strong></div>
      <div class="boss-track"><i style:width={`${Math.max(0, state.boss.health / state.boss.maxHealth * 100)}%`}></i></div>
      <small>{Math.ceil(state.boss.health)} / {state.boss.maxHealth}</small>
    </section>
  {/if}

  {#if state?.event?.kind === 'bloodMoon'}
    <div class="event-banner"><small>WORLD EVENT</small><strong>THE BLOOD MOON IS RISING</strong></div>
  {/if}

  {#if mapNotice > Date.now()}
    <div class="map-notice">SECTOR PURGED <small>The arena has been rebuilt.</small></div>
  {/if}

  {#if !isPlaying}
    <section class="overlay launch-overlay">
      <div class="launch-card">
        <div class="eyebrow">REAL-TIME MULTIPLAYER</div>
        <h1>Enter the<br /><em>open arena.</em></h1>
        <p>Collect signals. Outfight rivals. Reach 14,500 and rewrite the world for everyone connected.</p>
        <label for="name">CALLSIGN</label>
        <div class="join-row">
          <input id="name" bind:value={name} on:keydown={onNameKeydown} maxlength="18" autocomplete="nickname" placeholder="Wanderer" />
          <button on:click={join} disabled={status !== 'connected'}>{status === 'connected' ? 'DEPLOY' : 'LINKING…'}</button>
        </div>
        <button class="text-button" on:click={() => instructionsOpen = true}>View field manual</button>
        <div class="system-line"><i class:ready={status === 'connected'}></i>{status === 'connected' ? 'Arena link established' : 'Establishing arena link'}</div>
      </div>
    </section>
  {/if}

  {#if me?.dead}
    <section class="overlay death-overlay">
      <div class="death-card">
        <div class="eyebrow danger">SIGNAL LOST</div>
        <h2>You were erased.</h2>
        <p>Final score <strong>{Math.round(me.score).toLocaleString()}</strong> · {me.kills} eliminations</p>
        <button on:click={() => send({ type: 'respawn' })}>RE-ENTER ARENA</button>
      </div>
    </section>
  {/if}

  {#if instructionsOpen}
    <div class="overlay manual-overlay" role="dialog" aria-modal="true" aria-labelledby="manual-title">
      <div class="manual-card">
        <button class="close" aria-label="Close field manual" on:click={() => instructionsOpen = false}>×</button>
        <div class="eyebrow">FIELD MANUAL // 01</div>
        <h2 id="manual-title">Survive the signal.</h2>
        <div class="manual-grid">
          <article><b>01</b><h3>Harvest</h3><p>Collect mint signals for score and healing. Gold zones double every signal's value.</p></article>
          <article><b>02</b><h3>Fight</h3><p>Aim with the mouse. Strike, throw your weapon, block, dash, or unleash a close-range whirlwind.</p></article>
          <article><b>03</b><h3>Adapt</h3><p>Spend score on persistent-in-life upgrades. Eliminations unlock stronger weapon tiers.</p></article>
          <article><b>04</b><h3>Rewrite</h3><p>The first player to 14,500 can reset the shared sector. Every connected player feels it.</p></article>
        </div>
        <div class="keys"><kbd>WASD</kbd><span>move</span><kbd>LMB</kbd><span>strike</span><kbd>RMB</kbd><span>throw</span><kbd>X</kbd><span>block</span><kbd>E</kbd><span>whirlwind</span></div>
      </div>
    </div>
  {/if}
</main>
