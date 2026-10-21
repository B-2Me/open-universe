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
  document.body.classList.add('loom-page')
  fit()
  requestAnimationFrame(fit)
  window.addEventListener('resize', fit)
  window.addEventListener('load', fit)
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
  window.removeEventListener('resize', fit)
  window.removeEventListener('load', fit)
  host.value?.removeEventListener('loom:reinit', boot)
  if (typeof cleanup === 'function') cleanup()
})
</script>

<template>
  <div ref="host" class="loom-simulator">
    <canvas class="loom-canvas" aria-label="Hopf's Loom 3D lattice renderer"></canvas>

    <!-- telemetry chip -->
    <div class="loom-hud" data-hud>booting…</div>
    <!-- transient status line under the telemetry chip — empty = hidden -->
    <div class="loom-status" data-status></div>

    <!-- always-visible collapse toggle -->
    <button class="loom-uitoggle" data-uitoggle title="Toggle controls" aria-label="Toggle controls">⚙</button>

    <!-- control dock — sits below the canvas, never overlaps it -->
    <div class="loom-dock">
      <div class="loom-well loom-transport" role="group" aria-label="Transport">
        <button data-play  title="Play / pause"      aria-label="Play or pause">⏸</button>
        <button data-step  title="Step one tick"      aria-label="Step one tick">⏭</button>
        <button data-reset title="Clear the field"    aria-label="Reset">⟲</button>
        <button data-drive class="on" aria-pressed="true"
                title="Convergent feed — 18 spokes pouring flux into the core"
                aria-label="Toggle convergent drive">☀</button>
        <button data-beam  title="Carrier beam — +x flux that walks a lump"
                aria-label="Toggle carrier beam"      aria-pressed="false">➤</button>
        <button data-ring  title="Vortex tool — arm, then tap the slice plane to inject a circulation ring"
                aria-label="Vortex ring tool"         aria-pressed="false">⌖</button>
        <button data-lump  title="Rock tool — arm, then tap the slice plane to drop a cold lump"
                aria-label="Cold rock tool"           aria-pressed="false">●</button>
        <button data-spin class="on" aria-pressed="true"
                title="Auto-rotate"                   aria-label="Toggle auto-rotate">⟳</button>
        <button data-snap  title="Snapshot state"     aria-label="Save snapshot">⧉</button>
        <button data-unsnap title="Restore snapshot"  aria-label="Restore snapshot" disabled>⤺</button>
        <!-- orientation gizmo — rotates with the camera, double-click/tap resets -->
        <canvas class="loom-gizmo" data-gizmo width="96" height="96"
                title="Orientation — double-click to reset view" aria-label="Orientation gizmo, double-click to reset view"></canvas>
      </div>

      <div class="loom-well loom-selects">
        <label class="loom-field"><span>Focus</span><select data-preset aria-label="Camera focus preset" title="Camera focus preset">
          <option value="full"    selected>Full field</option>
          <option value="side">Side profile</option>
          <option value="equator">Equator slab</option>
          <option value="bore">Top-down</option>
          <option value="core">Core close-up</option>
          <option value="lattice">Lattice plane</option>
        </select></label>
        <label class="loom-field"><span>View</span><select data-colormode aria-label="Data view" title="Data view">
          <option value="0" selected>ember</option>
          <option value="1">heat</option>
          <option value="2">flux</option>
          <option value="3">macro</option>
        </select></label>
        <label class="loom-field"><span>Collide</span><select data-coll aria-label="Collision mode" title="Collision rule variant">
          <option value="0" selected>uniform</option>
          <option value="1">shell-weighted</option>
          <option value="2">forward-bias</option>
        </select></label>
      </div>

      <button class="loom-accbtn" data-tune aria-expanded="false" title="Tuning sliders">Tuning ▾</button>

      <div class="loom-well loom-sliders">
        <label>Slice <input type="range" data-zcenter min="0" max="35" step="1" value="18"><output>18</output></label>
        <label>Width <input type="range" data-zthick  min="1" max="36" step="1" value="36"><output>36</output></label>
        <label>Size  <input type="range" data-size    min="20" max="150" step="1" value="55"><output>55</output></label>
        <label>Q≥    <input type="range" data-qmin    min="1" max="120" step="1" value="1"><output>1</output></label>
        <label>Drag  <input type="range" data-fric    min="0" max="32" step="1" value="8"><output>8</output></label>
        <label>Rad   <input type="range" data-rad     min="0" max="8"  step="1" value="4"><output>4</output></label>
        <label>Speed <input type="range" data-speed   min="1" max="60" step="1" value="20"><output>20</output></label>
        <label>Zoom  <input type="range" data-zoom    min="20" max="300" step="1" value="95"><output>95</output></label>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Wake-style soft-UI skin: raised beveled controls seated in inset
   wells on a deep drop-shadowed panel — background recedes, controls pop. */
.loom-simulator {
  color-scheme: dark;
  --loom-panel: linear-gradient(180deg, #141c30, #0a101d);
  --loom-well: #060a13;
  --loom-btn-top: #22314f;
  --loom-btn-bot: #131c30;
  --loom-bevel-light: rgba(160, 200, 255, 0.16);
  --loom-bevel-dark: rgba(0, 0, 0, 0.65);
  --loom-accent: #7fe;
  --loom-muted: #9ef;
  position: relative;
  display: flex;
  flex-direction: column;
  /* --tool-top is the element's measured document offset (set on mount);
     svh always reserves the browser URL-bar strip, so the dock can't
     slide below the fold when chrome collapses. */
  height: calc(100vh - var(--tool-top, 76px) - 8px);
  height: calc(100svh - var(--tool-top, 76px) - 8px);
  min-height: 520px;
  max-width: 1200px;
  margin: 0 auto;                     /* HUD/⚙ align to the canvas
                                         edges, not the window edges */
  background: #05050d;
  border-radius: 10px;
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
}
.loom-canvas {
  flex: 1;
  min-height: 0;
  width: 100%;
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
  overflow-wrap: anywhere;
  z-index: 3;
}

/* transient status line — sits under the telemetry chip, never competes
   with it. :empty hides it, so clearing text is the whole off-switch. */
.loom-status {
  position: absolute;
  top: 38px;
  left: 8px;
  max-width: calc(100% - 64px);
  padding: 3px 9px;
  font: 10px/1.4 monospace;
  color: var(--loom-muted);
  background: rgba(8, 10, 20, 0.45);
  border: 1px solid rgba(160, 200, 255, 0.12);
  border-radius: 7px;
  pointer-events: none;
  text-shadow: 0 0 4px #000;
  z-index: 3;
}
.loom-status:empty { display: none; }

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

/* orientation gizmo — Blender-style axes chip, seated in the
   transport well */
.loom-gizmo {
  width: 40px;
  height: 40px;
  flex: none;
  border-radius: 50%;
  background: rgba(8, 10, 20, 0.6);
  border: 1px solid var(--loom-bevel-light);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45), inset 0 1px 0 var(--loom-bevel-light);
  cursor: pointer;
  touch-action: none;
  z-index: 3;
}

/* control dock — in-flow below the canvas; wells carve control groups */
.loom-dock {
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
/* armed tool = filled accent — unmistakably different from a passive toggle */
.loom-transport button.armed {
  color: #04141c;
  background: var(--loom-accent);
  border-color: rgba(119, 255, 238, 0.8);
  box-shadow: 0 0 14px rgba(119, 255, 238, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.loom-transport button:disabled { opacity: 0.35; cursor: default; }

/* tuning accordion — sliders stay collapsed until asked for */
.loom-dock:not(.tune-open) .loom-sliders { display: none; }
.loom-accbtn {
  min-width: 34px;
  min-height: 34px;
  padding: 0 12px;
  font: 11px monospace;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--loom-muted);
  background: linear-gradient(180deg, var(--loom-btn-top), var(--loom-btn-bot));
  border: 1px solid var(--loom-bevel-dark);
  border-radius: 7px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5), inset 0 1px 0 var(--loom-bevel-light);
  cursor: pointer;
}
.loom-accbtn:active { transform: scale(0.94); box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.6); }
.loom-dock.tune-open .loom-accbtn {
  color: var(--loom-accent);
  border-color: rgba(119, 255, 238, 0.45);
}

/* selects share one row — a well containing two labeled dropdowns */
.loom-selects { flex-direction: row; }
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
.loom-dock select option {
  background: #131c30;
  color: var(--loom-muted);
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
}

/* mobile + narrow windows: the canvas IS the app — edge to edge. The
   measured --tool-top height already pins the dock inside the viewport;
   the 8px remainder clears the home indicator. */
@media (pointer: coarse), (max-width: 820px) {
  .loom-simulator {
    min-height: 0;
    max-width: none;
    border-radius: 0;
  }
  .loom-dock {
    margin-bottom: calc(6px + env(safe-area-inset-bottom, 0px));
    max-width: calc(100% - 8px);
  }
}

/* short viewports of any kind (wide but landscape-short, split-screen):
   same fit — min-height yields instead of pushing the dock off-screen */
@media (max-height: 640px) {
  .loom-simulator { min-height: 0; }
}
</style>

<style>
/* Suppress VitePress chrome that overlays or displaces the simulator —
   .VPLocalNav is the strip carrying the outline dropdown and the
   "Return to top" button; it sits above the canvas and consumes ~48px
   of the viewport the svh calculation assumed it owned. */
.loom-page .VPDocFooter,
.loom-page .VPBackToTop,
.loom-page .VPLocalNav,
.loom-page .aside-top {
  display: none !important;
}
/* Orbiting/pinch on mobile must not bounce or pull-to-refresh the page. */
html:has(.loom-simulator) {
  overscroll-behavior: none;
}
/* .VPNav is sticky (in-flow) on this theme, so VitePress's
   padding-top: var(--vp-nav-height) — meant to clear a fixed nav —
   is a dead band below the navbar. Reclaim it at all widths. */
.loom-page .VPContent { padding-top: 0 !important; }
/* Page prose: doc typography + article width, same as the rest of the site.
   (layout: page renders raw Content with no .vp-doc wrapper — we add the
   class in loom-demo.md and constrain it here.) */
.loom-page .loom-doc {
  max-width: 768px;
  margin: 0 auto;
  padding: 24px 24px 72px;
}
</style>
