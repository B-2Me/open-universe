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
  document.body.classList.add('ember-page')
  fit()
  requestAnimationFrame(fit)
  window.addEventListener('resize', fit)
  window.addEventListener('load', fit)
  const hud = host.value?.querySelector('[data-hud]')
  try {
    var { initEmberSimulator } = await import('../ember/main.js')
  } catch (e) {
    if (hud) hud.textContent = 'module load failed: ' + (e && e.message || e)
    return
  }
  boot = async () => {
    if (typeof cleanup === 'function') cleanup()
    try {
      cleanup = await initEmberSimulator(host.value)
    } catch (e) {
      if (hud) hud.textContent = 'ERR ' + (e && e.message || e)
      console.error(e)
    }
  }
  // WebGL context restored after a system-level kill (common on iOS):
  // re-run the whole init against the fresh context.
  host.value.addEventListener('ember:reinit', boot)
  await boot()
})
onUnmounted(() => {
  document.body.classList.remove('ember-page')
  window.removeEventListener('resize', fit)
  window.removeEventListener('load', fit)
  host.value?.removeEventListener('ember:reinit', boot)
  if (typeof cleanup === 'function') cleanup()
})
</script>

<template>
  <div ref="host" class="ember-simulator">
    <canvas class="ember-canvas" aria-label="Yarkovsky's Ember 3D friction lattice renderer"></canvas>

    <!-- telemetry chip -->
    <div class="ember-hud" data-hud title="t = physics ticks · ember = parked rest-mass quanta · flux = moving quanta · core@(x,y,z) = ember's center of mass · fps = render rate · ms/t = compute time per tick">booting…</div>
    <!-- transient status line under the telemetry chip — empty = hidden -->
    <div class="ember-status" data-status></div>

    <!-- always-visible collapse toggle -->
    <button class="ember-uitoggle" data-uitoggle title="Toggle controls" aria-label="Toggle controls">⚙</button>

    <!-- control dock — sits below the canvas, never overlaps it -->
    <div class="ember-dock">
      <div class="ember-well ember-transport" role="group" aria-label="Transport">
        <button data-play  title="Play / pause"      aria-label="Play or pause">⏸</button>
        <button data-step  title="Step one tick"      aria-label="Step one tick">⏭</button>
        <button data-reset title="Clear the lattice"  aria-label="Reset">⟲</button>
        <button data-lump  title="Cold-rock tool — arm, then click the lattice to drop a frozen lump"
                aria-label="Cold rock placement tool" aria-pressed="false">⌖</button>
        <button data-spin class="on" aria-pressed="true"
                title="Auto-rotate"                   aria-label="Toggle auto-rotate">⟳</button>
        <button data-snap  title="Snapshot state"     aria-label="Save snapshot">⧉</button>
        <button data-unsnap title="Restore snapshot"  aria-label="Restore snapshot" disabled>⤺</button>
        <!-- orientation gizmo — rotates with the camera, double-click/tap resets -->
        <canvas class="ember-gizmo" data-gizmo width="96" height="96"
                title="Orientation — double-click to reset view" aria-label="Orientation gizmo, double-click to reset view"></canvas>
      </div>

      <div class="ember-well ember-switches" role="group" aria-label="Flux switches">
        <button data-drive class="on" aria-pressed="true"
                title="Convergent feed — 18 spokes pour flux at the core"
                aria-label="Toggle convergent drive">☀ feed</button>
        <button data-beam aria-pressed="false"
                title="Carrier beam — +x flux only; illuminates and pushes"
                aria-label="Toggle carrier beam">➤ beam</button>
      </div>

      <div class="ember-well ember-selects">
        <label class="ember-field"><span>Focus</span><select data-preset aria-label="Camera focus preset" title="Camera focus preset">
          <option value="full"    selected>Full lattice</option>
          <option value="core">Core close-up</option>
          <option value="slab">Mid-plane slab</option>
          <option value="side">Side profile</option>
          <option value="lattice">Single plane</option>
        </select></label>
        <label class="ember-field"><span>View</span><select data-colormode aria-label="Data view" title="Data view">
          <option value="0" selected>ember</option>
          <option value="1">heat</option>
          <option value="2">flux</option>
          <option value="3">macro</option>
        </select></label>
      </div>

      <button class="ember-accbtn" data-tune aria-expanded="false" title="Tuning sliders">Tuning ▾</button>

      <div class="ember-well ember-sliders">
        <label>Slice <input type="range" data-zcenter min="0" max="43" step="1" value="22"><output>22</output></label>
        <label>Width <input type="range" data-zthick  min="1" max="44" step="1" value="44"><output>44</output></label>
        <label>Size  <input type="range" data-size    min="20" max="150" step="1" value="55"><output>55</output></label>
        <label>Speed <input type="range" data-speed   min="1" max="120" step="1" value="20"><output>20</output></label>
        <label>Q≥    <input type="range" data-qmin    min="1" max="120" step="1" value="1"><output>1</output></label>
        <label>Zoom  <input type="range" data-zoom    min="8" max="200" step="1" value="25"><output>25</output></label>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Same soft-UI skin as Hopf's Loom: raised beveled controls seated in
   inset wells on a deep drop-shadowed panel. */
.ember-simulator {
  color-scheme: dark;
  --ember-panel: linear-gradient(180deg, #141c30, #0a101d);
  --ember-well: #060a13;
  --ember-btn-top: #22314f;
  --ember-btn-bot: #131c30;
  --ember-bevel-light: rgba(160, 200, 255, 0.16);
  --ember-bevel-dark: rgba(0, 0, 0, 0.65);
  --ember-accent: #fda;
  --ember-muted: #9ef;
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
.ember-canvas {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: block;
  touch-action: none;
}

.ember-hud {
  position: absolute;
  top: 8px;
  left: 8px;
  max-width: calc(100% - 64px);
  padding: 4px 10px;
  font: 11px/1.5 monospace;
  color: var(--ember-accent);
  background: rgba(8, 10, 20, 0.6);
  border: 1px solid var(--ember-bevel-light);
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45), inset 0 1px 0 var(--ember-bevel-light);
  pointer-events: none;
  text-shadow: 0 0 4px #000;
  overflow-wrap: anywhere;
  z-index: 3;
}

.ember-status {
  position: absolute;
  top: 38px;
  left: 8px;
  max-width: calc(100% - 64px);
  padding: 3px 9px;
  font: 10px/1.4 monospace;
  color: var(--ember-muted);
  background: rgba(8, 10, 20, 0.45);
  border: 1px solid rgba(160, 200, 255, 0.12);
  border-radius: 7px;
  pointer-events: none;
  text-shadow: 0 0 4px #000;
  z-index: 3;
}
.ember-status:empty { display: none; }

.ember-uitoggle {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 34px;
  height: 34px;
  font: 14px monospace;
  color: var(--ember-muted);
  background: var(--ember-panel);
  border: 1px solid var(--ember-bevel-dark);
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5), inset 0 1px 0 var(--ember-bevel-light);
  cursor: pointer;
  z-index: 3;
}
.ember-uitoggle:active { box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.6); transform: scale(0.96); }
.ember-simulator.dock-hidden .ember-dock { display: none; }

.ember-gizmo {
  width: 40px;
  height: 40px;
  flex: none;
  border-radius: 50%;
  background: rgba(8, 10, 20, 0.6);
  border: 1px solid var(--ember-bevel-light);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45), inset 0 1px 0 var(--ember-bevel-light);
  cursor: pointer;
  touch-action: none;
  z-index: 3;
}

.ember-dock {
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
  background: var(--ember-panel);
  border: 1px solid var(--ember-bevel-dark);
  border-radius: 14px;
  box-shadow:
    0 14px 34px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 var(--ember-bevel-light);
  backdrop-filter: blur(8px);
  z-index: 3;
}

.ember-well {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  background: var(--ember-well);
  border: 1px solid var(--ember-bevel-dark);
  border-radius: 10px;
  box-shadow:
    inset 0 2px 7px rgba(0, 0, 0, 0.65),
    0 1px 0 rgba(160, 200, 255, 0.07);
}
.ember-transport, .ember-switches { gap: 4px; }
.ember-sliders { flex-wrap: wrap; justify-content: center; gap: 4px 12px; }

.ember-transport button,
.ember-switches button,
.ember-dock select {
  min-width: 34px;
  min-height: 34px;
  padding: 0 10px;
  font: 13px monospace;
  color: var(--ember-muted);
  background: linear-gradient(180deg, var(--ember-btn-top), var(--ember-btn-bot));
  border: 1px solid var(--ember-bevel-dark);
  border-radius: 7px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5), inset 0 1px 0 var(--ember-bevel-light);
  cursor: pointer;
}
.ember-transport button:active,
.ember-switches button:active {
  transform: scale(0.94);
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.6);
}
.ember-transport button.on,
.ember-switches button.on {
  color: var(--ember-accent);
  border-color: rgba(255, 221, 170, 0.45);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5), inset 0 1px 0 var(--ember-bevel-light),
    0 0 9px rgba(255, 221, 170, 0.3);
}
.ember-transport button.armed {
  color: #1c1404;
  background: var(--ember-accent);
  border-color: rgba(255, 221, 170, 0.8);
  box-shadow: 0 0 14px rgba(255, 221, 170, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.ember-transport button:disabled { opacity: 0.35; cursor: default; }

.ember-dock:not(.tune-open) .ember-sliders { display: none; }
.ember-accbtn {
  min-width: 34px;
  min-height: 34px;
  padding: 0 12px;
  font: 11px monospace;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ember-muted);
  background: linear-gradient(180deg, var(--ember-btn-top), var(--ember-btn-bot));
  border: 1px solid var(--ember-bevel-dark);
  border-radius: 7px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5), inset 0 1px 0 var(--ember-bevel-light);
  cursor: pointer;
}
.ember-accbtn:active { transform: scale(0.94); box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.6); }
.ember-dock.tune-open .ember-accbtn {
  color: var(--ember-accent);
  border-color: rgba(255, 221, 170, 0.45);
}

.ember-selects { flex-direction: row; }
.ember-field {
  display: flex;
  align-items: center;
  gap: 6px;
  font: 11px monospace;
  color: var(--ember-muted);
  white-space: nowrap;
}
.ember-field > span {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.75;
}
.ember-dock select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 22px;
  font-size: 11px;
  min-height: 30px;
  background-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='6'%3E%3Cpath d='M0 0l4 6 4-6z' fill='%239eefff'/%3E%3C/svg%3E"),
    linear-gradient(180deg, var(--ember-btn-top), var(--ember-btn-bot));
  background-repeat: no-repeat;
  background-position: right 8px center, 0 0;
}
.ember-dock select option {
  background: #131c30;
  color: var(--ember-muted);
}

.ember-sliders label {
  display: flex;
  align-items: center;
  gap: 5px;
  font: 11px monospace;
  color: var(--ember-muted);
  white-space: nowrap;
}
.ember-sliders input[type='range'] {
  -webkit-appearance: none;
  appearance: none;
  width: 70px;
  height: 22px;
  background: transparent;
  cursor: pointer;
}
.ember-sliders input[type='range']::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(180deg, #04070d, #0d1524);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.8), 0 1px 0 var(--ember-bevel-light);
}
.ember-sliders input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  margin-top: -5px;
  border-radius: 50%;
  background: linear-gradient(180deg, var(--ember-btn-top), var(--ember-btn-bot));
  border: 1px solid var(--ember-bevel-dark);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6), inset 0 1px 0 var(--ember-bevel-light);
}
.ember-sliders input[type='range']:active::-webkit-slider-thumb {
  box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.6), 0 0 8px rgba(255, 221, 170, 0.35);
  border-color: rgba(255, 221, 170, 0.45);
}
.ember-sliders input[type='range']::-moz-range-track {
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(180deg, #04070d, #0d1524);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.8);
}
.ember-sliders input[type='range']::-moz-range-thumb {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: linear-gradient(180deg, var(--ember-btn-top), var(--ember-btn-bot));
  border: 1px solid var(--ember-bevel-dark);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6), inset 0 1px 0 var(--ember-bevel-light);
}
.ember-sliders output {
  min-width: 2ch;
  color: var(--ember-accent);
  opacity: 0.9;
}

@media (pointer: coarse) {
  .ember-transport button, .ember-switches button, .ember-dock select, .ember-uitoggle {
    min-width: 44px;
    min-height: 44px;
  }
  .ember-sliders input[type='range'] { width: 90px; height: 40px; }
  .ember-sliders input[type='range']::-webkit-slider-thumb { margin-top: -5px; }
}

@media (pointer: coarse), (max-width: 820px) {
  .ember-simulator {
    min-height: 0;
    max-width: none;
    border-radius: 0;
  }
  .ember-dock {
    margin-bottom: calc(4px + env(safe-area-inset-bottom, 0px));
    max-width: calc(100% - 8px);
  }
}

@media (max-height: 640px) {
  .ember-simulator { min-height: 0; }
}
</style>

<style>
/* Suppress VitePress chrome that overlays or displaces the simulator. */
.ember-page .VPDocFooter,
.ember-page .VPBackToTop,
.ember-page .VPLocalNav,
.ember-page .aside-top {
  display: none !important;
}
html:has(.ember-simulator) {
  overscroll-behavior: none;
}
@media (pointer: coarse), (max-width: 820px) {
  .ember-page .VPContent { padding-top: var(--vp-nav-height, 64px) !important; }
}
.ember-page .ember-doc {
  max-width: 768px;
  margin: 0 auto;
  padding: 24px 24px 72px;
}
</style>
