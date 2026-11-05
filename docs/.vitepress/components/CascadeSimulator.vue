<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

const host = ref(null)
let cleanup = null, boot = null

/* The dock lives inside the canvas, and canvas touch gestures capture
   scrolling — so the simulator must never be taller than the visible
   area above it. Measure the element's document offset and feed the
   CSS var, rather than guessing --vp-nav-height + margins. */
const fit = () => {
  const el = host.value
  if (!el) return
  el.style.setProperty('--tool-top', `${Math.round(el.getBoundingClientRect().top + window.scrollY)}px`)
}

onMounted(async () => {
  document.body.classList.add('cascade-page')
  fit()
  requestAnimationFrame(fit)
  window.addEventListener('resize', fit)
  window.addEventListener('load', fit)
  const hud = host.value?.querySelector('[data-hud]')
  try {
    var { initCascadeSimulator } = await import('../cascade/main.js')
  } catch (e) {
    if (hud) hud.textContent = 'module load failed: ' + (e && e.message || e)
    return
  }
  boot = async () => {
    if (typeof cleanup === 'function') cleanup()
    try {
      cleanup = await initCascadeSimulator(host.value)
    } catch (e) {
      if (hud) hud.textContent = 'ERR ' + (e && e.message || e)
      console.error(e)
    }
  }
  // WebGL context restored after a system-level kill (common on iOS):
  // re-run the whole init against the fresh context.
  host.value.addEventListener('cascade:reinit', boot)
  await boot()
})
onUnmounted(() => {
  document.body.classList.remove('cascade-page')
  window.removeEventListener('resize', fit)
  window.removeEventListener('load', fit)
  host.value?.removeEventListener('cascade:reinit', boot)
  if (typeof cleanup === 'function') cleanup()
})
</script>

<template>
  <div ref="host" class="cascade-simulator">
    <canvas class="cascade-canvas" aria-label="Cartan's Cascade 3D moore26 lattice renderer"></canvas>

    <!-- telemetry chip -->
    <div class="cascade-hud" data-hud title="t = physics ticks · mass = parked quanta · wind = bound circulation · phot = free photons · |q| = net charge · core@(x,y,z) = mass centroid · fps = render rate · ms/t = compute time per tick">booting…</div>
    <!-- transient status line under the telemetry chip — empty = hidden -->
    <div class="cascade-status" data-status></div>

    <!-- always-visible collapse toggle -->
    <button class="cascade-uitoggle" data-uitoggle title="Toggle controls" aria-label="Toggle controls">⚙</button>

    <!-- control dock — sits below the canvas, never overlaps it -->
    <div class="cascade-dock">
      <div class="cascade-row">
      <div class="cascade-well cascade-transport" role="group" aria-label="Transport">
        <button data-play  title="Play / pause"      aria-label="Play or pause">⏸</button>
        <button data-step  title="Step one tick"      aria-label="Step one tick">⏭</button>
        <button data-reset title="Reset the scenario"  aria-label="Reset">⟲</button>
        <button data-lump  title="Lump tool — arm, then click the lattice to drop a wound knot"
                aria-label="Wound lump placement tool" aria-pressed="false">⌖</button>
        <button data-tube  title="Tube tool — arm, then click to paint a saturated flux string (watch it fracture)"
                aria-label="Flux tube paint tool" aria-pressed="false">—</button>
        <button data-spin class="on" aria-pressed="true"
                title="Auto-rotate"                   aria-label="Toggle auto-rotate">⟳</button>
        <!-- orientation gizmo — rotates with the camera, double-click/tap resets -->
        <canvas class="cascade-gizmo" data-gizmo width="96" height="96"
                title="Orientation — double-click to reset view" aria-label="Orientation gizmo, double-click to reset view"></canvas>
      </div>

      <div class="cascade-well cascade-switches" role="group" aria-label="Flux switches">
        <button data-drive class="on" aria-pressed="true"
                title="Convergent feed — 26 photon spokes pour at the core"
                aria-label="Toggle convergent drive">☀ feed</button>
        <button data-beam aria-pressed="false"
                title="Photon beam — +x stream; the probe bombardment"
                aria-label="Toggle photon beam">➤ beam</button>
      </div>

      <div class="cascade-well cascade-selects">
        <label class="cascade-field"><span>Focus</span><select data-preset aria-label="Camera focus preset" title="Camera focus preset">
          <option value="full"    selected>Full lattice</option>
          <option value="core">Core close-up</option>
          <option value="slab">Mid-plane slab</option>
          <option value="side">Side profile</option>
          <option value="lattice">Single plane</option>
        </select></label>
        <label class="cascade-field"><span>View</span><select data-colormode aria-label="Data view" title="Data view">
          <option value="4" selected>composite</option>
          <option value="0">structure</option>
          <option value="1">wake</option>
          <option value="2">thermal</option>
          <option value="3">pol</option>
        </select></label>
      </div>
      </div>

      <div class="cascade-row">
      <button class="cascade-accbtn" data-tune aria-expanded="false" title="Tuning sliders">Tuning ▾</button>

      <div class="cascade-well cascade-sliders">
        <label>Slice <input type="range" data-zcenter min="0" max="43" step="1" value="22"><output>22</output></label>
        <label>Width <input type="range" data-zthick  min="1" max="44" step="1" value="44"><output>44</output></label>
        <label>Size  <input type="range" data-size    min="20" max="150" step="1" value="55"><output>55</output></label>
        <label>Speed <input type="range" data-speed   min="1" max="120" step="1" value="20"><output>20</output></label>
        <label>Q≥    <input type="range" data-qmin    min="1" max="120" step="1" value="1"><output>1</output></label>
        <label>Zoom  <input type="range" data-zoom    min="8" max="200" step="1" value="25"><output>25</output></label>
      </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Same soft-UI skin as Hopf's Loom: raised beveled controls seated in
   inset wells on a deep drop-shadowed panel. */
.cascade-simulator {
  color-scheme: dark;
  --cascade-panel: linear-gradient(180deg, #141c30, #0a101d);
  --cascade-well: #060a13;
  --cascade-btn-top: #22314f;
  --cascade-btn-bot: #131c30;
  --cascade-bevel-light: rgba(160, 200, 255, 0.16);
  --cascade-bevel-dark: rgba(0, 0, 0, 0.65);
  --cascade-accent: #fda;
  --cascade-muted: #9ef;
  position: relative;
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--tool-top, 76px) - 8px);
  height: calc(100svh - var(--tool-top, 76px) - 8px);
  min-height: 520px;
  max-width: 1200px;
  margin: 0 auto;
  background: #05050d;
  border-radius: 10px;
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
}
.cascade-canvas {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: block;
  touch-action: none;
}

.cascade-hud {
  position: absolute;
  top: 8px;
  left: 8px;
  max-width: calc(100% - 64px);
  padding: 4px 10px;
  font: 11px/1.5 monospace;
  color: var(--cascade-accent);
  background: rgba(8, 10, 20, 0.6);
  border: 1px solid var(--cascade-bevel-light);
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45), inset 0 1px 0 var(--cascade-bevel-light);
  pointer-events: none;
  text-shadow: 0 0 4px #000;
  overflow-wrap: anywhere;
  z-index: 3;
}

.cascade-status {
  position: absolute;
  top: 38px;
  left: 8px;
  max-width: calc(100% - 64px);
  padding: 3px 9px;
  font: 10px/1.4 monospace;
  color: var(--cascade-muted);
  background: rgba(8, 10, 20, 0.45);
  border: 1px solid rgba(160, 200, 255, 0.12);
  border-radius: 7px;
  pointer-events: none;
  text-shadow: 0 0 4px #000;
  z-index: 3;
}
.cascade-status:empty { display: none; }

.cascade-uitoggle {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 34px;
  height: 34px;
  font: 14px monospace;
  color: var(--cascade-muted);
  background: var(--cascade-panel);
  border: 1px solid var(--cascade-bevel-dark);
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5), inset 0 1px 0 var(--cascade-bevel-light);
  cursor: pointer;
  z-index: 3;
}
.cascade-uitoggle:active { box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.6); transform: scale(0.96); }
.cascade-simulator.dock-hidden .cascade-dock { display: none; }

.cascade-gizmo {
  width: 40px;
  height: 40px;
  flex: none;
  border-radius: 50%;
  background: rgba(8, 10, 20, 0.6);
  border: 1px solid var(--cascade-bevel-light);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45), inset 0 1px 0 var(--cascade-bevel-light);
  cursor: pointer;
  touch-action: none;
  z-index: 3;
}

.cascade-dock {
  flex: none;
  align-self: center;
  margin: 6px auto;
  max-width: calc(100% - 16px);
  padding: 7px 10px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px 10px;
  align-items: center;
  background: var(--cascade-panel);
  border: 1px solid var(--cascade-bevel-dark);
  border-radius: 14px;
  box-shadow:
    0 14px 34px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 var(--cascade-bevel-light);
  backdrop-filter: blur(8px);
  z-index: 3;
}

.cascade-well {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  background: var(--cascade-well);
  border: 1px solid var(--cascade-bevel-dark);
  border-radius: 10px;
  box-shadow:
    inset 0 2px 7px rgba(0, 0, 0, 0.65),
    0 1px 0 rgba(160, 200, 255, 0.07);
}
.cascade-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 10px; align-items: center; }
.cascade-transport, .cascade-switches { gap: 4px; }
.cascade-sliders { flex-wrap: wrap; justify-content: center; gap: 4px 12px; }

.cascade-transport button,
.cascade-switches button,
.cascade-accbtn,
.cascade-dock select {
  user-select: none;
  -webkit-user-select: none;
  min-width: 34px;
  min-height: 34px;
  padding: 0 10px;
  font: 13px monospace;
  color: var(--cascade-muted);
  background: linear-gradient(180deg, var(--cascade-btn-top), var(--cascade-btn-bot));
  border: 1px solid var(--cascade-bevel-dark);
  border-radius: 7px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5), inset 0 1px 0 var(--cascade-bevel-light);
  cursor: pointer;
}
.cascade-transport button:active,
.cascade-switches button:active {
  transform: scale(0.94);
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.6);
}
.cascade-transport button.on,
.cascade-switches button.on {
  color: var(--cascade-accent);
  border-color: rgba(255, 221, 170, 0.45);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5), inset 0 1px 0 var(--cascade-bevel-light),
    0 0 9px rgba(255, 221, 170, 0.3);
}
.cascade-transport button.armed {
  color: #1c1404;
  background: var(--cascade-accent);
  border-color: rgba(255, 221, 170, 0.8);
  box-shadow: 0 0 14px rgba(255, 221, 170, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.cascade-transport button:disabled { opacity: 0.35; cursor: default; }

.cascade-dock:not(.tune-open) .cascade-sliders { display: none; }
.cascade-accbtn {
  min-width: 34px;
  min-height: 34px;
  padding: 0 12px;
  font: 11px monospace;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--cascade-muted);
  background: linear-gradient(180deg, var(--cascade-btn-top), var(--cascade-btn-bot));
  border: 1px solid var(--cascade-bevel-dark);
  border-radius: 7px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5), inset 0 1px 0 var(--cascade-bevel-light);
  cursor: pointer;
}
.cascade-accbtn:active { transform: scale(0.94); box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.6); }
.cascade-dock.tune-open .cascade-accbtn {
  color: var(--cascade-accent);
  border-color: rgba(255, 221, 170, 0.45);
}

.cascade-selects { flex-direction: row; }
.cascade-field {
  display: flex;
  align-items: center;
  gap: 6px;
  font: 11px monospace;
  color: var(--cascade-muted);
  white-space: nowrap;
}
.cascade-field > span {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.75;
}
.cascade-dock select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 22px;
  font-size: 11px;
  min-height: 30px;
  background-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='6'%3E%3Cpath d='M0 0l4 6 4-6z' fill='%239eefff'/%3E%3C/svg%3E"),
    linear-gradient(180deg, var(--cascade-btn-top), var(--cascade-btn-bot));
  background-repeat: no-repeat;
  background-position: right 8px center, 0 0;
}
.cascade-dock select option {
  background: #131c30;
  color: var(--cascade-muted);
}

.cascade-sliders label {
  display: flex;
  align-items: center;
  gap: 5px;
  font: 11px monospace;
  color: var(--cascade-muted);
  white-space: nowrap;
}
.cascade-sliders input[type='range'] {
  -webkit-appearance: none;
  appearance: none;
  width: 70px;
  height: 22px;
  background: transparent;
  cursor: pointer;
}
.cascade-sliders input[type='range']::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(180deg, #04070d, #0d1524);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.8), 0 1px 0 var(--cascade-bevel-light);
}
.cascade-sliders input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  margin-top: -5px;
  border-radius: 50%;
  background: linear-gradient(180deg, var(--cascade-btn-top), var(--cascade-btn-bot));
  border: 1px solid var(--cascade-bevel-dark);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6), inset 0 1px 0 var(--cascade-bevel-light);
}
.cascade-sliders input[type='range']:active::-webkit-slider-thumb {
  box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.6), 0 0 8px rgba(255, 221, 170, 0.35);
  border-color: rgba(255, 221, 170, 0.45);
}
.cascade-sliders input[type='range']::-moz-range-track {
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(180deg, #04070d, #0d1524);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.8);
}
.cascade-sliders input[type='range']::-moz-range-thumb {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: linear-gradient(180deg, var(--cascade-btn-top), var(--cascade-btn-bot));
  border: 1px solid var(--cascade-bevel-dark);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6), inset 0 1px 0 var(--cascade-bevel-light);
}
.cascade-sliders output {
  min-width: 2ch;
  color: var(--cascade-accent);
  opacity: 0.9;
}

@media (pointer: coarse) {
  .cascade-transport button, .cascade-switches button, .cascade-dock select, .cascade-uitoggle {
    min-width: 44px;
    min-height: 44px;
  }
  .cascade-sliders input[type='range'] { width: 90px; height: 40px; }
  .cascade-sliders input[type='range']::-webkit-slider-thumb { margin-top: -5px; }
}

@media (pointer: coarse), (max-width: 820px) {
  .cascade-simulator {
    min-height: 0;
    max-width: none;
    border-radius: 0;
  }
  .cascade-dock {
    margin-bottom: calc(4px + env(safe-area-inset-bottom, 0px));
    max-width: calc(100% - 8px);
  }
}

@media (max-height: 640px) {
  .cascade-simulator { min-height: 0; }
}
</style>

<style>
/* Suppress VitePress chrome that overlays or displaces the simulator. */
.cascade-page .VPDocFooter,
.cascade-page .VPBackToTop,
.cascade-page .VPLocalNav,
.cascade-page .aside-top {
  display: none !important;
}
html:has(.cascade-simulator) {
  overscroll-behavior: none;
}
/* .VPNav is sticky (in-flow) on this theme, so VitePress's
   padding-top: var(--vp-nav-height) — meant to clear a fixed nav —
   is a dead band below the navbar. Reclaim it at all widths. */
.cascade-page .VPContent { padding-top: 0 !important; }
.cascade-page .cascade-doc {
  max-width: 768px;
  margin: 0 auto;
  padding: 24px 24px 72px;
}
</style>
