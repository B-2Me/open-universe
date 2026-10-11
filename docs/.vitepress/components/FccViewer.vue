<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

const host = ref(null)
let cleanup = null

onMounted(async () => {
  const { initFccViewer } = await import('../fcc/main.js')
  cleanup = await initFccViewer(host.value)
})
onUnmounted(() => { if (typeof cleanup === 'function') cleanup() })
</script>

<template>
  <div ref="host" class="fcc-viewer">
    <canvas class="fcc-canvas" aria-label="3D FCC lattice renderer"></canvas>
    <div class="fcc-hud" data-hud>booting…</div>
    <div class="fcc-controls">
      <button data-play title="Play/Pause">⏸</button>
      <button data-step title="Step one tick">⏭</button>
      <button data-reset title="Reload Hopfion state">↺</button>
      <button data-knot title="Inject a saturated knot (collision)">💥</button>
      <label>Z <input type="range" data-zmin min="0" max="39" value="0"><input type="range" data-zmax min="0" max="39" value="39"></label>
      <label>Q≥ <input type="range" data-qmin min="1" max="120" value="1"></label>
      <label>Size <input type="range" data-size min="20" max="150" value="55"></label>
      <select data-colormode title="Color mode">
        <option value="1" selected>spin class</option>
        <option value="0">density</option>
      </select>
      <select data-mode title="Engine mode">
        <option value="0" selected>flat</option>
        <option value="1">halo</option>
        <option value="2">ordered</option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.fcc-viewer { position: relative; height: 70vh; min-height: 420px; background: #05050d; border-radius: 8px; overflow: hidden; }
.fcc-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
.fcc-hud { position: absolute; top: 8px; left: 10px; font: 11px/1.4 monospace; color: #7fe; pointer-events: none; text-shadow: 0 0 4px #000; }
.fcc-controls { position: absolute; bottom: 8px; left: 10px; right: 10px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font: 11px monospace; color: #9ef; }
.fcc-controls button { background: #123; color: #9ef; border: 1px solid #246; border-radius: 4px; padding: 4px 8px; cursor: pointer; }
.fcc-controls label { display: flex; align-items: center; gap: 4px; }
.fcc-controls input[type=range] { width: 80px; }
.fcc-controls select { background: #123; color: #9ef; border: 1px solid #246; border-radius: 4px; }
</style>
