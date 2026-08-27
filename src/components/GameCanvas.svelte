<script lang="ts">
  import { onMount } from 'svelte';
  import type Phaser from 'phaser';

  let host: HTMLDivElement;
  onMount(() => {
    let game: Phaser.Game | undefined;
    let disposed = false;
    void import('../game/createGame.js').then(({ createGame }) => {
      if (!disposed) game = createGame(host);
    });
    return () => { disposed = true; game?.destroy(true); };
  });
</script>

<div class="game-canvas" bind:this={host} aria-label="8j8k multiplayer arena"></div>
