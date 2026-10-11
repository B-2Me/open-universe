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

    <div class="loom-hud" data-hud>booting…</div>

    <div class="loom-presets" role="group" aria-label="Camera presets">
      <button data-preset="full"    title="Full torus"            aria-label="Full torus">◉</button>
      <button data-preset="equator" title="Equatorial slab"       aria-label="Equatorial slab">◐</button>
      <button data-preset="bore"    title="Down the bore (top view)" aria-label="Down the bore">⊙</button>
      <button data-preset="lattice" title="Single lattice plane"  aria-label="Single lattice plane">≡</button>
    </div>

    <div class="loom-dock">
      <div class="loom-transport">
        <button data-play title="Play/Pause" aria-label="Play or pause">⏸</button>
        <button data-step title="Step one tick" aria-label="Step one tick">⏭</button>
        <button data-reset title="Reload Hopfion state" aria-label="Reset state">↺</button>
        <button data-knot title="Inject a saturated knot" aria-label="Inject knot">💥</button>
        <button data-spin class="on" aria-pressed="true" title="Auto-turntable" aria-label="Toggle auto-turntable">🔁</button>
      </div>
      <div class="loom-sliders">
        <label><span>Z</span><input type="range" data-zcenter min="0" max="39" step="1" value="20"></label>
        <label><span>Slab</span><input type="range" data-zthick min="1" max="40" step="1" value="40"></label>
        <label><span>Q≥</span><input type="range" data-qmin min="1" max="120" step="1" value="1"></label>
        <label><span>Size</span><input type="range" data-size min="20" max="150" step="1" value="55"></label>
        <select data-colormode aria-label="Color mode">
          <option value="1" selected>spin</option>
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
  padding: 6px 10px;
  font: 11px/1.4 monospace;
  color: #7fe;
  background: rgba(5, 5, 13, 0.5);
  pointer-events: none;
  text-shadow: 0 0 4px #000;
}
.loom-presets {
  position: absolute;
  top: 30px;
  right: 8px;
  display: flex;
  gap: 4px;
}
.loom-presets button,
.loom-transport button,
.loom-sliders select {
  min-width: 34px;
  min-height: 34px;
  padding: 0 8px;
  font: 14px monospace;
  color: #9ef;
  background: rgba(18, 26, 44, 0.7);
  border: 1px solid rgba(80, 140, 200, 0.4);
  border-radius: 6px;
  cursor: pointer;
}
.loom-presets button { font-size: 15px; }
.loom-dock {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 6px 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  align-items: center;
  background: rgba(5, 5, 13, 0.5);
}
.loom-transport {
  display: flex;
  gap: 4px;
}
.loom-transport button { font-size: 14px; }
.loom-transport button:active,
.loom-presets button:active {
  transform: scale(0.92);
  border-color: #7fe;
}
.loom-transport button.on {
  border-color: #7fe;
  color: #7fe;
}
.loom-sliders {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  align-items: center;
  font: 11px monospace;
  color: #9ef;
}
.loom-sliders label {
  display: flex;
  align-items: center;
  gap: 4px;
}
.loom-sliders label span { opacity: 0.8; }
.loom-sliders input[type='range'] {
  width: 72px;
  height: 24px;
  accent-color: #7fe;
}
.loom-sliders select {
  min-height: 30px;
  font-size: 11px;
}

/* 44px touch targets only where fingers live (coarse pointers). */
@media (pointer: coarse) {
  .loom-presets button,
  .loom-transport button,
  .loom-sliders select {
    min-width: 44px;
    min-height: 44px;
  }
  .loom-sliders label { min-height: 44px; }
  .loom-sliders input[type='range'] { width: 96px; height: 40px; }
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
