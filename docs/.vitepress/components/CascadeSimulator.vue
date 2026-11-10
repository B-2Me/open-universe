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
    <div class="cascade-stage">
      <canvas class="cascade-canvas" aria-label="Cartan's Cascade 3D moore26 lattice renderer"></canvas>
      <div class="cascade-overlay-tl">
        <div class="cascade-hud" data-hud title="T = elapsed time in fm/c (1 tick = light crossing 0.1fm ≈ 3.3e-25 s) · mass = parked quanta · wind = bound circulation · pkt = free quanta · |q| = net charge · core@(x,y,z) = mass centroid · fps = render rate · ms/t = compute time per tick">booting…</div><button class="cascade-copy" data-copy title="Copy telemetry" aria-label="Copy telemetry">⧉</button>
        <div class="cascade-status" data-status></div>
        <div class="cascade-card" data-card hidden>
          <button class="cascade-card-x" data-card-x aria-label="Close">×</button>
          <div class="cascade-card-title" data-card-title></div>
          <div class="cascade-card-body" data-card-body></div>
        </div>
      </div>
      <button class="cascade-uitoggle" data-fs title="Fullscreen" aria-label="Toggle fullscreen">⛶</button>
    </div>
    <div class="cascade-dock">
      <!-- widgets anchor to the dock's right edge — they track the
           shrink-wrapped dock, not the canvas's far edge -->
      <canvas class="cascade-zoomlens" data-zoomlens width="128" height="128" title="Zoom lens — drag up/down to zoom; double-click resets" aria-label="Zoom lens"></canvas>
      <canvas class="cascade-gizmo" data-gizmo width="128" height="128" title="Orientation — double-click to reset view" aria-label="Orientation gizmo"></canvas>
      <div class="cascade-dock-scroll">
      <div class="cascade-well cascade-transport" role="group" aria-label="Controls">
        <div class="cascade-grp grp-time">
          <div class="cascade-grp-row">
            <em>time <button class="cascade-help" data-help="grp-time" aria-label="About the time controls">?</button></em>
            <button data-play class="tog on" title="Play / pause" aria-label="Play or pause"><span class="g">⏸</span><span class="l">play</span></button>
            <button data-step title="Step one tick" aria-label="Step one tick"><span class="g">⏭</span><span class="l">step</span></button>
            <button data-reset title="Reset the scenario" aria-label="Reset"><span class="g">⟲</span><span class="l">reset</span></button>
          </div>
        </div>
        <div class="cascade-grp grp-ops">
          <div class="cascade-grp-row">
            <em>ops <button class="cascade-help" data-help="grp-ops" aria-label="About the session ops">?</button></em>
            <button data-spin class="tog on" aria-pressed="true" title="Auto-rotate" aria-label="Toggle auto-rotate"><span class="g">🪐</span><span class="l">orbit</span></button>
          </div>
        </div>
        <div class="cascade-grp-line">
        <div class="cascade-grp grp-inject">
          <div class="cascade-grp-row">
            <em>inject <button class="cascade-help" data-help="grp-inject" aria-label="About the injection tools">?</button></em>
            <button data-lump title="Lump tool — arm, then click to drop a wound condenser (shift-click: +dd handedness)" aria-label="Wound lump tool" aria-pressed="false"><span class="g">⌖</span><span class="l">lump</span></button>
            <button data-tube title="Tube tool — arm, then click to paint a saturated flux string" aria-label="Flux tube tool" aria-pressed="false"><span class="g">—</span><span class="l">tube</span></button>
            <button data-ringt title="Ring tool — arm, then click to paint a {111} waveguide loop with a live stream" aria-label="Ring tool" aria-pressed="false"><span class="g">◦</span><span class="l">ring</span></button>
            <button data-thrust title="Thrust tool — arm, then click to kick a structure along +x with stored momentum (shift-click: -x)" aria-label="Thrust kick tool" aria-pressed="false"><span class="g">⚡</span><span class="l">thrust</span></button>
          </div>
        </div>
        <div class="cascade-grp grp-emit">
          <div class="cascade-grp-row">
            <em>emit <button class="cascade-help" data-help="grp-emit" aria-label="About the emitters">?</button></em>
            <button data-drive class="tog" aria-pressed="false" title="Convergent feed — 26 quantum spokes pour at the core" aria-label="Toggle convergent drive"><span class="g">☀</span><span class="l">feed</span></button>
            <button data-beam class="tog" aria-pressed="false" title="Quantum beam — +x stream; the probe bombardment" aria-label="Toggle quantum beam"><span class="g">➤</span><span class="l">beam</span></button>
          </div>
        </div>
        </div>
        <div class="cascade-grp grp-util">
          <div class="cascade-grp-row">
            <em>util</em>
            <button class="cascade-accbtn" data-tune aria-expanded="false" title="Tuning sliders" aria-label="Tuning sliders"><span class="g">▤</span></button>
          </div>
        </div>
      </div>
      <div class="cascade-well cascade-presets" role="group" aria-label="Presets">
        <div class="cascade-grp grp-presets">
          <div class="cascade-grp-row">
            <em>presets</em>
            <label class="cascade-field"><button class="cascade-flab" type="button" data-help="focus" aria-label="About Focus" title="About Focus"><i>◎</i></button><select data-preset aria-label="Camera focus preset" title="Camera focus preset">
              <option value="full" selected>Full lattice</option>
              <option value="core">Core close-up</option>
              <option value="slab">Mid-plane slab</option>
              <option value="side">Side profile</option>
              <option value="lattice">Single plane</option>
            </select></label>
            <button class="cascade-flab cascade-depth tog" type="button" data-depth aria-pressed="false" aria-label="Depth slice" title="Depth slice — the slab follows the camera; peels the front shell"><i>◧</i></button>
            <label class="cascade-field"><button class="cascade-flab" type="button" data-help="view" aria-label="About View" title="About View"><i>◐</i></button><select data-colormode aria-label="Data view" title="Data view">
              <option value="4" selected>composite</option>
              <option value="0">structure</option>
              <option value="1">wake</option>
              <option value="2">thermal</option>
              <option value="3">pol</option>
              <option value="5">current</option>
              <option value="6">handed</option>
            </select></label>
            <label class="cascade-field"><button class="cascade-flab" type="button" data-help="scenario" aria-label="About Scenario" title="About Scenario"><i>◆</i></button><select data-scenario aria-label="Scenario" title="Scenario — reseeds the field">
              <option value="glide" selected>glide</option>
              <option value="ring">ring</option>
              <option value="tube">flux tube</option>
              <option value="pair">chiral pair</option>
              <option value="attract">charge attract</option>
              <option value="repel">charge repel</option>
              <option value="quark">quark</option>
              <option value="meson">meson</option>
              <option value="proton">proton</option>
              <option value="zoo">zoo</option>
              <option value="lump">wound lump</option>
              <option value="buckle">hexbuckle</option>
              <option value="link">hopf link</option>
              <option value="vacuum">vacuum</option>
            </select></label>
          </div>
        </div>
      </div>
      <div class="cascade-well cascade-sliders">
        <label title="Cut position along the slice axis"><button class="cascade-shelp" type="button" data-help="slice" aria-label="About Slice" title="About Slice">Slice</button><input type="range" data-zcenter min="0" max="43" step="1" value="22"><output>22</output></label>
        <label title="Slab thickness in cells"><button class="cascade-shelp" type="button" data-help="slab" aria-label="About Slab" title="About Slab">Width</button><input type="range" data-zthick min="1" max="44" step="1" value="44"><output>44</output></label>
        <label><button class="cascade-shelp" type="button" data-help="size" aria-label="About Size" title="About Size">Size</button><input type="range" data-size min="20" max="150" step="1" value="55"><output>55</output></label>
        <label><button class="cascade-shelp" type="button" data-help="speed" aria-label="About Speed" title="About Speed">Speed</button><input type="range" data-speed min="1" max="120" step="1" value="20"><output>20</output></label>
        <label><button class="cascade-shelp" type="button" data-help="qmin" aria-label="About Q≥" title="About Q≥">Q≥</button><input type="range" data-qmin min="1" max="120" step="1" value="1"><output>1</output></label>
        <label><button class="cascade-shelp" type="button" data-help="zoom" aria-label="About Zoom" title="About Zoom">Zoom</button><input type="range" data-zoom min="8" max="200" step="1" value="25"><output>25</output></label>
      </div>
      </div>
    </div>
  </div>
</template>


<style scoped>
/* Wake-style soft-UI skin: raised beveled controls seated in inset
   wells on a deep drop-shadowed panel — background recedes, controls pop. */
.cascade-simulator {
  color-scheme: dark;
  --cascade-panel: linear-gradient(180deg, #141c30, #0a101d);
  --cascade-well: #060a13;
  --cascade-btn-top: #22314f;
  --cascade-btn-bot: #131c30;
  --cascade-bevel-light: rgba(160, 200, 255, 0.16);
  --cascade-bevel-dark: rgba(0, 0, 0, 0.65);
  --cascade-accent: #7fe;
  --cascade-muted: #9ef;
  position: relative;
  display: flex;
  flex-direction: column;
  /* --tool-top is the element's measured document offset (set on mount);
     svh always reserves the browser URL-bar strip, so the dock can't
     slide below the fold when chrome collapses. */
  height: calc(100vh - var(--tool-top, 76px) - 8px);
  height: calc(100svh - var(--tool-top, 76px) - 8px);
  /* 520px pushed the two-row dock below the fold on short windows —
     380px still gives the canvas room without forcing the dock off */
  min-height: 380px;
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
.cascade-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
}
.cascade-canvas {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: block;
  touch-action: none;
}

/* top-left overlay column — owns the HUD chip, the status line, and
   the help card as a vertical stack; nothing inside it can overlap */
.cascade-overlay-tl {
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

/* telemetry chip — small, translucent; ⧉ copies it */
.cascade-hud {
  max-width: 100%;
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
  user-select: none;
  -webkit-user-select: none;
}
.cascade-copy {
  pointer-events: auto;
  margin-top: 0;
  width: 22px; height: 22px;
  font: 12px/1 monospace;
  color: var(--cascade-muted);
  background: rgba(8, 10, 20, 0.6);
  border: 1px solid var(--cascade-bevel-light);
  border-radius: 5px;
  cursor: pointer;
  opacity: 0.7;
}
.cascade-copy:hover { opacity: 1; }
/* copy chip hangs off the LEFT of the hud — the right side collides
   with the ⛶ fullscreen corner button */
.cascade-hud + .cascade-copy { position: absolute; left: -26px; top: 4px; }

/* transient status line — sits under the telemetry chip, never competes
   with it. :empty hides it, so clearing text is the whole off-switch. */
.cascade-status {
  max-width: 100%;
  padding: 3px 9px;
  font: 10px/1.4 monospace;
  color: var(--cascade-muted);
  background: rgba(8, 10, 20, 0.45);
  border: 1px solid rgba(160, 200, 255, 0.12);
  border-radius: 7px;
  pointer-events: none;
  text-shadow: 0 0 4px #000;
}
.cascade-status:empty { display: none; }

/* split view — center hairline + per-pane captions, only when split-on */
.cascade-divider {
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
.cascade-simulator.split-on .cascade-divider { display: block; }
.cascade-panetags {
  display: none;
  position: absolute;
  top: 8px;
  left: 0;
  right: 0;
  pointer-events: none;
  z-index: 3;
}
.cascade-simulator.split-on .cascade-panetags { display: flex; }
.cascade-panetags span {
  flex: 1;
  text-align: center;
  font: 10px monospace;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--cascade-muted);
  opacity: 0.65;
  text-shadow: 0 0 4px #000;
}

/* mass-partition sparkline — top-right, under the ⚙ toggle; two strips,
   rest over flux, each auto-scaled so neither flattens the other */
.cascade-graph {
  position: absolute;
  top: 50px;
  right: 8px;
  width: 156px;
  height: 56px;
  background: rgba(8, 10, 20, 0.55);
  border: 1px solid var(--cascade-bevel-light);
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45), inset 0 1px 0 var(--cascade-bevel-light);
  pointer-events: none;
  z-index: 3;
}

/* collapse toggle — small, always visible */
.cascade-uitoggle {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 44px;
  height: 44px;
  font: 22px/1 monospace;
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

/* zoom lens — circular dial at the canvas edge, sibling chrome to the
   gizmo: faint reticle rings, one bright ring rides in/out with zoom */
.cascade-zoomlens {
  position: absolute;
  /* dock child — fixed offset above its top-right corner */
  right: 6px;
  top: -74px;
  z-index: 4;
  width: 56px;
  height: 56px;
  flex: none;
  border-radius: 50%;
  background: rgba(8, 10, 20, 0.6);
  cursor: ns-resize;
  opacity: 0.9;
  touch-action: none;
}
/* orientation gizmo — Blender-style axes chip floating on the
   canvas, bottom-right corner */
.cascade-gizmo {
  position: absolute;
  /* rides left of the lens above the dock's right edge */
  right: 74px;
  top: -74px;
  width: 64px;
  height: 64px;
  flex: none;
  border-radius: 50%;
  background: rgba(8, 10, 20, 0.6);
  border: 1px solid var(--cascade-bevel-light);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45), inset 0 1px 0 var(--cascade-bevel-light);
  cursor: pointer;
  touch-action: none;
  z-index: 3;
}

/* control dock — in-flow below the canvas; wells carve control groups */
.cascade-dock {
  position: relative;
  flex: none;
  align-self: center;
  width: fit-content;               /* snap: shrink-wrap to content —
                                         never stretch to the window */
  overflow: visible;                /* widgets hang above the box */
  margin: 6px auto;
  max-width: calc(100% - 16px);
  user-select: none;
  -webkit-user-select: none;
  padding: 3px 6px;
  display: flex;
  flex-direction: column;           /* one well per row, centered */
  align-items: center;
  gap: 1px;
  background: var(--cascade-panel);
  border: 1px solid var(--cascade-bevel-dark);
  border-radius: 14px;
  box-shadow:
    0 14px 34px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 var(--cascade-bevel-light);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  z-index: 3;
}

/* inset wells — sunken channels that group the raised controls */
.cascade-well {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 1px 4px;
  background: var(--cascade-well);
  border: 1px solid var(--cascade-bevel-dark);
  border-radius: 10px;
  box-shadow:
    inset 0 2px 7px rgba(0, 0, 0, 0.65),
    0 1px 0 rgba(160, 200, 255, 0.07);
}
/* row-gap is exactly the legend's overhang — captions float into the
   gap between rows instead of costing vertical space */
.cascade-transport { gap: 7px 2px; flex-wrap: wrap; justify-content: center; }

/* control groups — named clusters with micro-captions, DAW-style.
   Caption rides inline on the group's left edge so a group costs
   exactly one row of height; the ? chip opens a card explaining
   each tool in it. */
.cascade-grp {
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
   the dead space above the buttons instead of costing a row slot.
   Fixed 14px height so its ? chip lives fully inside the legend
   and can't clip across the border. */
.cascade-grp-row > em {
  position: absolute;
  top: -8px;
  left: 7px;
  display: flex;
  align-items: center;
  gap: 2px;
  height: 14px;
  padding: 0 4px;
  font: 7.5px monospace;
  font-style: normal;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.8;
  white-space: nowrap;
  background: var(--cascade-well);
  border-radius: 4px;
  z-index: 1;
}
.cascade-grp-row > em .cascade-help {
  width: 12px;
  height: 12px;
  font-size: 7.5px;
  line-height: 12px;
}
.cascade-grp-row {
  display: flex;
  align-items: center;
  gap: 1px;
}
.grp-time > .cascade-grp-row > em    { color: var(--cascade-accent); }
.grp-inject > .cascade-grp-row > em  { color: #ffb35c; }
.grp-ops > .cascade-grp-row > em     { color: #b48cff; }
.grp-presets > .cascade-grp-row > em { color: var(--cascade-muted); }
/* group borders echo their legend colors — a whisper of function
   color-coding, not a rainbow */
.grp-time    { border-color: rgba(127, 255, 238, 0.22); }
.grp-inject  { border-color: rgba(255, 179, 92, 0.26); }
.grp-ops     { border-color: rgba(180, 140, 255, 0.26); }
.grp-presets { border-color: rgba(160, 200, 255, 0.15); }
/* presets claims its own full line — the three fields spread evenly
   across it instead of floating centered with voids on each side */
.cascade-grp-line { display: flex; justify-content: center; }
.grp-inject .cascade-grp-row { justify-content: center; }
.grp-presets { justify-content: flex-start; }
.grp-presets .cascade-grp-row { justify-content: center; }

/* accordion wells always claim a full dock line — a partial row
   beside the transport was what squeezed Tuning into a tall strip */
.cascade-selects,
.cascade-sliders { flex-wrap: wrap; justify-content: center; }
.cascade-sliders {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(152px, 1fr));
  gap: 5px 12px;
  /* capped near the transport row's width — the accordion can't
     balloon the dock wider than row 1 */
  width: 100%;
  max-width: 560px;
}
.cascade-sliders label { justify-self: start; }

/* raised controls — gradient face, dark rim, top highlight, drop shadow */
.cascade-grp-row > button,
.cascade-dock select {
  position: relative;
  min-width: 40px;
  min-height: 40px;
  padding: 0 8px;
  font: 14px monospace;
  color: var(--cascade-muted);
  background: linear-gradient(180deg, var(--cascade-btn-top), var(--cascade-btn-bot));
  border: 1px solid var(--cascade-bevel-dark);
  border-radius: 7px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5), inset 0 1px 0 var(--cascade-bevel-light);
  cursor: pointer;
}
/* transport buttons: icon row over label — the on-dot shares the
   icon row (a ::before inside .g), the word sits beneath */
.cascade-grp-row > button {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  min-width: 0;
  min-height: 38px;
  padding: 1px 4px;
  line-height: 1;
  position: relative;
}
.cascade-grp-row > button .g {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 21px;
  line-height: 1.1;
}
/* toggle buttons reserve a top lane for the status strip — the icon
   drops 4px so the LED bar never shares the glyph's row */
.cascade-grp-row > button.tog { padding-top: 6px; }
.cascade-grp-row > button.tog .g { font-size: 22px; }
/* per-glyph weight tuning — some glyphs run small/large at equal pt:
   rock's filled disc is heavy, binary's knot is faint, load is thin */
.cascade-grp-row > button[data-rock] .g   { font-size: 17px; }
.cascade-grp-row > button[data-binary] .g { font-size: 24px; }
.cascade-grp-row > button[data-unsnap] .g { font-size: 23px; }
.cascade-grp-row > button[data-ring] .g   { font-size: 23px; }
.cascade-grp-row > button[data-beam] .g   { font-size: 19px; }
/* status strip — a full-width LED bar across the button's top edge,
   rendered only on toggles (.tog) so width never changes; .on lights
   it. Kept clear of the icon row AND the label so it can't collide
   with the glyph it used to share a corner with. */
.cascade-grp-row > button.tog .g::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 3px;
  right: 3px;
  height: 3px;
  border-radius: 2px;
  background: #4a4568;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.45);
  pointer-events: none;
}
.cascade-grp-row > button .l {
  font-size: 13px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.7;
  white-space: nowrap;
}
.cascade-grp-row > button:active {
  transform: scale(0.94);
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.6);
}
.cascade-grp-row > button.on {
  color: var(--cascade-accent);
}
/* on state = the top strip lights edge to edge */
.cascade-grp-row > button.on .g::before {
  background: #ffb35c;
  box-shadow: 0 0 8px rgba(255, 179, 92, 0.95), 0 0 3px rgba(255, 179, 92, 0.85);
}
/* armed tool = filled accent — unmistakably different from a passive toggle */
.cascade-grp-row > button.armed {
  color: #04141c;
  background: var(--cascade-accent);
  border-color: rgba(119, 255, 238, 0.8);
  box-shadow: 0 0 14px rgba(119, 255, 238, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.cascade-grp-row > button:disabled { opacity: 0.35; cursor: default; }

/* tuning accordions — selects + sliders stay collapsed until asked for;
   on load the dock is just the transport row */
.cascade-dock:not(.sel-open) .cascade-selects { display: none; }
.cascade-dock:not(.tune-open) .cascade-sliders { display: none; }
.cascade-accbtn {
  width: 40px;
  min-height: 40px;
  padding: 1px 4px;
  font: 13px monospace;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--cascade-muted);
  background: linear-gradient(180deg, var(--cascade-btn-top), var(--cascade-btn-bot));
  border: 1px solid var(--cascade-bevel-dark);
  border-radius: 7px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5), inset 0 1px 0 var(--cascade-bevel-light);
  cursor: pointer;
}
.cascade-accbtn:active { transform: scale(0.94); box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.6); }
/* expanded accordion chip = filled accent — unmistakably "click to
   close", scoped per-button so each only lights for its own group */
.cascade-dock.sel-open [data-flags],
.cascade-dock.tune-open [data-tune] {
  color: #04141c;
  background: var(--cascade-accent);
  border-color: rgba(119, 255, 238, 0.8);
  box-shadow: 0 0 14px rgba(119, 255, 238, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.35);
}

/* selects share one row — a well containing two labeled dropdowns */
.cascade-selects { flex-direction: row; flex-wrap: wrap; justify-content: center; }
.cascade-field {
  display: flex;
  align-items: center;
  gap: 2px;
  font: 13px monospace;
  color: var(--cascade-muted);
  white-space: nowrap;
}
/* field labels — a bare icon chip, NOT a stacked button: just the
   glyph, subtle border, same 28px height as its select so the row
   reads as [?] [dropdown] pairs instead of tiny buttons */
.cascade-flab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  padding: 0;
  width: 24px;
  font-family: monospace;
  color: var(--cascade-muted);
  background: none;
  border: 1px solid rgba(143, 255, 158, 0.18);
  border-radius: 6px;
  cursor: help;
}
.cascade-flab:hover {
  border-color: rgba(143, 255, 158, 0.65);
  color: #8fff9e;
  box-shadow: 0 0 8px rgba(143, 255, 158, 0.35);
}
.cascade-flab:active { transform: scale(0.93); }
/* slider labels get the same transparent ?-button treatment */
.cascade-shelp {
  font: 10px monospace;
  color: var(--cascade-muted);
  background: none;
  border: 1px solid rgba(143, 255, 158, 0.22);
  border-radius: 6px;
  padding: 1px 5px;
  cursor: help;
}
.cascade-shelp:hover {
  border-color: rgba(143, 255, 158, 0.65);
  color: #8fff9e;
  box-shadow: 0 0 8px rgba(143, 255, 158, 0.35);
}
.cascade-shelp:active { transform: scale(0.93); }
.cascade-flab i { font-style: normal; font-size: 14px; line-height: 1; }
/* depth-slice toggle — same chip size, amber lit state (not a ? chip) */
.cascade-depth { height: 28px; }
.cascade-depth:hover {
  border-color: rgba(255, 179, 92, 0.55);
  color: #ffb35c;
  box-shadow: 0 0 8px rgba(255, 179, 92, 0.3);
}
.cascade-depth.on {
  border-color: rgba(255, 179, 92, 0.8);
  color: #ffb35c;
  box-shadow: 0 0 10px rgba(255, 179, 92, 0.5);
}
/* dropdowns never balloon to their longest option — the collapsed
   text truncates, the open menu still shows full names */
/* second-row elements: compact height, same 13px text — a dropdown
   only needs to be as tall as its text, not a full button frame */
.cascade-field select, .cascade-flab {
  height: 28px;
  font-size: 13px;
}
.cascade-field select[data-preset]   { width: 124px; }  /* "Full lattice" fits */
.cascade-field select[data-colormode] { width: 104px; }  /* "composite" fits */
.cascade-field select[data-scenario]  { width: 116px; } /* "wound ball" fits */

/* ? help chips — small neon-green button seated beside each control */
.cascade-help {
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
.cascade-help:hover {
  opacity: 1;
  box-shadow: 0 0 9px rgba(143, 255, 158, 0.55), inset 0 1px 0 rgba(143, 255, 158, 0.3);
}
.cascade-help:active { transform: scale(0.9); }

/* help card — third item in the overlay stack, under the status line */
.cascade-card {
  max-width: min(320px, 100%);
  padding: 10px 14px 11px;
  pointer-events: auto;
  background: rgba(10, 14, 26, 0.92);
  border: 1px solid var(--cascade-bevel-light);
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), inset 0 1px 0 var(--cascade-bevel-light);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  z-index: 4;
}
.cascade-card[hidden] { display: none; }
.cascade-card-title {
  font: 11px monospace;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--cascade-accent);
  margin-bottom: 5px;
  padding-right: 18px;
}
.cascade-card-body { font: 11px/1.55 monospace; color: var(--cascade-muted); white-space: pre-line; }
.cascade-card-x {
  position: absolute;
  top: 6px;
  right: 8px;
  width: 18px;
  height: 18px;
  padding: 0;
  font: 12px/16px monospace;
  color: var(--cascade-muted);
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.6;
}
.cascade-card-x:hover { opacity: 1; color: var(--cascade-accent); }
.cascade-dock select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 18px;
  font-size: 11px;
  min-height: 26px;
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

/* slider wells — recessed groove track + raised beveled thumb */
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
  box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.6), 0 0 8px rgba(119, 255, 238, 0.35);
  border-color: rgba(119, 255, 238, 0.45);
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

/* desktop: let the dock breathe — fixed viewport height was clipping an
   expanded Tuning/Flags and forcing inner scrollbars. Here the stage
   keeps a viewport-anchored height while the page itself scrolls when
   the dock grows; touch/narrow keeps the svh fit + contained scroll. */
@media (min-width: 821px) and (pointer: fine) {
  /* fixed sim height + flex stage: the dock takes whatever it needs
     (Tuning open included) and the stage shrinks — a fixed stage
     height was clipping the open accordion off the bottom. */
  .cascade-simulator { height: calc(100svh - var(--tool-top, 76px) - 8px); }
  .cascade-stage { flex: 1; min-height: 200px; }
}

/* real 44px targets only where fingers live */
@media (pointer: coarse) {
  .cascade-grp-row > button, .cascade-dock select, .cascade-uitoggle {
    min-width: 44px;
    min-height: 44px;
  }
  /* iOS Safari force-zooms the page when a focused form control's
     font-size is under 16px — selects must read 16 on touch, and the
     fixed widths grow to keep the bigger text from truncating */
  .cascade-dock select { font-size: 16px; }
  .cascade-field select[data-preset]   { width: 140px; }
  .cascade-field select[data-colormode] { width: 100px; }
  .cascade-field select[data-scenario]  { width: 118px; }
  .cascade-sliders input[type='range'] { width: 90px; height: 40px; }
  .cascade-sliders input[type='range']::-webkit-slider-thumb { margin-top: -5px; }
}

/* mobile + narrow windows: the canvas IS the app — edge to edge. The
   measured --tool-top height already pins the dock inside the viewport;
   the 8px remainder clears the home indicator. */
@media (pointer: coarse), (max-width: 820px) {
  .cascade-simulator {
    min-height: 0;
    max-width: none;
    border-radius: 0;
  }
  .cascade-dock {
    margin-bottom: calc(6px + env(safe-area-inset-bottom, 0px));
    max-width: calc(100% - 8px);
    /* a fully-expanded dock can't be allowed to squeeze the canvas to
       zero — cap the INNER scroll well, not the dock itself: the
       zoom lens + gizmo anchor at top:-48px above the dock and
       overflow-y:auto would clip them (the iPhone missing-widgets
       bug). Dock stays overflow:visible; only the wells scroll. */
    overflow: visible;
    overscroll-behavior: contain;
    touch-action: manipulation;    /* rapid button taps must not
                                      trigger double-tap zoom */
  }
  .cascade-dock-scroll {
    max-height: 52vh;
    max-height: 52svh;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
  }
  /* both control wells must wrap — seven labeled selects and twelve
     transport buttons never fit one narrow row */
  .cascade-transport,
  .cascade-selects {
    flex-wrap: wrap;
    justify-content: center;
  }
  /* inject's six buttons exceed a phone dock — wrap inside the group
     instead of overflowing sideways */
  .cascade-grp-row { flex-wrap: wrap; justify-content: center; gap: 5px; }
  /* presets row stays ONE line on phones — the three selects +
     chips scroll horizontally instead of stacking into 3 rows */
  .grp-presets .cascade-grp-row {
    flex-wrap: nowrap;
    justify-content: flex-start;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .grp-presets .cascade-grp-row > em { display: none; }   /* label eats a row's worth of space */
  .cascade-field select[data-preset]   { width: 104px; }
  .cascade-field select[data-colormode] { width: 82px; }
  .cascade-field select[data-scenario]  { width: 92px; }
  /* bigger touch targets — the stacked layout already shares the
     on-dot with the icon row globally */
  .cascade-grp-row > button {
    min-height: 44px;
    padding: 4px 9px;
  }
  .cascade-grp-row > button .g { font-size: 17px; }
  .cascade-grp-row > button .l { font-size: 8px; letter-spacing: 0.05em; }
  /* accordion chips inside the presets row stay horizontal chips —
     the row's stacked-button rules would otherwise inflate them */
  .cascade-grp-row > button.cascade-accbtn {
    flex-direction: row;
    font: 10px monospace;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    min-width: 0;
    min-height: 30px;
    padding: 2px 9px;
    gap: 4px;
  }
  /* status text clamped on phones — a 5-line say() shouldn't cover
     a third of the canvas */
  .cascade-status {
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .cascade-field { gap: 4px; }
  .cascade-field > span { font-size: 9px; }
  /* tighter select padding — the iOS 16px font needs every px
     of text room it can get inside the fixed widths */
  .cascade-dock select { padding: 0 12px 0 5px; }
}

/* phones: shrink the secondary chrome so the HUD keeps the corner */
@media (max-width: 560px) {
  .cascade-graph {
    top: 46px;
    right: 6px;
    width: 110px;
    height: 40px;
  }
  /* the gizmo stays an overlay chip on phones — smaller, tucked into
     the corner, dimmed so it reads as chrome not a control row */
  .cascade-gizmo {
    width: 42px;
    height: 42px;
    right: 52px;
    top: -48px;      /* above the dock — inside-the-dock gets
                        clipped by the dock's mobile overflow */
    opacity: 0.65;
  }
  .cascade-zoomlens {
    width: 42px;
    height: 42px;
    right: 6px;
    top: -48px;
  }
}

/* short viewports of any kind (wide but landscape-short, split-screen):
   same fit — min-height yields instead of pushing the dock off-screen */
@media (max-height: 640px) {
  .cascade-simulator { min-height: 0; }
}
</style>

<style>
/* Suppress VitePress chrome that overlays or displaces the simulator —
   .VPLocalNav is the strip carrying the outline dropdown and the
   "Return to top" button; it sits above the canvas and consumes ~48px
   of the viewport the svh calculation assumed it owned. */
.cascade-page .VPDocFooter,
.cascade-page .VPBackToTop,
.cascade-page .VPLocalNav,
.cascade-page .aside-top {
  display: none !important;
}
/* Orbiting/pinch on mobile must not bounce or pull-to-refresh the page. */
html:has(.cascade-simulator) {
  overscroll-behavior: none;
}
/* .VPNav is sticky (in-flow) on this theme, so VitePress's
   padding-top: var(--vp-nav-height) — meant to clear a fixed nav —
   is a dead band below the navbar. Reclaim it at all widths. */
.cascade-page .VPContent { padding-top: 0 !important; }
/* Page prose: doc typography + article width, same as the rest of the site.
   (layout: page renders raw Content with no .vp-doc wrapper — we add the
   class in cascade-demo.md and constrain it here.) */
.cascade-page .cascade-doc {
  max-width: 768px;
  margin: 0 auto;
  padding: 24px 24px 72px;
}
</style>
