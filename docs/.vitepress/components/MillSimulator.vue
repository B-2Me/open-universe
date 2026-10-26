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
  document.body.classList.add('mill-page')
  fit()
  requestAnimationFrame(fit)
  window.addEventListener('resize', fit)
  window.addEventListener('load', fit)
  const hud = host.value?.querySelector('[data-hud]')
  try {
    var { initMillSimulator } = await import('../mill/main.js')
  } catch (e) {
    if (hud) hud.textContent = 'module load failed: ' + (e && e.message || e)
    return
  }
  boot = async () => {
    if (typeof cleanup === 'function') cleanup()
    try {
      cleanup = await initMillSimulator(host.value)
    } catch (e) {
      if (hud) hud.textContent = 'ERR ' + (e && e.message || e)
      console.error(e)
    }
  }
  // WebGL context restored after a system-level kill (common on iOS):
  // re-run the whole init against the fresh context.
  host.value.addEventListener('mill:reinit', boot)
  await boot()
})
onUnmounted(() => {
  document.body.classList.remove('mill-page')
  window.removeEventListener('resize', fit)
  window.removeEventListener('load', fit)
  host.value?.removeEventListener('mill:reinit', boot)
  if (typeof cleanup === 'function') cleanup()
})
</script>

<template>
  <div ref="host" class="mill-simulator">
    <div class="mill-stage">
      <canvas class="mill-canvas" aria-label="Joule's Mill 3D lattice renderer"></canvas>

      <!-- top-left overlay stack — HUD, status and help card share one
           column so a wrapping line can never overlap a sibling -->
      <div class="mill-overlay-tl">
        <div class="mill-hud" data-hud>booting…</div>
        <!-- transient status line under the telemetry chip — empty = hidden -->
        <div class="mill-status" data-status></div>
        <!-- ? help card — floats over the canvas until dismissed -->
        <div class="mill-card" data-card hidden>
          <button class="mill-card-x" data-card-x aria-label="Close">×</button>
          <div class="mill-card-title" data-card-title></div>
          <div class="mill-card-body" data-card-body></div>
        </div>
      </div>

      <!-- mass-partition sparkline: rest (amber) over flux (violet),
           each strip auto-scaled — the lump's breath made visible -->
      <canvas class="mill-graph" data-graph width="156" height="56"
              title="Mass partition history — rest mass (amber) vs moving flux (violet), last ~240 ticks"></canvas>

      <!-- split-view dressing: center divider + per-pane captions -->
      <div class="mill-divider"></div>
      <div class="mill-panetags"><span data-tagl></span><span data-tagr></span></div>

      <!-- always-visible collapse toggle -->
      <button class="mill-uitoggle" data-uitoggle title="Toggle controls" aria-label="Toggle controls">⚙</button>

      <!-- orientation gizmo — Blender-style viewport overlay, bottom-right;
           rotates with the camera, double-click/tap resets -->
      <canvas class="mill-gizmo" data-gizmo width="96" height="96"
              title="Orientation — double-click to reset view" aria-label="Orientation gizmo, double-click to reset view"></canvas>
    </div>

    <!-- control dock — sits below the canvas, never overlaps it -->
    <div class="mill-dock">
      <div class="mill-well mill-transport" role="group" aria-label="Controls">
        <div class="mill-grp grp-time">
          
          <div class="mill-grp-row">
            <em>time <button class="mill-help" data-help="grp-time" aria-label="About the time controls">?</button></em>
            <button data-play  title="Play / pause"      aria-label="Play or pause"><span class="g">⏸</span><span class="l">play</span></button>
            <button data-step  title="Step one tick"      aria-label="Step one tick"><span class="g">⏭</span><span class="l">step</span></button>
            <button data-reset title="Clear the field"    aria-label="Reset"><span class="g">⟲</span><span class="l">reset</span></button>
          </div>
        </div>
        <div class="mill-grp grp-inject">
          
          <div class="mill-grp-row">
            <em>inject <button class="mill-help" data-help="grp-inject" aria-label="About the injection tools">?</button></em>
            <button data-drive aria-pressed="false"
                    title="Convergent feed — 18 spokes pouring flux into the core"
                    aria-label="Toggle convergent drive"><span class="g">☀</span><span class="l">feed</span></button>
            <button data-beam  title="Photon laser — apertured plane wave on an axial channel; Dir/Ap/OffU/OffV shape it, Phot sets the coupling"
                    aria-label="Toggle photon laser"      aria-pressed="false"><span class="g">➤</span><span class="l">beam</span></button>
            <button data-ring  title="Vortex tool — arm, then tap the slice plane to inject a circulation ring"
                    aria-label="Vortex ring tool"         aria-pressed="false"><span class="g">⌖</span><span class="l">ring</span></button>
            <button data-lump  title="Rock tool — arm, then tap the slice plane to drop a cold lump"
                    aria-label="Cold rock tool"           aria-pressed="false"><span class="g">●</span><span class="l">rock</span></button>
            <button data-pair  title="Antipodal pairs — momentum-honest wind/unwind: rest radiates back-to-back, head-on collisions bind into rest"
                    aria-label="Toggle antipodal pair rules" aria-pressed="false"><span class="g">⇄</span><span class="l">pairs</span></button>
            <button data-binary title="M37 binary preset — drop two lumps a few cells apart to watch mutual-ablation attraction"
                    aria-label="Drop a binary lump pair"><span class="g">⚭</span><span class="l">binary</span></button>
          </div>
        </div>
        <div class="mill-grp grp-ops">
          
          <div class="mill-grp-row">
            <em>ops <button class="mill-help" data-help="grp-ops" aria-label="About the session ops">?</button></em>
            <button data-spin class="on" aria-pressed="true"
                    title="Auto-rotate"                   aria-label="Toggle auto-rotate"><span class="g">⟳</span><span class="l">orbit</span></button>
            <button data-snap  title="Snapshot state"     aria-label="Save snapshot"><span class="g">⧉</span><span class="l">save</span></button>
            <button data-unsnap title="Restore snapshot"  aria-label="Restore snapshot" disabled><span class="g">⤺</span><span class="l">load</span></button>
          </div>
        </div>
        <div class="mill-grp grp-presets">
          
          <div class="mill-grp-row">
            <em>presets</em>
            <label class="mill-field"><span>✦ Scene</span><select data-scene aria-label="Physics scene preset" title="One-click measured regimes — sets flags, seeds, and geometry">
              <option value="" selected>scene…</option>
              <option value="vault">spin vault (rest[18] + Wall 32: M50)</option>
              <option value="wound">wound lump (Lat 16 + ⇄ + ☀)</option>
              <option value="breath">breathing core (☀ + Rad)</option>
              <option value="comet">comet ablation (➤ off-center)</option>
              <option value="porous">porous rim (ramp→255: dissolves)</option>
              <option value="fossil">fossil seal (ramp→2cap: freezes)</option>
              <option value="walled">walled crust (Wall 32 + ☀)</option>
            </select><button class="mill-help" data-help="scene" aria-label="About the selected scene">?</button></label>
            <label class="mill-field"><span>◎ Focus</span><select data-preset aria-label="Camera focus preset" title="Camera focus preset">
              <option value="full"    selected>Full field</option>
              <option value="side">Side profile</option>
              <option value="equator">Equator slab</option>
              <option value="bore">Top-down</option>
              <option value="core">Core close-up</option>
              <option value="lattice">Lattice plane</option>
              <option value="hex">Hex axis (111)</option>
            </select><button class="mill-help" data-help="focus" aria-label="About Focus">?</button></label>
            <label class="mill-field"><span>◐ View</span><select data-colormode aria-label="Data view" title="Data view">
              <option value="0" selected>ember</option>
              <option value="1">heat</option>
              <option value="2">flux</option>
              <option value="3">macro</option>
            </select><button class="mill-help" data-help="colormode" aria-label="About View">?</button></label>
            <button class="mill-accbtn" data-flags aria-expanded="false" title="Flag selects">⚑ Flags ▾</button>
            <button class="mill-accbtn" data-tune aria-expanded="false" title="Tuning sliders">▤ Tuning ▾</button>
          </div>
        </div>
      </div>

      <div class="mill-well mill-selects">
        <label class="mill-field"><span>Collide</span><select data-coll aria-label="Collision mode" title="Collision rule variant">
          <option value="0" selected>uniform</option>
          <option value="1">shell-weighted</option>
          <option value="2">forward-bias</option>
        </select><button class="mill-help" data-help="coll" aria-label="About Collide">?</button></label>
        <label class="mill-field"><span>Phot</span><select data-phot aria-label="Photon coupling" title="Photon coupling — how light interacts with parked mass">
          <option value="0">off</option>
          <option value="1">catalyst</option>
          <option value="2" selected>stimulated</option>
          <option value="3">absorbed</option>
        </select><button class="mill-help" data-help="phot" aria-label="About Phot">?</button></label>
        <label class="mill-field"><span>Rest</span><select data-drest aria-label="Rest channel mode" title="Rest channel — scalar forgets direction; directional parks 'frozen flux' that keeps its channel">
          <option value="0" selected>scalar</option>
          <option value="1">directional</option>
        </select><button class="mill-help" data-help="drest" aria-label="About Rest">?</button></label>
        <label class="mill-field"><span>Curve</span><select data-fcurve aria-label="Capture curve" title="Capture curve — how park probability depends on destination density (M49): flat is the canonical 50% gate; ramps grade it — soft dissolves the lump, steep fossilizes it">
          <option value="0" selected>flat</option>
          <option value="1">ramp→255</option>
          <option value="2">ramp→2cap</option>
        </select><button class="mill-help" data-help="fcurve" aria-label="About Curve">?</button></label>
        <label class="mill-field"><span>Plane</span><select data-axis aria-label="Slice plane" title="Slice plane — which coordinate the Cut/Slab sliders gate on; armed tools inject on this plane">
          <option value="2" selected>xy</option>
          <option value="1">xz</option>
          <option value="0">yz</option>
        </select><button class="mill-help" data-help="axis" aria-label="About Plane">?</button></label>
        <label class="mill-field"><span>Dir</span><select data-bdir aria-label="Beam direction" title="Beam direction — axial channels are the only straight lines on this lattice">
          <option value="+x" selected>+x</option><option value="-x">−x</option>
          <option value="+y">+y</option><option value="-y">−y</option>
          <option value="+z">+z</option><option value="-z">−z</option>
        </select><button class="mill-help" data-help="bdir" aria-label="About Dir">?</button></label>
        <label class="mill-field"><span>Split</span><select data-split aria-label="Split view" title="Split view — two lenses on the same live field: cube|fcc compares coordinate systems, ember|flux compares mass channels">
          <option value="off" selected>off</option>
          <option value="layout">cube | fcc</option>
          <option value="modes">ember | flux</option>
        </select><button class="mill-help" data-help="split" aria-label="About Split">?</button></label>
      </div>

      <div class="mill-well mill-sliders">
        <label title="Cut position along the Plane axis — Shift+scroll on the canvas scrubs it">Cut   <input type="range" data-cut min="0" max="35" step="1" value="18"><output>18</output><button class="mill-help" data-help="cut" aria-label="About Cut">?</button></label>
        <label title="Slab thickness in cells — at max the whole volume shows">Slab  <input type="range" data-slab min="1" max="36" step="1" value="36"><output>36</output><button class="mill-help" data-help="slab" aria-label="About Slab">?</button></label>
        <label>Size  <input type="range" data-size    min="20" max="150" step="1" value="55"><output>55</output><button class="mill-help" data-help="size" aria-label="About Size">?</button></label>
        <label>Q≥    <input type="range" data-qmin    min="1" max="120" step="1" value="1"><output>1</output><button class="mill-help" data-help="qmin" aria-label="About Q≥">?</button></label>
        <label>Drag  <input type="range" data-fric    min="0" max="32" step="1" value="8" title="Friction cap — transit drag parks flux at destinations this dense"><output>8</output><button class="mill-help" data-help="fric" aria-label="About Drag">?</button></label>
        <label title="Park probability % — flat capture rate above the Drag cap (M49: 50 is canonical, not sacred)">Park% <input type="range" data-park min="0" max="100" step="1" value="50"><output>50</output><button class="mill-help" data-help="park" aria-label="About Park%">?</button></label>
        <label title="Congestion wall — destinations this dense refuse inflow entirely (M49: the crust wall)">Wall  <input type="range" data-wall min="0" max="128" step="1" value="0"><output>0</output><button class="mill-help" data-help="wall" aria-label="About Wall">?</button></label>
        <label>Rad   <input type="range" data-rad     min="0" max="8"  step="1" value="4"><output>4</output><button class="mill-help" data-help="rad" aria-label="About Rad">?</button></label>
        <label>Lat   <input type="range" data-lat     min="1" max="32" step="1" value="1" title="Emission latency — carrier must dwell this many ticks before rest can radiate"><output>1</output><button class="mill-help" data-help="lat" aria-label="About Lat">?</button></label>
        <label>Ap    <input type="range" data-bap     min="1" max="8"  step="1" value="4" title="Laser aperture radius"><output>4</output><button class="mill-help" data-help="bap" aria-label="About Ap">?</button></label>
        <label>OffU  <input type="range" data-bou     min="-16" max="16" step="1" value="0" title="Beam offset — first axis of the plane normal to Dir"><output>0</output><button class="mill-help" data-help="bou" aria-label="About OffU">?</button></label>
        <label>OffV  <input type="range" data-bov     min="-16" max="16" step="1" value="0" title="Beam offset — second axis of the plane normal to Dir"><output>0</output><button class="mill-help" data-help="bov" aria-label="About OffV">?</button></label>
        <label>Speed <input type="range" data-speed   min="1" max="60" step="1" value="20"><output>20</output><button class="mill-help" data-help="speed" aria-label="About Speed">?</button></label>
        <label>Zoom  <input type="range" data-zoom    min="20" max="300" step="1" value="45"><output>45</output><button class="mill-help" data-help="zoom" aria-label="About Zoom">?</button></label>
        <label title="HDR exposure — how much accumulated light the tonemap passes through; lower tames dense cores, higher lifts faint flux">Glow  <input type="range" data-expo min="40" max="300" step="5" value="120"><output>120</output><button class="mill-help" data-help="expo" aria-label="About Glow">?</button></label>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Wake-style soft-UI skin: raised beveled controls seated in inset
   wells on a deep drop-shadowed panel — background recedes, controls pop. */
.mill-simulator {
  color-scheme: dark;
  --mill-panel: linear-gradient(180deg, #141c30, #0a101d);
  --mill-well: #060a13;
  --mill-btn-top: #22314f;
  --mill-btn-bot: #131c30;
  --mill-bevel-light: rgba(160, 200, 255, 0.16);
  --mill-bevel-dark: rgba(0, 0, 0, 0.65);
  --mill-accent: #7fe;
  --mill-muted: #9ef;
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
/* stage — relative box that owns the canvas and every overlay; on
   desktop it gets an explicit height so the dock grows the page */
.mill-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
}
.mill-canvas {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: block;
  touch-action: none;
}

/* top-left overlay column — owns the HUD chip, the status line, and
   the help card as a vertical stack; nothing inside it can overlap */
.mill-overlay-tl {
  position: absolute;
  top: 8px;
  left: 8px;
  right: 64px;                      /* clears the ⚙ toggle corner */
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  pointer-events: none;
  z-index: 3;
}

/* telemetry chip — small, translucent */
.mill-hud {
  max-width: 100%;
  padding: 4px 10px;
  font: 11px/1.5 monospace;
  color: var(--mill-accent);
  background: rgba(8, 10, 20, 0.6);
  border: 1px solid var(--mill-bevel-light);
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45), inset 0 1px 0 var(--mill-bevel-light);
  pointer-events: none;
  text-shadow: 0 0 4px #000;
  overflow-wrap: anywhere;
}

/* transient status line — sits under the telemetry chip, never competes
   with it. :empty hides it, so clearing text is the whole off-switch. */
.mill-status {
  max-width: 100%;
  padding: 3px 9px;
  font: 10px/1.4 monospace;
  color: var(--mill-muted);
  background: rgba(8, 10, 20, 0.45);
  border: 1px solid rgba(160, 200, 255, 0.12);
  border-radius: 7px;
  pointer-events: none;
  text-shadow: 0 0 4px #000;
}
.mill-status:empty { display: none; }

/* split view — center hairline + per-pane captions, only when split-on */
.mill-divider {
  display: none;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  background: linear-gradient(180deg, transparent, rgba(160, 200, 255, 0.45), transparent);
  pointer-events: none;
  z-index: 3;
}
.mill-simulator.split-on .mill-divider { display: block; }
.mill-panetags {
  display: none;
  position: absolute;
  top: 8px;
  left: 0;
  right: 0;
  pointer-events: none;
  z-index: 3;
}
.mill-simulator.split-on .mill-panetags { display: flex; }
.mill-panetags span {
  flex: 1;
  text-align: center;
  font: 10px monospace;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--mill-muted);
  opacity: 0.65;
  text-shadow: 0 0 4px #000;
}

/* mass-partition sparkline — top-right, under the ⚙ toggle; two strips,
   rest over flux, each auto-scaled so neither flattens the other */
.mill-graph {
  position: absolute;
  top: 50px;
  right: 8px;
  width: 156px;
  height: 56px;
  background: rgba(8, 10, 20, 0.55);
  border: 1px solid var(--mill-bevel-light);
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45), inset 0 1px 0 var(--mill-bevel-light);
  pointer-events: none;
  z-index: 3;
}

/* collapse toggle — small, always visible */
.mill-uitoggle {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 34px;
  height: 34px;
  font: 14px monospace;
  color: var(--mill-muted);
  background: var(--mill-panel);
  border: 1px solid var(--mill-bevel-dark);
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5), inset 0 1px 0 var(--mill-bevel-light);
  cursor: pointer;
  z-index: 3;
}
.mill-uitoggle:active { box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.6); transform: scale(0.96); }
.mill-simulator.dock-hidden .mill-dock { display: none; }

/* orientation gizmo — Blender-style axes chip floating on the
   canvas, bottom-right corner */
.mill-gizmo {
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 44px;
  height: 44px;
  flex: none;
  border-radius: 50%;
  background: rgba(8, 10, 20, 0.6);
  border: 1px solid var(--mill-bevel-light);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45), inset 0 1px 0 var(--mill-bevel-light);
  cursor: pointer;
  touch-action: none;
  z-index: 3;
}

/* control dock — in-flow below the canvas; wells carve control groups */
.mill-dock {
  flex: none;
  align-self: center;
  margin: 6px auto;
  max-width: calc(100% - 16px);
  padding: 4px 8px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 3px 6px;
  align-items: center;
  background: var(--mill-panel);
  border: 1px solid var(--mill-bevel-dark);
  border-radius: 14px;
  box-shadow:
    0 14px 34px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 var(--mill-bevel-light);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  z-index: 3;
}

/* inset wells — sunken channels that group the raised controls */
.mill-well {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 2px 7px;
  background: var(--mill-well);
  border: 1px solid var(--mill-bevel-dark);
  border-radius: 10px;
  box-shadow:
    inset 0 2px 7px rgba(0, 0, 0, 0.65),
    0 1px 0 rgba(160, 200, 255, 0.07);
}
/* row-gap is exactly the legend's overhang — captions float into the
   gap between rows instead of costing vertical space */
.mill-transport { gap: 9px 3px; flex-wrap: wrap; justify-content: center; }

/* control groups — named clusters with micro-captions, DAW-style.
   Caption rides inline on the group's left edge so a group costs
   exactly one row of height; the ? chip opens a card explaining
   each tool in it. */
.mill-grp {
  position: relative;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 6px 3px;
  background: rgba(8, 12, 24, 0.55);
  border: 1px solid rgba(160, 200, 255, 0.09);
  border-radius: 9px;
}
/* caption = fieldset legend — straddles the group's top border in
   the dead space above the buttons instead of costing a row slot */
.mill-grp-row > em {
  position: absolute;
  top: -7px;
  left: 7px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 3px;
  font: 7.5px monospace;
  font-style: normal;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.8;
  white-space: nowrap;
  background: var(--mill-well);
  border-radius: 4px;
}
.mill-grp-row {
  display: flex;
  align-items: center;
  gap: 3px;
}
.grp-time > .mill-grp-row > em    { color: var(--mill-accent); }
.grp-inject > .mill-grp-row > em  { color: #ffb35c; }
.grp-ops > .mill-grp-row > em     { color: #b48cff; }
.grp-presets > .mill-grp-row > em { color: var(--mill-muted); }
/* group borders echo their legend colors — a whisper of function
   color-coding, not a rainbow */
.grp-time    { border-color: rgba(127, 255, 238, 0.22); }
.grp-inject  { border-color: rgba(255, 179, 92, 0.26); }
.grp-ops     { border-color: rgba(180, 140, 255, 0.26); }
.grp-presets { border-color: rgba(160, 200, 255, 0.15); }
/* presets claims its own full line — the three fields spread evenly
   across it instead of floating centered with voids on each side */
.grp-presets { flex: 1 1 100%; justify-content: flex-start; }
.grp-presets .mill-grp-row { flex: 1; justify-content: space-evenly; }

/* accordion wells always claim a full dock line — a partial row
   beside the transport was what squeezed Tuning into a tall strip */
.mill-selects,
.mill-sliders { flex: 1 1 100%; }
.mill-sliders {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(152px, 1fr));
  gap: 5px 12px;
}
.mill-sliders label { justify-self: start; }

/* raised controls — gradient face, dark rim, top highlight, drop shadow */
.mill-grp-row > button,
.mill-dock select {
  position: relative;
  min-width: 34px;
  min-height: 34px;
  padding: 0 10px;
  font: 13px monospace;
  color: var(--mill-muted);
  background: linear-gradient(180deg, var(--mill-btn-top), var(--mill-btn-bot));
  border: 1px solid var(--mill-bevel-dark);
  border-radius: 7px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5), inset 0 1px 0 var(--mill-bevel-light);
  cursor: pointer;
}
/* transport buttons: glyph + short inline label, one compact line */
.mill-grp-row > button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  min-height: 28px;
  padding: 1px 7px 4px;
  line-height: 1;
}
.mill-grp-row > button .g { font-size: 12px; line-height: 1; }
.mill-grp-row > button .l {
  font-size: 7.5px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.7;
  white-space: nowrap;
}
.mill-grp-row > button:active {
  transform: scale(0.94);
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.6);
}
.mill-grp-row > button.on {
  color: var(--mill-accent);
}
/* on state = a small glowing horizontal pill inside the button,
   like an indicator LED under the glyph */
.mill-grp-row > button.on::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 2px;
  width: 16px;
  height: 3px;
  transform: translateX(-50%);
  border-radius: 2px;
  background: var(--mill-accent);
  box-shadow: 0 0 7px rgba(119, 255, 238, 0.9), 0 0 2px rgba(119, 255, 238, 0.7);
  pointer-events: none;
}
/* armed tool = filled accent — unmistakably different from a passive toggle */
.mill-grp-row > button.armed {
  color: #04141c;
  background: var(--mill-accent);
  border-color: rgba(119, 255, 238, 0.8);
  box-shadow: 0 0 14px rgba(119, 255, 238, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.mill-grp-row > button:disabled { opacity: 0.35; cursor: default; }

/* tuning accordions — selects + sliders stay collapsed until asked for;
   on load the dock is just the transport row */
.mill-dock:not(.sel-open) .mill-selects { display: none; }
.mill-dock:not(.tune-open) .mill-sliders { display: none; }
.mill-accbtn {
  min-width: 34px;
  min-height: 30px;
  padding: 0 10px;
  font: 11px monospace;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--mill-muted);
  background: linear-gradient(180deg, var(--mill-btn-top), var(--mill-btn-bot));
  border: 1px solid var(--mill-bevel-dark);
  border-radius: 7px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5), inset 0 1px 0 var(--mill-bevel-light);
  cursor: pointer;
}
.mill-accbtn:active { transform: scale(0.94); box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.6); }
.mill-dock.tune-open .mill-accbtn {
  color: var(--mill-accent);
  border-color: rgba(119, 255, 238, 0.45);
}

/* selects share one row — a well containing two labeled dropdowns */
.mill-selects { flex-direction: row; flex-wrap: wrap; justify-content: center; }
.mill-field {
  display: flex;
  align-items: center;
  gap: 4px;
  font: 11px monospace;
  color: var(--mill-muted);
  white-space: nowrap;
}
.mill-field > span {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.75;
}
/* dropdowns never balloon to their longest option — the collapsed
   text truncates, the open menu still shows full names */
.mill-field select[data-scene]  { width: 118px; }
.mill-field select[data-preset] { width: 92px; }
.mill-field select[data-colormode] { width: 72px; }

/* ? help chips — small neon-green button seated beside each control */
.mill-help {
  flex: none;
  width: 16px;
  height: 16px;
  padding: 0;
  font: bold 9px/15px monospace;
  text-align: center;
  color: #8fff9e;
  background: linear-gradient(180deg, #1e4a2c, #0d2416);
  border: 1px solid rgba(143, 255, 158, 0.4);
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(143, 255, 158, 0.25);
  cursor: pointer;
  opacity: 0.85;
}
.mill-help:hover {
  opacity: 1;
  box-shadow: 0 0 9px rgba(143, 255, 158, 0.55), inset 0 1px 0 rgba(143, 255, 158, 0.3);
}
.mill-help:active { transform: scale(0.9); }

/* help card — third item in the overlay stack, under the status line */
.mill-card {
  max-width: min(320px, 100%);
  padding: 10px 14px 11px;
  pointer-events: auto;
  background: rgba(10, 14, 26, 0.92);
  border: 1px solid var(--mill-bevel-light);
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), inset 0 1px 0 var(--mill-bevel-light);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  z-index: 4;
}
.mill-card[hidden] { display: none; }
.mill-card-title {
  font: 11px monospace;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--mill-accent);
  margin-bottom: 5px;
  padding-right: 18px;
}
.mill-card-body { font: 11px/1.55 monospace; color: var(--mill-muted); }
.mill-card-x {
  position: absolute;
  top: 6px;
  right: 8px;
  width: 18px;
  height: 18px;
  padding: 0;
  font: 12px/16px monospace;
  color: var(--mill-muted);
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.6;
}
.mill-card-x:hover { opacity: 1; color: var(--mill-accent); }
.mill-dock select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 18px;
  font-size: 11px;
  min-height: 26px;
  background-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='6'%3E%3Cpath d='M0 0l4 6 4-6z' fill='%239eefff'/%3E%3C/svg%3E"),
    linear-gradient(180deg, var(--mill-btn-top), var(--mill-btn-bot));
  background-repeat: no-repeat;
  background-position: right 8px center, 0 0;
}
.mill-dock select option {
  background: #131c30;
  color: var(--mill-muted);
}

/* slider wells — recessed groove track + raised beveled thumb */
.mill-sliders label {
  display: flex;
  align-items: center;
  gap: 5px;
  font: 11px monospace;
  color: var(--mill-muted);
  white-space: nowrap;
}
.mill-sliders input[type='range'] {
  -webkit-appearance: none;
  appearance: none;
  width: 70px;
  height: 22px;
  background: transparent;
  cursor: pointer;
}
.mill-sliders input[type='range']::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(180deg, #04070d, #0d1524);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.8), 0 1px 0 var(--mill-bevel-light);
}
.mill-sliders input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  margin-top: -5px;
  border-radius: 50%;
  background: linear-gradient(180deg, var(--mill-btn-top), var(--mill-btn-bot));
  border: 1px solid var(--mill-bevel-dark);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6), inset 0 1px 0 var(--mill-bevel-light);
}
.mill-sliders input[type='range']:active::-webkit-slider-thumb {
  box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.6), 0 0 8px rgba(119, 255, 238, 0.35);
  border-color: rgba(119, 255, 238, 0.45);
}
.mill-sliders input[type='range']::-moz-range-track {
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(180deg, #04070d, #0d1524);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.8);
}
.mill-sliders input[type='range']::-moz-range-thumb {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: linear-gradient(180deg, var(--mill-btn-top), var(--mill-btn-bot));
  border: 1px solid var(--mill-bevel-dark);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6), inset 0 1px 0 var(--mill-bevel-light);
}
.mill-sliders output {
  min-width: 2ch;
  color: var(--mill-accent);
  opacity: 0.9;
}

/* desktop: let the dock breathe — fixed viewport height was clipping an
   expanded Tuning/Flags and forcing inner scrollbars. Here the stage
   keeps a viewport-anchored height while the page itself scrolls when
   the dock grows; touch/narrow keeps the svh fit + contained scroll. */
@media (min-width: 821px) and (pointer: fine) {
  .mill-simulator { height: auto; min-height: 0; }
  .mill-stage {
    flex: none;
    height: calc(100svh - var(--tool-top, 76px) - 96px);
    min-height: 320px;
  }
}

/* real 44px targets only where fingers live */
@media (pointer: coarse) {
  .mill-grp-row > button, .mill-dock select, .mill-uitoggle {
    min-width: 44px;
    min-height: 44px;
  }
  /* iOS Safari force-zooms the page when a focused form control's
     font-size is under 16px — selects must read 16 on touch, and the
     fixed widths grow to keep the bigger text from truncating */
  .mill-dock select { font-size: 16px; }
  .mill-field select[data-scene]     { width: 132px; }
  .mill-field select[data-preset]    { width: 124px; }
  .mill-field select[data-colormode] { width: 90px; }
  .mill-sliders input[type='range'] { width: 90px; height: 40px; }
  .mill-sliders input[type='range']::-webkit-slider-thumb { margin-top: -5px; }
}

/* mobile + narrow windows: the canvas IS the app — edge to edge. The
   measured --tool-top height already pins the dock inside the viewport;
   the 8px remainder clears the home indicator. */
@media (pointer: coarse), (max-width: 820px) {
  .mill-simulator {
    min-height: 0;
    max-width: none;
    border-radius: 0;
  }
  .mill-dock {
    margin-bottom: calc(6px + env(safe-area-inset-bottom, 0px));
    max-width: calc(100% - 8px);
    /* a fully-expanded dock can't be allowed to squeeze the canvas to
       zero — cap it and let it scroll internally */
    max-height: 52vh;
    max-height: 52svh;
    overflow-y: auto;
    overflow-x: hidden;            /* a wrapping group must never
                                      scroll the dock sideways */
    overscroll-behavior: contain;
    touch-action: manipulation;    /* rapid button taps must not
                                      trigger double-tap zoom */
  }
  /* both control wells must wrap — seven labeled selects and twelve
     transport buttons never fit one narrow row */
  .mill-transport,
  .mill-selects {
    flex-wrap: wrap;
    justify-content: center;
  }
  /* inject's six buttons exceed a phone dock — wrap inside the group
     instead of overflowing sideways */
  .mill-grp-row { flex-wrap: wrap; justify-content: center; gap: 5px; }
  /* bigger touch buttons: [dot][glyph][label] in one row — the
     on-state dot leads the row as a real flex item, big enough to
     actually read at arm's length */
  .mill-grp-row > button {
    gap: 5px;
    min-height: 44px;
    padding: 4px 10px;
  }
  .mill-grp-row > button .g { font-size: 16px; }
  .mill-grp-row > button .l { font-size: 9px; letter-spacing: 0.05em; }
  .mill-grp-row > button.on::after {
    position: static;
    order: -1;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    transform: none;
    margin-right: -3px;
  }
  /* accordion chips inside the presets row keep their chip styling
     (the row's transport-button rules would otherwise inflate them) */
  .mill-grp-row > button.mill-accbtn {
    font: 10px monospace;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    min-width: 0;
    padding: 2px 9px;
    gap: 4px;
  }
  /* status text clamped on phones — a 5-line say() shouldn't cover
     a third of the canvas */
  .mill-status {
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .mill-field { gap: 4px; }
  .mill-field > span { font-size: 9px; }
  .mill-dock select { padding: 0 20px 0 8px; }
}

/* phones: shrink the secondary chrome so the HUD keeps the corner */
@media (max-width: 560px) {
  .mill-graph {
    top: 46px;
    right: 6px;
    width: 110px;
    height: 40px;
  }
  /* the gizmo stays an overlay chip on phones — smaller, tucked into
     the corner, dimmed so it reads as chrome not a control row */
  .mill-gizmo {
    width: 30px;
    height: 30px;
    right: 6px;
    bottom: 6px;
    opacity: 0.65;
  }
}

/* short viewports of any kind (wide but landscape-short, split-screen):
   same fit — min-height yields instead of pushing the dock off-screen */
@media (max-height: 640px) {
  .mill-simulator { min-height: 0; }
}
</style>

<style>
/* Suppress VitePress chrome that overlays or displaces the simulator —
   .VPLocalNav is the strip carrying the outline dropdown and the
   "Return to top" button; it sits above the canvas and consumes ~48px
   of the viewport the svh calculation assumed it owned. */
.mill-page .VPDocFooter,
.mill-page .VPBackToTop,
.mill-page .VPLocalNav,
.mill-page .aside-top {
  display: none !important;
}
/* Orbiting/pinch on mobile must not bounce or pull-to-refresh the page. */
html:has(.mill-simulator) {
  overscroll-behavior: none;
}
/* .VPNav is sticky (in-flow) on this theme, so VitePress's
   padding-top: var(--vp-nav-height) — meant to clear a fixed nav —
   is a dead band below the navbar. Reclaim it at all widths. */
.mill-page .VPContent { padding-top: 0 !important; }
/* Page prose: doc typography + article width, same as the rest of the site.
   (layout: page renders raw Content with no .vp-doc wrapper — we add the
   class in mill-demo.md and constrain it here.) */
.mill-page .mill-doc {
  max-width: 768px;
  margin: 0 auto;
  padding: 24px 24px 72px;
}
</style>
