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
      <div class="loom-well loom-transport" role="group" aria-label="Transport">
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

      <label class="loom-field"><span>View</span><select data-preset aria-label="View preset" title="Camera preset">
        <option value="full"    selected>Full torus</option>
        <option value="side">Side profile</option>
        <option value="equator">Equator slab</option>
        <option value="bore">Core bore</option>
        <option value="core">Deep core</option>
        <option value="lattice">Lattice plane</option>
      </select></label>

      <div class="loom-well loom-sliders">
        <label>Slice <input type="range" data-zcenter min="0" max="39" step="1" value="20"><output>20</output></label>
        <label>Width <input type="range" data-zthick  min="1" max="40" step="1" value="40"><output>40</output></label>
        <label>Size  <input type="range" data-size    min="20" max="150" step="1" value="55"><output>55</output></label>
        <label>Q≥    <input type="range" data-qmin    min="1" max="120" step="1" value="1"><output>1</output></label>
        <label>Diss  <input type="range" data-diss    min="0" max="31" step="1" value="15"><output>15</output></label>
        <label>Heat  <input type="range" data-therm   min="5" max="65" step="1" value="50"><output>50k</output></label>
      </div>

      <label class="loom-field"><span>Color</span><select data-colormode aria-label="Color mode" title="Color mode">
        <option value="2" selected>metabolism</option>
        <option value="1">spin class</option>
        <option value="0">density</option>
      </select></label>
    </div>
  </div>
</template>

<style scoped>
/* Wake-style soft-UI skin: raised beveled controls seated in inset
   wells on a deep drop-shadowed panel — background recedes, controls pop. */
.loom-simulator {
  --loom-panel: linear-gradient(180deg, #141c30, #0a101d);
  --loom-well: #060a13;
  --loom-btn-top: #22314f;
  --loom-btn-bot: #131c30;
  --loom-bevel-light: rgba(160, 200, 255, 0.16);
  --loom-bevel-dark: rgba(0, 0, 0, 0.65);
  --loom-accent: #7fe;
  --loom-muted: #9ef;
  position: relative;
  height: 75vh;
  height: 75dvh;
  min-height: 520px;
  background: #05050d;
  border-radius: 10px;
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
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
  color: var(--loom-accent);
  background: rgba(8, 10, 20, 0.6);
  border: 1px solid var(--loom-bevel-light);
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45), inset 0 1px 0 var(--loom-bevel-light);
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
  color: var(--loom-muted);
  background: var(--loom-panel);
  border: 1px solid var(--loom-bevel-dark);
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5), inset 0 1px 0 var(--loom-bevel-light);
  cursor: pointer;
  z-index: 3;
}
.loom-uitoggle:active { box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.6); transform: scale(0.96); }
.loom-simulator.dock-hidden .loom-dock { display: none; }

/* floating dock — raised panel; wells carve control groups into it */
.loom-dock {
  position: absolute;
  left: 50%;
  bottom: 10px;
  transform: translateX(-50%);
  max-width: calc(100% - 16px);
  padding: 7px 10px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px 10px;
  align-items: center;
  background: var(--loom-panel);
  border: 1px solid var(--loom-bevel-dark);
  border-radius: 14px;
  box-shadow:
    0 14px 34px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 var(--loom-bevel-light);
  backdrop-filter: blur(8px);
  z-index: 3;
}

/* inset wells — sunken channels that group the raised controls */
.loom-well {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  background: var(--loom-well);
  border: 1px solid var(--loom-bevel-dark);
  border-radius: 10px;
  box-shadow:
    inset 0 2px 7px rgba(0, 0, 0, 0.65),
    0 1px 0 rgba(160, 200, 255, 0.07);
}
.loom-transport { gap: 4px; }
.loom-sliders { flex-wrap: wrap; justify-content: center; gap: 4px 12px; }

/* raised controls — gradient face, dark rim, top highlight, drop shadow */
.loom-transport button,
.loom-dock select {
  min-width: 34px;
  min-height: 34px;
  padding: 0 10px;
  font: 13px monospace;
  color: var(--loom-muted);
  background: linear-gradient(180deg, var(--loom-btn-top), var(--loom-btn-bot));
  border: 1px solid var(--loom-bevel-dark);
  border-radius: 7px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5), inset 0 1px 0 var(--loom-bevel-light);
  cursor: pointer;
}
.loom-transport button:active {
  transform: scale(0.94);
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.6);
}
.loom-transport button.on {
  color: var(--loom-accent);
  border-color: rgba(119, 255, 238, 0.45);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5), inset 0 1px 0 var(--loom-bevel-light),
    0 0 9px rgba(119, 255, 238, 0.3);
}
.loom-transport button:disabled { opacity: 0.35; cursor: default; }

/* dropdowns — labeled field + explicit chevron so they read as menus */
.loom-field {
  display: flex;
  align-items: center;
  gap: 6px;
  font: 11px monospace;
  color: var(--loom-muted);
  white-space: nowrap;
}
.loom-field > span {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.75;
}
.loom-dock select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 22px;
  font-size: 11px;
  min-height: 30px;
  background-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='6'%3E%3Cpath d='M0 0l4 6 4-6z' fill='%239eefff'/%3E%3C/svg%3E"),
    linear-gradient(180deg, var(--loom-btn-top), var(--loom-btn-bot));
  background-repeat: no-repeat;
  background-position: right 8px center, 0 0;
}

/* slider wells — recessed groove track + raised beveled thumb */
.loom-sliders label {
  display: flex;
  align-items: center;
  gap: 5px;
  font: 11px monospace;
  color: var(--loom-muted);
  white-space: nowrap;
}
.loom-sliders input[type='range'] {
  -webkit-appearance: none;
  appearance: none;
  width: 70px;
  height: 22px;
  background: transparent;
  cursor: pointer;
}
.loom-sliders input[type='range']::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(180deg, #04070d, #0d1524);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.8), 0 1px 0 var(--loom-bevel-light);
}
.loom-sliders input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  margin-top: -5px;
  border-radius: 50%;
  background: linear-gradient(180deg, var(--loom-btn-top), var(--loom-btn-bot));
  border: 1px solid var(--loom-bevel-dark);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6), inset 0 1px 0 var(--loom-bevel-light);
}
.loom-sliders input[type='range']:active::-webkit-slider-thumb {
  box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.6), 0 0 8px rgba(119, 255, 238, 0.35);
  border-color: rgba(119, 255, 238, 0.45);
}
.loom-sliders input[type='range']::-moz-range-track {
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(180deg, #04070d, #0d1524);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.8);
}
.loom-sliders input[type='range']::-moz-range-thumb {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: linear-gradient(180deg, var(--loom-btn-top), var(--loom-btn-bot));
  border: 1px solid var(--loom-bevel-dark);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6), inset 0 1px 0 var(--loom-bevel-light);
}
.loom-sliders output {
  min-width: 2ch;
  color: var(--loom-accent);
  opacity: 0.9;
}

/* real 44px targets only where fingers live */
@media (pointer: coarse) {
  .loom-transport button, .loom-dock select, .loom-uitoggle {
    min-width: 44px;
    min-height: 44px;
  }
  .loom-sliders input[type='range'] { width: 90px; height: 40px; }
  .loom-sliders input[type='range']::-webkit-slider-thumb { margin-top: -5px; }

  /* mobile: the canvas IS the app — fill the viewport under the nav bar,
     edge to edge, and clear the iPhone home-indicator strip */
  .loom-simulator {
    height: 100vh;
    height: calc(100dvh - var(--vp-nav-height, 64px));
    min-height: 0;
    border-radius: 0;
  }
  .loom-dock {
    bottom: calc(8px + env(safe-area-inset-bottom, 0px));
    max-width: calc(100% - 8px);
  }
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
/* Orbiting/pinch on mobile must not bounce or pull-to-refresh the page. */
html:has(.loom-simulator) {
  overscroll-behavior: none;
}
@media (pointer: coarse) {
  .loom-page .VPContent { padding-top: var(--vp-nav-height, 64px) !important; }
}
</style>
