<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

const host = ref(null)
let cleanup = null, boot = null

onMounted(async () => {
  document.body.classList.add('loom-page')
  const { initLoomSimulator } = await import('../loom/main.js')
  boot = async () => {
    if (typeof cleanup === 'function') cleanup()
    cleanup = await initLoomSimulator(host.value)
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

    <!-- Top telemetry HUD -->
    <div class="loom-hud" data-hud>booting…</div>

    <!-- Quick-view presets strip -->
    <div class="loom-presets">
      <button data-preset="full">Full</button>
      <button data-preset="equator">Equator Cut</button>
      <button data-preset="bore">Core Bore</button>
      <button data-preset="lattice">Lattice Plane</button>
    </div>

    <!-- Bottom ergonomic dock -->
    <div class="loom-dock">
      <div class="loom-transport">
        <button data-play title="Play/Pause" aria-label="Play or pause">⏸</button>
        <button data-step title="Step one tick" aria-label="Step one tick">⏭</button>
        <button data-reset title="Reload Hopfion state" aria-label="Reset state">↺</button>
        <button data-knot title="Inject a saturated knot" aria-label="Inject knot">💥</button>
        <button data-spin class="on" aria-pressed="true" title="Toggle auto-turntable" aria-label="Toggle auto-turntable">🔁</button>
      </div>
      <div class="loom-sliders">
        <label>Elevation <input type="range" data-zcenter min="0" max="39" step="1" value="20"></label>
        <label>Slab <input type="range" data-zthick min="1" max="40" step="1" value="40"></label>
        <label>Q≥ <input type="range" data-qmin min="1" max="120" step="1" value="1"></label>
        <label>Size <input type="range" data-size min="20" max="150" step="1" value="55"></label>
        <select data-colormode aria-label="Color mode">
          <option value="1" selected>spin class</option>
          <option value="0">density</option>
        </select>
      </div>
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
.loom-hud {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 8px 12px;
  font: 11px/1.5 monospace;
  color: #7fe;
  background: rgba(5, 5, 13, 0.55);
  backdrop-filter: blur(4px);
  pointer-events: none;
  text-shadow: 0 0 4px #000;
}
.loom-presets {
  position: absolute;
  top: 34px;
  left: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.loom-presets button {
  min-width: 44px;
  min-height: 44px;
  padding: 6px 12px;
  font: 12px monospace;
  color: #9ef;
  background: rgba(20, 30, 50, 0.75);
  border: 1px solid rgba(80, 140, 200, 0.5);
  border-radius: 6px;
  cursor: pointer;
}
.loom-dock {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 8px 12px 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  background: rgba(5, 5, 13, 0.55);
  backdrop-filter: blur(4px);
}
.loom-transport {
  display: flex;
  gap: 8px;
}
.loom-transport button {
  min-width: 44px;
  min-height: 44px;
  font-size: 18px;
  color: #9ef;
  background: rgba(20, 30, 50, 0.75);
  border: 1px solid rgba(80, 140, 200, 0.5);
  border-radius: 8px;
  cursor: pointer;
}
.loom-transport button:active,
.loom-presets button:active {
  transform: scale(0.94);
  border-color: #7fe;
}
.loom-transport button.on {
  border-color: #7fe;
  color: #7fe;
}
.loom-sliders {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  font: 11px monospace;
  color: #9ef;
}
.loom-sliders label {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
}
.loom-sliders input[type='range'] {
  width: 90px;
  height: 44px;
  accent-color: #7fe;
}
.loom-sliders select {
  min-height: 44px;
  font: 12px monospace;
  color: #9ef;
  background: rgba(20, 30, 50, 0.75);
  border: 1px solid rgba(80, 140, 200, 0.5);
  border-radius: 6px;
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
