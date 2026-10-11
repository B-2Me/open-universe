<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

const host = ref(null)
let cleanup = null, boot = null

onMounted(async () => {
  document.body.classList.add('loom-page')
  const hud = host.value?.querySelector('[data-hud]')
  try {
    var { initLoomSimulator } = await import('../loom/main.js')
  } catch (e) {
    if (hud) hud.textContent = 'module load failed: ' + (e && e.message || e)
    return
  }
  boot = async () => {
    if (typeof cleanup === 'function') cleanup()
    try {
      cleanup = await initLoomSimulator(host.value)
    } catch (e) {
      if (hud) hud.textContent = 'ERR ' + (e && e.message || e)
      console.error(e)
    }
  }
  // WebGL context restored after a system-level kill (common on iOS):
  // re-run the whole init against the fresh context.
  host.value.addEventListener('loom:reinit', boot)
  await boot()
})
onUnmounted(() => {
  document.body.classList.remove('loom-page')
  host.value?.removeEventListener('loom:reinit', boot)
  if (typeof cleanup === 'function') cleanup()
})
</script>

<template>
  <div ref="host" class="loom-simulator">
    <canvas class="loom-canvas" aria-label="Hopf's Loom 3D lattice renderer"></canvas>

    <!-- telemetry chip -->
    <div class="loom-hud" data-hud>booting…</div>

    <!-- always-visible collapse toggle -->
    <button class="loom-uitoggle" data-uitoggle title="Toggle controls" aria-label="Toggle controls">⚙</button>

    <!-- floating control dock -->
    <div class="loom-dock">
      <div class="loom-transport" role="group" aria-label="Transport">
        <button data-play  title="Play / pause"      aria-label="Play or pause">⏸</button>
        <button data-step  title="Step one tick"      aria-label="Step one tick">⏭</button>
        <button data-reset title="Reset to Hopfion"   aria-label="Reset">⟲</button>
        <button data-knot  title="Knot tool — arm, then click the lattice to place"
                aria-label="Knot placement tool"      aria-pressed="false">⌖</button>
        <button data-spin class="on" aria-pressed="true"
                title="Auto-rotate"                   aria-label="Toggle auto-rotate">⟳</button>
        <button data-snap  title="Snapshot state"     aria-label="Save snapshot">⧉</button>
        <button data-unsnap title="Restore snapshot"  aria-label="Restore snapshot" disabled>⤺</button>
      </div>

      <select data-preset aria-label="View preset" title="Camera preset">
        <option value="full"    selected>Full torus</option>
        <option value="side">Side profile</option>
        <option value="equator">Equator slab</option>
        <option value="bore">Core bore</option>
        <option value="core">Deep core</option>
        <option value="lattice">Lattice plane</option>
      </select>

      <label>Slice <input type="range" data-zcenter min="0" max="39" step="1" value="20"><output>20</output></label>
      <label>Width <input type="range" data-zthick  min="1" max="40" step="1" value="40"><output>40</output></label>
      <label>Size  <input type="range" data-size    min="20" max="150" step="1" value="55"><output>55</output></label>
      <label>Q≥    <input type="range" data-qmin    min="1" max="120" step="1" value="1"><output>1</output></label>
      <label>Diss  <input type="range" data-diss    min="0" max="31" step="1" value="15"><output>15</output></label>
      <label>Heat  <input type="range" data-therm   min="5" max="65" step="1" value="50"><output>50k</output></label>

      <select data-colormode aria-label="Color mode" title="Color mode">
        <option value="1" selected>spin class</option>
        <option value="0">density</option>
        <option value="2">metabolism</option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.loom-simulator {
  position: relative;
  height: 75vh;
  min-height: 520px;
  background: #05050d;
  border-radius: 10px;
  overflow: hidden;
}
.loom-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  touch-action: none;
}

/* telemetry chip — small, top-left, translucent */
.loom-hud {
  position: absolute;
  top: 8px;
  left: 8px;
  max-width: calc(100% - 64px);
  padding: 4px 10px;
  font: 11px/1.5 monospace;
  color: #7fe;
  background: rgba(8, 10, 20, 0.6);
  border: 1px solid rgba(80, 140, 200, 0.25);
  border-radius: 8px;
  pointer-events: none;
  text-shadow: 0 0 4px #000;
  word-break: break-all;
  z-index: 3;
}

/* collapse toggle — small, always visible */
.loom-uitoggle {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 34px;
  height: 34px;
  font: 14px monospace;
  color: #9ef;
  background: rgba(8, 10, 20, 0.6);
  border: 1px solid rgba(80, 140, 200, 0.25);
  border-radius: 8px;
  cursor: pointer;
  z-index: 3;
}
.loom-simulator.dock-hidden .loom-dock { display: none; }

/* floating dock — centered pill, Sketchfab-style */
.loom-dock {
  position: absolute;
  left: 50%;
  bottom: 10px;
  transform: translateX(-50%);
  max-width: calc(100% - 16px);
  padding: 6px 10px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px 12px;
  align-items: center;
  background: rgba(8, 10, 20, 0.72);
  border: 1px solid rgba(80, 140, 200, 0.25);
  border-radius: 12px;
  backdrop-filter: blur(6px);
  z-index: 3;
}
.loom-transport { display: flex; gap: 4px; }
.loom-transport button,
.loom-dock select {
  min-width: 34px;
  min-height: 34px;
  padding: 0 9px;
  font: 13px monospace;
  color: #9ef;
  background: rgba(24, 34, 56, 0.9);
  border: 1px solid rgba(80, 140, 200, 0.35);
  border-radius: 7px;
  cursor: pointer;
}
.loom-transport button:active,
.loom-dock select:active {
  transform: scale(0.94);
  border-color: #7fe;
}
.loom-transport button.on { border-color: #7fe; color: #7fe; }
.loom-transport button:disabled { opacity: 0.35; cursor: default; }

.loom-dock label {
  display: flex;
  align-items: center;
  gap: 5px;
  font: 11px monospace;
  color: #9ef;
  white-space: nowrap;
}
.loom-dock label input[type='range'] {
  width: 70px;
  height: 22px;
  accent-color: #7fe;
}
.loom-dock label output {
  min-width: 2ch;
  color: #7fe;
  opacity: 0.9;
}
.loom-dock select { font-size: 11px; min-height: 30px; }

/* real 44px targets only where fingers live */
@media (pointer: coarse) {
  .loom-transport button, .loom-dock select, .loom-uitoggle {
    min-width: 44px;
    min-height: 44px;
  }
  .loom-dock label input[type='range'] { width: 90px; height: 40px; }
}
</style>

<style>
/* Suppress VitePress chrome that overlays the simulator dock. */
.loom-page .VPDocFooter,
.loom-page .VPBackToTop,
.loom-page .VPLocalNavOutlineDropdown,
.loom-page .aside-top {
  display: none !important;
}
</style>
