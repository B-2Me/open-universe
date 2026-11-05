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

    <!-- top-left overlay stack — HUD, status and help card share one
         column so a wrapping line can never overlap a sibling -->
    <div class="cascade-overlay-tl">
      <div class="cascade-hud" data-hud title="t = physics ticks · mass = parked quanta · wind = bound circulation · pkt = free quanta · |q| = net charge · core@(x,y,z) = mass centroid · fps = render rate · ms/t = compute time per tick">booting…</div>
      <!-- transient status line under the telemetry chip — empty = hidden -->
      <div class="cascade-status" data-status></div>
      <!-- ? help card — floats over the canvas until dismissed -->
      <div class="cascade-card" data-card hidden>
        <button class="cascade-card-x" data-card-x aria-label="Close">×</button>
        <div class="cascade-card-title" data-card-title></div>
        <div class="cascade-card-body" data-card-body></div>
      </div>
    </div>

    <!-- always-visible collapse toggle -->
    <button class="cascade-uitoggle" data-uitoggle title="Toggle controls" aria-label="Toggle controls">⚙</button>

    <!-- zoom lens + orientation gizmo — floating viewport overlays -->
    <canvas class="cascade-zoomlens" data-zoomlens width="128" height="128"
            title="Zoom lens — drag up/down to zoom; double-click resets"
            aria-label="Zoom lens — drag to zoom, double-click to reset"></canvas>
    <canvas class="cascade-gizmo" data-gizmo width="128" height="128"
            title="Orientation — double-click to reset view" aria-label="Orientation gizmo, double-click to reset view"></canvas>

    <!-- control dock — sits below the canvas, never overlaps it -->
    <div class="cascade-dock">
      <div class="cascade-well cascade-transport" role="group" aria-label="Controls">
        <div class="cascade-grp grp-time">
          <div class="cascade-grp-row">
            <em>time <button class="cascade-help" data-help="grp-time" aria-label="About the time controls">?</button></em>
            <button data-play  class="tog on" title="Play / pause"      aria-label="Play or pause"><span class="g">⏸</span><span class="l">play</span></button>
            <button data-step  title="Step one tick"      aria-label="Step one tick"><span class="g">⏭</span><span class="l">step</span></button>
            <button data-reset title="Reset the scenario"  aria-label="Reset"><span class="g">⟲</span><span class="l">reset</span></button>
          </div>
        </div>
        <div class="cascade-grp grp-ops">
          <div class="cascade-grp-row">
            <em>ops <button class="cascade-help" data-help="grp-ops" aria-label="About the session ops">?</button></em>
            <button data-spin class="tog on" aria-pressed="true"
                    title="Auto-rotate"                   aria-label="Toggle auto-rotate"><span class="g">⟳</span><span class="l">orbit</span></button>
          </div>
        </div>
        <div class="cascade-grp-line">
        <div class="cascade-grp grp-inject">
          <div class="cascade-grp-row">
            <em>inject <button class="cascade-help" data-help="grp-inject" aria-label="About the injection tools">?</button></em>
            <button data-drive class="tog on" aria-pressed="true"
                    title="Convergent feed — 26 quantum spokes pour at the core"
                    aria-label="Toggle convergent drive"><span class="g">☀</span><span class="l">feed</span></button>
            <button data-beam  class="tog" aria-pressed="false"
                    title="Quantum beam — +x stream; the probe bombardment"
                    aria-label="Toggle quantum beam"><span class="g">➤</span><span class="l">beam</span></button>
            <button data-lump  title="Lump tool — arm, then click the lattice to drop a wound knot"
                    aria-label="Wound lump placement tool" aria-pressed="false"><span class="g">⌖</span><span class="l">lump</span></button>
            <button data-tube  title="Tube tool — arm, then click to paint a saturated flux string (watch it fracture)"
                    aria-label="Flux tube paint tool" aria-pressed="false"><span class="g">—</span><span class="l">tube</span></button>
          </div>
        </div>
        </div>
        <div class="cascade-grp grp-presets">
          <div class="cascade-grp-row">
            <em>presets</em>
            <label class="cascade-field"><button class="cascade-flab" type="button" data-help="focus" aria-label="About Focus" title="About Focus"><i>◎</i><i>Focus</i></button><select data-preset aria-label="Camera focus preset" title="Camera focus preset">
              <option value="full"    selected>Full lattice</option>
              <option value="core">Core close-up</option>
              <option value="slab">Mid-plane slab</option>
              <option value="side">Side profile</option>
              <option value="lattice">Single plane</option>
            </select></label>
            <label class="cascade-field"><button class="cascade-flab" type="button" data-help="view" aria-label="About View" title="About View"><i>◐</i><i>View</i></button><select data-colormode aria-label="Data view" title="Data view">
              <option value="4" selected>composite</option>
              <option value="0">structure</option>
              <option value="1">wake</option>
              <option value="2">thermal</option>
              <option value="3">pol</option>
            </select></label>
            <button class="cascade-accbtn" data-tune aria-expanded="false" title="Tuning sliders">▤ Tuning ▾</button>
          </div>
        </div>
      </div>

      <div class="cascade-well cascade-sliders">
        <label title="Cut position along the slice axis — Shift+scroll scrubs it"><button class="cascade-shelp" type="button" data-help="slice" aria-label="About Slice" title="About Slice">Slice</button><input type="range" data-zcenter min="0" max="43" step="1" value="22"><output>22</output></label>
        <label title="Slab thickness in cells — at max the whole volume shows"><button class="cascade-shelp" type="button" data-help="slab" aria-label="About Slab" title="About Slab">Width</button><input type="range" data-zthick  min="1" max="44" step="1" value="44"><output>44</output></label>
        <label><button class="cascade-shelp" type="button" data-help="size" aria-label="About Size" title="About Size">Size</button><input type="range" data-size    min="20" max="150" step="1" value="55"><output>55</output></label>
        <label><button class="cascade-shelp" type="button" data-help="speed" aria-label="About Speed" title="About Speed">Speed</button><input type="range" data-speed   min="1" max="120" step="1" value="20"><output>20</output></label>
        <label><button class="cascade-shelp" type="button" data-help="qmin" aria-label="About Q≥" title="About Q≥">Q≥</button><input type="range" data-qmin    min="1" max="120" step="1" value="1"><output>1</output></label>
        <label><button class="cascade-shelp" type="button" data-help="zoom" aria-label="About Zoom" title="About Zoom">Zoom</button><input type="range" data-zoom    min="8" max="200" step="1" value="25"><output>25</output></label>
      </div>
    </div>
  </div>
</template>


<style scoped>
/* Wake/Mill-style soft-UI skin: raised beveled controls seated in
   inset wells on a deep drop-shadowed panel — the Mill dock pass. */
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
  background: #04060c;
  border-radius: 12px;
  overflow: hidden;
}
.cascade-canvas { flex: 1 1 auto; min-height: 0; width: 100%; display: block; touch-action: none; }

/* top-left overlay stack — HUD, status, help card share one column */
.cascade-overlay-tl {
  position: absolute; top: 10px; left: 10px; z-index: 4;
  display: flex; flex-direction: column; gap: 6px; align-items: flex-start;
  pointer-events: none;
}
.cascade-overlay-tl > * { pointer-events: auto; }
.cascade-hud {
  font: 11px/1.45 ui-monospace, monospace;
  color: var(--cascade-muted);
  background: rgba(8, 10, 20, 0.6);
  border: 1px solid var(--cascade-bevel-dark);
  border-radius: 8px; padding: 4px 8px; white-space: nowrap;
}
.cascade-status {
  font: 11px/1.4 ui-monospace, monospace; color: var(--cascade-accent);
  background: rgba(8, 10, 20, 0.6); border-radius: 8px; padding: 3px 8px;
}
.cascade-status:empty { display: none; }

/* help card — floats over the canvas until dismissed */
.cascade-card {
  position: relative; max-width: 300px;
  font: 12px/1.5 system-ui, sans-serif; color: #cfe0ff;
  background: rgba(10, 14, 26, 0.92); border: 1px solid var(--cascade-bevel-light);
  border-radius: 10px; padding: 10px 12px; box-shadow: 0 10px 28px rgba(0,0,0,0.55);
}
.cascade-card-x {
  position: absolute; top: 4px; right: 6px; width: 20px; height: 20px;
  font: 14px/18px monospace; color: var(--cascade-muted);
  background: none; border: none; cursor: pointer;
}
.cascade-card-title { font-weight: 700; color: var(--cascade-accent); margin-bottom: 4px; }

/* floating viewport overlays — lens + gizmo bottom-right */
.cascade-zoomlens, .cascade-gizmo {
  position: absolute; bottom: 10px; flex: none; border-radius: 50%;
  background: rgba(8, 10, 20, 0.6); touch-action: none; z-index: 4;
}
.cascade-zoomlens { right: 10px; width: 56px; height: 56px; cursor: ns-resize; opacity: 0.9; }
.cascade-gizmo {
  right: 76px; width: 64px; height: 64px;
  border: 1px solid var(--cascade-bevel-light);
  box-shadow: 0 4px 14px rgba(0,0,0,0.45), inset 0 1px 0 var(--cascade-bevel-light);
  cursor: pointer; z-index: 3;
}
.cascade-uitoggle {
  position: absolute; top: 10px; right: 10px; width: 34px; height: 34px;
  font: 14px monospace; color: var(--cascade-muted);
  background: var(--cascade-panel); border: 1px solid var(--cascade-bevel-dark);
  border-radius: 8px; cursor: pointer; z-index: 3;
}
.cascade-simulator.dock-hidden .cascade-dock { display: none; }

/* dock — wells seated on a deep panel */
.cascade-dock {
  flex: none; align-self: center; margin: 6px auto; max-width: calc(100% - 16px);
  padding: 7px 10px; display: flex; flex-wrap: wrap; justify-content: center;
  gap: 6px 10px; align-items: center;
  background: var(--cascade-panel); border: 1px solid var(--cascade-bevel-dark);
  border-radius: 14px;
  box-shadow: 0 14px 34px rgba(0,0,0,0.6), inset 0 1px 0 var(--cascade-bevel-light);
  backdrop-filter: blur(8px); z-index: 3;
}
.cascade-well {
  display: flex; align-items: center; gap: 6px; padding: 3px 8px;
  background: var(--cascade-well); border: 1px solid var(--cascade-bevel-dark);
  border-radius: 10px;
  box-shadow: inset 0 2px 7px rgba(0,0,0,0.65), 0 1px 0 rgba(160,200,255,0.07);
}

/* grp structure — labeled control groups with ? help chips */
.cascade-grp { display: flex; align-items: center; }
.cascade-grp-row { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.cascade-grp-line { display: contents; }
.cascade-grp em {
  font: 600 9px/1 ui-monospace, monospace; font-style: normal; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--cascade-muted); margin-right: 2px;
  display: inline-flex; align-items: center; gap: 3px;
}
.cascade-help {
  width: 14px; height: 14px; font: 700 9px/14px monospace; text-align: center;
  color: var(--cascade-muted); background: var(--cascade-btn-top);
  border: 1px solid var(--cascade-bevel-dark); border-radius: 50%; cursor: pointer;
  padding: 0; vertical-align: middle;
}

/* tog pills — glyph + label, .on fills the accent */
.cascade-transport button, .cascade-dock select, .cascade-flab, .cascade-shelp {
  user-select: none; -webkit-user-select: none;
}
.cascade-transport button {
  display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px;
  font: 11px/1 ui-monospace, monospace; color: #cfe0ff;
  background: linear-gradient(180deg, var(--cascade-btn-top), var(--cascade-btn-bot));
  border: 1px solid var(--cascade-bevel-dark); border-radius: 8px; cursor: pointer;
  box-shadow: 0 2px 6px rgba(0,0,0,0.45), inset 0 1px 0 var(--cascade-bevel-light);
}
.cascade-transport button .g { font-size: 12px; }
.cascade-transport button .l { font-size: 10px; }
.cascade-transport button.tog.on {
  background: linear-gradient(180deg, #4a3410, #2a1e08); color: var(--cascade-accent);
  border-color: rgba(255, 200, 100, 0.3);
}
.cascade-transport button:active { transform: scale(0.96); }

/* field = flab button + select */
.cascade-field { display: inline-flex; align-items: center; gap: 4px; }
.cascade-flab, .cascade-shelp {
  display: inline-flex; align-items: center; gap: 3px; padding: 4px 7px;
  font: 10px/1 ui-monospace, monospace; color: var(--cascade-muted);
  background: var(--cascade-btn-top); border: 1px solid var(--cascade-bevel-dark);
  border-radius: 8px; cursor: pointer;
}
.cascade-flab i { font-style: normal; }
.cascade-flab i:first-child { color: var(--cascade-accent); }
.cascade-dock select {
  font: 10px/1.4 ui-monospace, monospace; color: #cfe0ff;
  background: var(--cascade-btn-top); border: 1px solid var(--cascade-bevel-dark);
  border-radius: 8px; padding: 4px 6px;
}
.cascade-dock select option { background: #0a101d; }

/* accbtn — accordion chips */
.cascade-accbtn {
  display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px;
  font: 10px/1 ui-monospace, monospace; color: var(--cascade-muted);
  background: var(--cascade-btn-top); border: 1px solid var(--cascade-bevel-dark);
  border-radius: 8px; cursor: pointer;
}
.cascade-dock.tune-open .cascade-accbtn { color: var(--cascade-accent); border-color: rgba(255,200,100,0.3); }

/* sliders — shelp labels are ? buttons */
.cascade-sliders { flex-wrap: wrap; justify-content: center; gap: 4px 12px; }
.cascade-sliders label { display: inline-flex; align-items: center; gap: 5px; font: 10px/1 ui-monospace, monospace; }
.cascade-sliders input[type=range] { width: 90px; accent-color: var(--cascade-accent); }
.cascade-sliders output { color: var(--cascade-muted); min-width: 2ch; }
.cascade-dock:not(.tune-open) .cascade-sliders { display: none; }

@media (max-width: 700px) {
  .cascade-transport button .l { display: none; }
  .cascade-sliders input[type=range] { width: 64px; }
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
