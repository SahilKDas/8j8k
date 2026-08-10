<script>
    import { onMount } from 'svelte';
    import { createGame } from './lib/gameEngine.js';

    onMount(() => {
        const game = createGame();
        return () => game.destroy();
    });
</script>

<div class="w-screen h-screen">
    <canvas id="gameCanvas"></canvas>

    <div id="blood-moon-overlay" class="hidden absolute inset-0 w-full h-full bg-red-900 bg-opacity-30 pointer-events-none transition-opacity duration-1000"></div>
    <div id="blood-moon-announcement-container" class="hidden absolute top-1/3 left-1/2 -translate-x-1/2 w-full flex justify-center pointer-events-none">
        <h1 id="blood-moon-announcement" class="text-6xl font-bold text-red-400" style="text-shadow: 0 0 15px #ff0000;">The Blood Moon is Rising</h1>
    </div>

    <div id="minimap-container" class="absolute bottom-4 right-4 glass-panel p-1 rounded-2xl shadow-2xl">
        <canvas id="minimapCanvas"></canvas>
    </div>

    <div id="ui-container" class="w-full h-full p-4 md:p-8 flex flex-col justify-between">
        <div class="flex justify-between items-start gap-4">
            <div class="flex flex-col gap-4">
                <div id="upgrades" class="glass-panel p-4 w-64 text-white shadow-lg">
                    <h2 class="text-xl font-bold border-b border-gray-500 pb-2 mb-2">Upgrades</h2>
                    <ul id="upgrades-list" class="space-y-2"></ul>
                </div>
                <div id="leaderboard" class="glass-panel p-4 w-64 text-white shadow-lg">
                    <h2 class="text-xl font-bold border-b border-gray-500 pb-2 mb-2">Leaderboard</h2>
                    <ul id="leaderboard-list"></ul>
                </div>
            </div>

            <div id="boss-ui" class="hidden glass-panel p-3 w-1/3 text-white shadow-lg absolute left-1/2 -translate-x-1/2">
                <h2 id="boss-name" class="text-xl font-bold text-center text-red-400"><span class="sr-only">Boss</span></h2>
                <div class="w-full bg-gray-700 rounded-full h-4 mt-2 border-2 border-red-900">
                    <div id="boss-hp-bar" class="bg-red-500 h-full rounded-full transition-all duration-300"></div>
                </div>
            </div>

            <div id="player-stats" class="glass-panel p-4 w-64 text-white shadow-lg">
                <h2 class="text-xl font-bold border-b border-gray-500 pb-2 mb-2">My Stats</h2>
                <ul id="player-stats-list" class="text-sm space-y-2"></ul>
            </div>
        </div>

        <div class="flex flex-col items-center gap-2">
            <div id="score-display" class="glass-panel py-2 px-6 text-white text-2xl font-bold shadow-lg">Score: 0</div>
            <div id="reset-map-container" class="hidden">
                <button id="reset-map-button" class="ui-element glass-panel py-2 px-6 text-yellow-300 font-bold shadow-lg hover:bg-yellow-400 hover:text-black transition-colors">Reset Map</button>
            </div>
        </div>
    </div>

    <div id="start-screen" class="absolute inset-0 w-full h-full flex justify-center items-center pointer-events-auto bg-black bg-opacity-70">
        <div class="glass-panel p-8 rounded-lg text-center text-white shadow-2xl max-w-sm flex flex-col gap-4">
            <h1 class="text-4xl font-bold">6j8k</h1>
            <p class="text-gray-300">First to 14500 score resets the map! Use [Shift] to Dash. Some NPCs will fight in teams!</p>
            <input type="text" id="name-input" placeholder="Your Name" class="ui-element w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button id="start-button" class="ui-element w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105 shadow-lg">Play</button>
            <button id="instructions-button" class="ui-element w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-transform transform hover:scale-105 shadow-lg">How to Play</button>
        </div>
    </div>

    <div id="death-screen" class="hidden absolute inset-0 w-full h-full flex justify-center items-center pointer-events-auto bg-black bg-opacity-80">
        <div class="glass-panel p-8 rounded-lg text-center text-white shadow-2xl max-w-sm">
            <h1 class="text-4xl font-bold mb-2">You Died</h1>
            <p class="mb-4 text-gray-300">Your final score was <span id="final-score">0</span>.</p>
            <button id="respawn-button" class="ui-element w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105 shadow-lg">Respawn</button>
        </div>
    </div>

    <div id="instructions-modal" class="hidden absolute inset-0 w-full h-full flex justify-center items-center pointer-events-auto bg-black bg-opacity-80">
        <div class="glass-panel p-8 rounded-lg text-white shadow-2xl max-w-lg text-left relative">
            <h1 class="text-3xl font-bold mb-4 text-center border-b border-gray-500 pb-2">How to Play</h1>
            <div class="space-y-4 text-gray-300 max-h-[70vh] overflow-y-auto pr-4">
                <div><h2 class="font-bold text-lg text-white">Objective</h2><p>Collect colored orbs and defeat enemies to increase your score. Reach <strong>14,500 points</strong> to unlock the option to reset the map!</p></div>
                <div>
                    <h2 class="font-bold text-lg text-white">Controls</h2>
                    <ul class="list-disc list-inside">
                        <li><strong>Move:</strong> WASD or Arrow Keys</li><li><strong>Aim:</strong> Mouse</li><li><strong>Attack:</strong> Left Click</li><li><strong>Whirlwind (AoE):</strong> 'E' Key</li><li><strong>Throw Weapon:</strong> Right Click</li><li><strong>Dash:</strong> Shift Key</li><li><strong>Block:</strong> 'X' Key or Middle Mouse</li>
                    </ul>
                </div>
                <div>
                    <h2 class="font-bold text-lg text-white">Map Features</h2>
                    <ul class="list-disc list-inside"><li><strong class="text-yellow-400">King of the Hill:</strong> Stand in the glowing gold zones to get a 2x score multiplier.</li><li><strong class="text-gray-400">Destructible Cover:</strong> Crystal formations block movement and attacks, but can be destroyed.</li><li><strong class="text-red-400">Lava Pools:</strong> Don't stand in them!</li></ul>
                </div>
                <div>
                    <h2 class="font-bold text-lg text-white">Power-ups (5 sec duration)</h2>
                    <ul class="list-disc list-inside"><li><strong class="text-red-400">Berserk (Red Orb):</strong> Doubles your damage.</li><li><strong class="text-yellow-400">Haste (Yellow Orb):</strong> Grants a major speed boost.</li><li><strong class="text-blue-400">Aegis (Blue Orb):</strong> Gives you a temporary shield.</li></ul>
                </div>
                <div>
                    <h2 class="font-bold text-lg text-white">Special NPCs</h2>
                    <ul class="list-disc list-inside"><li><strong class="text-green-400">Healer Bots:</strong> Follow and heal you.</li><li><strong class="text-gray-400">Shuriken Bots:</strong> Attack from a distance.</li><li><strong class="text-purple-400">Tank Bots:</strong> Durable bots with a projectile-blocking shield.</li><li><strong class="text-yellow-500">Stun Lancer:</strong> Slams the ground to stun you.</li><li><strong class="text-lime-400">Alchemist:</strong> Creates pools of damaging poison.</li><li><strong class="text-gray-500">Thief:</strong> Steals your score and runs away!</li></ul>
                </div>
                <div><h2 class="font-bold text-lg text-white">Upgrades</h2><p>Use your score to buy passive upgrades from the panel on the left. These upgrades reset when you die.</p></div>
            </div>
            <button id="close-instructions-button" class="ui-element absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded-full transition-transform transform hover:scale-105">X</button>
        </div>
    </div>
</div>
