<script>
  import { onMount } from 'svelte';
  import { BOT_COLORS, MAP_SIZE, PLAYER_RADIUS, WEAPONS } from './game.js';

  export let state = null;
  export let localId = '';
  export let send = () => {};

  let canvas;
  let minimap;
  let frame;
  let inputTimer;
  let width = 0;
  let height = 0;
  let camera = { x: MAP_SIZE / 2, y: MAP_SIZE / 2 };
  let mouse = { x: 0, y: 0 };
  const keys = new Set();

  const localPlayer = () => state?.players?.find((player) => player.id === localId);
  const visible = (entity, margin = 80) => Math.abs(entity.x - camera.x) < width / 2 + margin && Math.abs(entity.y - camera.y) < height / 2 + margin;
  const screen = (entity) => ({ x: entity.x - camera.x + width / 2, y: entity.y - camera.y + height / 2 });

  function resize() {
    if (!canvas || !minimap) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.getContext('2d').setTransform(ratio, 0, 0, ratio, 0, 0);
    minimap.width = 168 * ratio;
    minimap.height = 168 * ratio;
    minimap.style.width = '168px';
    minimap.style.height = '168px';
    minimap.getContext('2d').setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function roundedRect(ctx, x, y, w, h, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
  }

  function drawGrid(ctx) {
    ctx.fillStyle = state?.event?.kind === 'bloodMoon' ? '#180d15' : '#0b1018';
    ctx.fillRect(0, 0, width, height);
    const spacing = 80;
    const offsetX = ((-camera.x + width / 2) % spacing + spacing) % spacing;
    const offsetY = ((-camera.y + height / 2) % spacing + spacing) % spacing;
    ctx.strokeStyle = state?.event?.kind === 'bloodMoon' ? 'rgba(244,63,94,.09)' : 'rgba(121,162,179,.065)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = offsetX; x < width; x += spacing) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
    for (let y = offsetY; y < height; y += spacing) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
    ctx.stroke();

    const edge = screen({ x: 0, y: 0 });
    ctx.strokeStyle = 'rgba(97,231,199,.38)';
    ctx.lineWidth = 3;
    ctx.strokeRect(edge.x, edge.y, MAP_SIZE, MAP_SIZE);
  }

  function drawWorld(ctx) {
    if (!state) return;
    for (const hill of state.hills || []) {
      if (!visible(hill, hill.radius)) continue;
      const point = screen(hill);
      const gradient = ctx.createRadialGradient(point.x, point.y, 5, point.x, point.y, hill.radius);
      gradient.addColorStop(0, 'rgba(250,204,21,.12)');
      gradient.addColorStop(1, 'rgba(250,204,21,.015)');
      ctx.fillStyle = gradient;
      ctx.strokeStyle = 'rgba(250,204,21,.48)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(point.x, point.y, hill.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(250,204,21,.72)';
      ctx.font = '600 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('2× SIGNAL ZONE', point.x, point.y - hill.radius + 22);
    }

    for (const pool of state.lava || []) {
      if (!visible(pool, pool.radius)) continue;
      const point = screen(pool);
      const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, pool.radius);
      gradient.addColorStop(0, '#e34836'); gradient.addColorStop(.6, '#8f2e2b'); gradient.addColorStop(1, '#36171e');
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.arc(point.x, point.y, pool.radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,142,72,.45)'; ctx.lineWidth = 2; ctx.stroke();
    }

    for (const orb of state.orbs || []) {
      if (!visible(orb, 12)) continue;
      const point = screen(orb);
      ctx.shadowColor = '#65f6d2'; ctx.shadowBlur = 11; ctx.fillStyle = '#89ffe3';
      ctx.beginPath(); ctx.arc(point.x, point.y, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }

    for (const obstacle of state.cover || []) {
      if (!visible(obstacle, obstacle.radius)) continue;
      const point = screen(obstacle);
      ctx.save(); ctx.translate(point.x, point.y); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#273245'; ctx.strokeStyle = '#52677f'; ctx.lineWidth = 2;
      roundedRect(ctx, -obstacle.radius * .72, -obstacle.radius * .72, obstacle.radius * 1.44, obstacle.radius * 1.44, 5); ctx.fill(); ctx.stroke(); ctx.restore();
    }

    const powerColors = { berserk: '#ff5d73', haste: '#facc15', aegis: '#63b3ed' };
    for (const power of state.powerups || []) {
      if (!visible(power, 30)) continue;
      const point = screen(power);
      ctx.save(); ctx.translate(point.x, point.y); ctx.rotate(performance.now() / 700);
      ctx.shadowColor = powerColors[power.kind]; ctx.shadowBlur = 18; ctx.fillStyle = powerColors[power.kind];
      ctx.beginPath();
      for (let index = 0; index < 8; index += 1) {
        const angle = index * Math.PI / 4;
        const radius = index % 2 ? 7 : 13;
        ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      ctx.closePath(); ctx.fill(); ctx.restore();
    }

    for (const projectile of state.projectiles || []) {
      if (!visible(projectile)) continue;
      const point = screen(projectile);
      ctx.fillStyle = projectile.kind === 'blade' ? '#f8fafc' : '#c084fc';
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 9;
      ctx.beginPath(); ctx.arc(point.x, point.y, projectile.kind === 'blade' ? 7 : 5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }
  }

  function drawPlayer(ctx, player) {
    if (player.dead || !visible(player, 90)) return;
    const point = screen(player);
    const isMe = player.id === localId;
    const weapon = WEAPONS[player.weapon] || WEAPONS[0];
    ctx.save();
    ctx.translate(point.x, point.y);
    if (player.whirlwindUntil > state.now) {
      ctx.strokeStyle = 'rgba(97,231,199,.45)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, 0, 52, 0, Math.PI * 1.7); ctx.stroke();
    }
    if (player.shield > 0 || player.blockingUntil > state.now) {
      ctx.strokeStyle = player.blockingUntil > state.now ? '#f8fafc' : '#60a5fa';
      ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, PLAYER_RADIUS + 7, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.shadowColor = isMe ? '#61e7c7' : player.color || BOT_COLORS[player.botType];
    ctx.shadowBlur = isMe ? 18 : 8;
    ctx.fillStyle = player.color || '#ef7d57';
    ctx.beginPath(); ctx.arc(0, 0, PLAYER_RADIUS, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = isMe ? '#d9fff5' : 'rgba(255,255,255,.55)'; ctx.lineWidth = isMe ? 3 : 2; ctx.stroke();

    ctx.rotate(player.angle);
    const swing = player.attackingUntil > state.now ? -.75 : 0;
    ctx.rotate(swing);
    ctx.fillStyle = '#5a3e31'; roundedRect(ctx, 12, -3, 16, 6, 2); ctx.fill();
    ctx.fillStyle = weapon.color; ctx.shadowColor = weapon.color; ctx.shadowBlur = 8;
    roundedRect(ctx, 25, -3.5, 34 + player.weapon * 2, 7, 3); ctx.fill();
    ctx.restore();

    const healthWidth = 38;
    ctx.fillStyle = 'rgba(2,6,12,.78)'; roundedRect(ctx, point.x - healthWidth / 2, point.y - 32, healthWidth, 5, 3); ctx.fill();
    ctx.fillStyle = player.health / player.maxHealth < .3 ? '#ff5d73' : '#61e7c7';
    roundedRect(ctx, point.x - healthWidth / 2, point.y - 32, healthWidth * Math.max(0, player.health / player.maxHealth), 5, 3); ctx.fill();
    ctx.fillStyle = isMe ? '#d9fff5' : 'rgba(236,245,247,.8)'; ctx.font = `${isMe ? 600 : 500} 11px Inter, sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(player.name, point.x, point.y - 39);
  }

  function drawBoss(ctx) {
    if (!state?.boss || !visible(state.boss, 100)) return;
    const boss = state.boss;
    const point = screen(boss);
    ctx.save(); ctx.translate(point.x, point.y); ctx.rotate(boss.angle);
    ctx.shadowColor = '#ff496a'; ctx.shadowBlur = 30; ctx.fillStyle = '#76263a'; ctx.strokeStyle = '#ff6b82'; ctx.lineWidth = 4;
    ctx.beginPath();
    for (let index = 0; index < 12; index += 1) {
      const angle = index * Math.PI / 6;
      const radius = index % 2 ? boss.radius * .78 : boss.radius;
      ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }

  function drawMinimap() {
    if (!minimap || !state) return;
    const ctx = minimap.getContext('2d');
    const scale = 168 / MAP_SIZE;
    ctx.clearRect(0, 0, 168, 168);
    ctx.fillStyle = 'rgba(7,11,18,.94)'; ctx.fillRect(0, 0, 168, 168);
    for (const hill of state.hills || []) { ctx.fillStyle = 'rgba(250,204,21,.25)'; ctx.beginPath(); ctx.arc(hill.x * scale, hill.y * scale, hill.radius * scale, 0, Math.PI * 2); ctx.fill(); }
    for (const pool of state.lava || []) { ctx.fillStyle = 'rgba(239,68,68,.5)'; ctx.beginPath(); ctx.arc(pool.x * scale, pool.y * scale, Math.max(2, pool.radius * scale), 0, Math.PI * 2); ctx.fill(); }
    for (const player of state.players || []) {
      if (player.dead) continue;
      ctx.fillStyle = player.id === localId ? '#d9fff5' : player.bot ? '#ef7d57' : '#61e7c7';
      ctx.beginPath(); ctx.arc(player.x * scale, player.y * scale, player.id === localId ? 3 : 1.7, 0, Math.PI * 2); ctx.fill();
    }
    if (state.boss) { ctx.fillStyle = '#ff496a'; ctx.beginPath(); ctx.arc(state.boss.x * scale, state.boss.y * scale, 4, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = 'rgba(97,231,199,.38)'; ctx.strokeRect(.5, .5, 167, 167);
  }

  function draw() {
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const me = localPlayer();
    if (me && !me.dead) {
      camera.x += (me.x - camera.x) * .18;
      camera.y += (me.y - camera.y) * .18;
    }
    ctx.clearRect(0, 0, width, height);
    drawGrid(ctx);
    drawWorld(ctx);
    for (const player of state?.players || []) drawPlayer(ctx, player);
    drawBoss(ctx);
    drawMinimap();
    frame = requestAnimationFrame(draw);
  }

  function sendInput() {
    const x = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    const y = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
    send({ type: 'input', x, y, angle: Math.atan2(mouse.y - height / 2, mouse.x - width / 2) });
  }

  function keydown(event) {
    const key = event.key.toLowerCase();
    keys.add(key);
    if (event.repeat) return;
    if (key === 'shift') send({ type: 'action', kind: 'dash' });
    if (key === 'e') send({ type: 'action', kind: 'whirlwind' });
    if (key === 'x') send({ type: 'action', kind: 'block' });
    if (key === ' ') { event.preventDefault(); send({ type: 'action', kind: 'attack' }); }
  }

  function keyup(event) { keys.delete(event.key.toLowerCase()); }
  function pointermove(event) { mouse = { x: event.clientX, y: event.clientY }; }
  function pointerdown(event) {
    if (event.button === 0) send({ type: 'action', kind: 'attack' });
    if (event.button === 1) send({ type: 'action', kind: 'block' });
    if (event.button === 2) send({ type: 'action', kind: 'throw' });
  }

  onMount(() => {
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('pointermove', pointermove);
    canvas.addEventListener('pointerdown', pointerdown);
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    inputTimer = setInterval(sendInput, 1000 / 30);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame); clearInterval(inputTimer);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('pointermove', pointermove);
      canvas.removeEventListener('pointerdown', pointerdown);
    };
  });
</script>

<canvas class="game-canvas" bind:this={canvas} aria-label="8j8k multiplayer arena"></canvas>
<canvas class="minimap" bind:this={minimap} aria-label="Arena minimap"></canvas>
