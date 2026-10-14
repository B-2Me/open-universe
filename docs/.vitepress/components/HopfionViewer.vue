<script setup>
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { withBase } from 'vitepress'

const host = ref(null)
const knots = ref([])
const current = ref(null)
const spinning = ref(true)
const railOpen = ref(true)
const status = ref('booting…')
let viewer = null

const fmtMass = (q) => q >= 1e6 ? `${(q / 1e6).toFixed(2)}M` : q >= 1e3 ? `${(q / 1e3).toFixed(0)}k` : q
const select = async (k) => {
  current.value = k
  status.value = 'loading…'
  try {
    await viewer.load(k)
    status.value = 'ok'
  } catch (e) {
    status.value = 'ERR ' + (e?.message || e)
  }
}
const toggleSpin = () => { spinning.value = !spinning.value; viewer?.setAutoRotate(spinning.value) }

const preset = ref('orbit')
const setPreset = (p) => { preset.value = p; viewer?.setPreset(p) }

const colorModes = ['spin', 'tension', 'quanta']
const colorMode = ref('spin')
const cycleColor = () => {
  colorMode.value = colorModes[(colorModes.indexOf(colorMode.value) + 1) % colorModes.length]
  viewer?.setColorMode(colorMode.value)
}

/* The control bar lives inside the canvas, and canvas touch gestures
   capture scrolling — so the sim must never be taller than the visible
   area above it. Measure the element's document offset and feed the
   CSS var, rather than guessing --vp-nav-height + margins. */
const fit = () => {
  const el = host.value
  if (!el) return
  el.style.setProperty('--tool-top', `${Math.round(el.getBoundingClientRect().top + window.scrollY)}px`)
}

onMounted(async () => {
  document.body.classList.add('hopfion-page')
  fit()
  requestAnimationFrame(fit)
  window.addEventListener('resize', fit)
  window.addEventListener('load', fit)
  if (matchMedia('(pointer: coarse)').matches) railOpen.value = false
  try {
    const res = await fetch(withBase('/hopfion/index.json'))
    const manifest = await res.json()
    knots.value = manifest.knots ?? []
    if (!knots.value.length) { status.value = 'dictionary empty — run script/export-zoo.mjs'; return }
    const { initHopfion } = await import('../hopfion/main.js')
    viewer = initHopfion(host.value, withBase('/'))
    // Heaviest knot front and center — the flagship.
    await select(knots.value[knots.value.length - 1])
  } catch (e) {
    status.value = 'ERR ' + (e?.message || e)
    console.error(e)
  }
})
onUnmounted(() => {
  document.body.classList.remove('hopfion-page')
  window.removeEventListener('resize', fit)
  window.removeEventListener('load', fit)
  viewer?.dispose()
})
</script>

<template>
  <div ref="host" class="hopfion-sim">
    <div class="hopfion-canvas" data-canvas></div>
    <div class="hopfion-vignette" aria-hidden="true"></div>

    <div class="hopfion-card" data-hud>
      <template v-if="current">
        <div class="hopfion-card-name">{{ current.name }}</div>
        <div class="hopfion-card-stats">
          <div><span>Mass</span><b>{{ fmtMass(current.mass) }}q</b></div>
          <div><span>Loops</span><b>{{ current.loops }}</b></div>
          <div><span>Aspect</span><b>{{ current.R0 }} : {{ current.R1 }}</b></div>
          <div><span>Cells</span><b>{{ current.cells.toLocaleString() }}</b></div>
          <div><span>Radius</span><b>{{ current.radiusXY }} × {{ current.radiusZ }}</b></div>
          <div><span>Grid</span><b>{{ current.dims.join('×') }}</b></div>
        </div>
        <div class="hopfion-legend">
          <span><i class="eq"></i>equatorial</span>
          <span><i class="zen"></i>zenith</span>
          <span><i class="nad"></i>nadir</span>
        </div>
      </template>
      <div v-if="status !== 'ok'" class="hopfion-card-status">{{ status }}</div>
    </div>
    <div class="hopfion-ctrl">
      <button class="cbtn cbtn-gizmo" @click="viewer?.reset()" title="Orientation — click to reset view">
        <canvas data-gizmo width="72" height="72"></canvas>
      </button>
      <div class="cseg">
        <button class="cbtn" :class="{ on: preset === 'orbit' }" @click="setPreset('orbit')" title="¾ view">¾</button>
        <button class="cbtn" :class="{ on: preset === 'top' }" @click="setPreset('top')" title="Top-down">TOP</button>
        <button class="cbtn" :class="{ on: preset === 'side' }" @click="setPreset('side')" title="Edge-on">SIDE</button>
        <button class="cbtn" :class="{ on: preset === 'cut' }" @click="setPreset('cut')" title="Slice open — see inside">CUT</button>
      </div>
      <button class="cbtn cbtn-tog" :class="{ on: spinning }" @click="toggleSpin" title="Auto-rotate">
        ⟳<i class="pl"></i>
      </button>
      <button class="cbtn cbtn-color" :class="colorMode" @click="cycleColor" :title="'Color by ' + colorMode">
        {{ colorMode }}
      </button>
    </div>

    <div class="hopfion-index" :class="{ closed: !railOpen }">
      <button class="hopfion-index-title" @click="railOpen = !railOpen"
              :title="railOpen ? 'Collapse specimens' : 'Expand specimens'">
        <span class="caret" :class="{ open: railOpen }"></span>
        SPECIMENS · {{ knots.length }}
      </button>
      <div class="hopfion-rows" v-show="railOpen">
        <button v-for="k in knots" :key="k.name"
                class="hopfion-row" :class="{ on: current && current.name === k.name }"
                @click="select(k)">
          <span class="hopfion-row-name">{{ k.name }}</span>
          <span class="hopfion-row-meta">{{ fmtMass(k.mass) }}q · {{ k.loops }}L</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hopfion-sim {
  position: relative;
  /* --tool-top is the element's measured document offset (set on mount);
     svh always reserves the browser URL-bar strip, so the control bar
     can't slide below the fold when chrome collapses. */
  height: calc(100vh - var(--tool-top, 76px) - 8px);
  height: calc(100svh - var(--tool-top, 76px) - 8px);
  min-height: 480px;
  max-width: 1200px;
  margin: 0 auto;
  background: #03010a;
  border-radius: 12px;
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
}
.hopfion-canvas { position: absolute; inset: 0; }
.hopfion-canvas :deep(canvas) { display: block; }

/* Cinematic vignette — darkens the frame edges over the render. */
.hopfion-vignette {
  position: absolute; inset: 0; z-index: 2; pointer-events: none;
  background: radial-gradient(ellipse at center,
    transparent 42%,
    rgba(4, 1, 14, 0.38) 78%,
    rgba(2, 0, 10, 0.72) 100%);
}

.hopfion-card {
  position: absolute;
  top: 10px; left: 10px;
  min-width: 172px;
  padding: 10px 14px 12px;
  font: 11px/1.5 monospace;
  color: #9ef;
  background: rgba(8, 6, 22, 0.62);
  border: 1px solid rgba(160, 200, 255, 0.16);
  border-radius: 12px;
  backdrop-filter: blur(12px);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.5);
  pointer-events: none;
  z-index: 3;
}
.hopfion-card-name {
  font-size: 13px;
  font-weight: 700;
  color: #7fe;
  letter-spacing: 0.06em;
  text-shadow: 0 0 8px rgba(0, 229, 255, 0.45);
  margin-bottom: 6px;
}
.hopfion-card-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 12px;
}
.hopfion-card-stats span {
  display: block;
  font-size: 8px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #7fd89a;
}
.hopfion-card-stats b {
  font-size: 11px;
  font-weight: 600;
  color: #e8fff0;
}
.hopfion-legend {
  display: flex;
  gap: 10px;
  margin-top: 8px;
  padding-top: 7px;
  border-top: 1px solid rgba(160, 200, 255, 0.12);
  font-size: 9px;
  color: #b9c8e8;
}
.hopfion-legend i {
  display: inline-block;
  width: 8px; height: 8px;
  border-radius: 50%;
  margin-right: 4px;
  vertical-align: -1px;
}
.hopfion-legend .eq { background: #ffa040; box-shadow: 0 0 6px #ffa04088; }
.hopfion-legend .zen { background: #26d9ff; box-shadow: 0 0 6px #26d9ff88; }
.hopfion-legend .nad { background: #a770ff; box-shadow: 0 0 6px #a770ff88; }
.hopfion-card-status { color: #ffb0a0; margin-top: 4px; }

/* ── control bar (bottom center) ── */
.hopfion-ctrl {
  position: absolute;
  left: 50%; bottom: 12px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  background: rgba(8, 6, 22, 0.62);
  border: 1px solid rgba(160, 200, 255, 0.16);
  border-radius: 12px;
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  z-index: 4;
}
.cbtn {
  min-width: 38px; height: 38px;
  padding: 0 9px;
  font: 700 10px monospace;
  letter-spacing: 0.06em;
  color: #9ef;
  background: rgba(30, 40, 80, 0.35);
  border: 1px solid rgba(160, 200, 255, 0.14);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.cbtn:hover { border-color: rgba(119, 255, 238, 0.5); color: #7fe; }
.cbtn.on {
  color: #7fe;
  background: rgba(119, 255, 238, 0.12);
  border-color: rgba(119, 255, 238, 0.55);
  box-shadow: 0 0 10px rgba(119, 255, 238, 0.2);
}
.cbtn-gizmo { padding: 0 3px; }
.cbtn-gizmo canvas { width: 30px; height: 30px; display: block; }
/* Segmented view selector — the presets are mutually exclusive, so they
   share one pill instead of looking like four independent buttons. */
.cseg {
  display: flex;
  border: 1px solid rgba(160, 200, 255, 0.14);
  border-radius: 8px;
  overflow: hidden;
}
.cseg .cbtn { border: none; border-radius: 0; }
.cseg .cbtn + .cbtn { border-left: 1px solid rgba(160, 200, 255, 0.14); }
/* Toggle pill — a level bar *under* the icon, clearly part of the
   button: hollow when off, filled when on. */
.cbtn-tog {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 14px;
}
.cbtn-tog .pl {
  display: block;
  width: 16px; height: 4px;
  border-radius: 2px;
  border: 1px solid #7fb0d8;
  background: transparent;
  transition: all 0.15s;
}
.cbtn-tog.on .pl {
  background: #7fe;
  border-color: #7fe;
  box-shadow: 0 0 7px rgba(119, 255, 238, 0.9);
}
/* Color-mode cycler — fixed width so the label swap can't resize the
   button; the background tint carries the state, not a dot. */
.cbtn-color {
  min-width: 92px;
  text-align: center;
  text-transform: uppercase;
}
.cbtn-color.spin    { background: rgba(255, 160, 64, 0.14); border-color: rgba(255, 160, 64, 0.45); }
.cbtn-color.tension { background: rgba(38, 217, 255, 0.13); border-color: rgba(38, 217, 255, 0.45); }
.cbtn-color.quanta  { background: rgba(167, 112, 255, 0.16); border-color: rgba(167, 112, 255, 0.5); }

.hopfion-index {
  position: absolute;
  top: 10px; right: 10px;
  width: 172px;
  max-height: calc(100% - 22px);
  display: flex;
  flex-direction: column;
  background: rgba(8, 6, 22, 0.55);
  border: 1px solid rgba(160, 200, 255, 0.16);
  border-radius: 14px;
  backdrop-filter: blur(12px);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.55);
  z-index: 3;
}
/* Collapsed = the header row alone, a small pill in the corner. */
.hopfion-index.closed {
  width: auto;
  max-height: none;
  border-radius: 10px;
}
.hopfion-index-title {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font: 700 9px monospace;
  letter-spacing: 0.14em;
  color: #7fd89a;
  background: none;
  border: none;
  cursor: pointer;
  white-space: nowrap;
}
.hopfion-index-title .caret {
  display: inline-block;
  width: 0; height: 0;
  border-top: 5px solid transparent;
  border-bottom: 5px solid transparent;
  border-left: 7px solid #9ef;
  transition: transform 0.15s;
}
.hopfion-index-title .caret.open { transform: rotate(90deg); }
.hopfion-rows {
  overflow-y: auto;
  padding: 0 6px 8px;
  scrollbar-width: thin;
}
.hopfion-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  width: 100%;
  padding: 6px 8px;
  margin-bottom: 2px;
  font: 11px monospace;
  color: #9ef;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
}
.hopfion-row:hover { background: rgba(34, 49, 79, 0.55); }
.hopfion-row.on {
  color: #7fe;
  background: rgba(119, 255, 238, 0.08);
  border-color: rgba(119, 255, 238, 0.4);
}
.hopfion-row-meta { font-size: 9px; opacity: 0.65; }

/* mobile + narrow windows: the canvas IS the app — edge to edge. The
   measured --tool-top height already pins the control bar inside the
   viewport; the 8px remainder clears the home indicator. */
@media (pointer: coarse), (max-width: 820px) {
  .hopfion-sim {
    min-height: 0;
    max-width: none;
    border-radius: 0;
  }
  .hopfion-ctrl { bottom: calc(10px + env(safe-area-inset-bottom, 0px)); }
}

/* short viewports of any kind: same fit — min-height yields instead of
   pushing the control bar off-screen */
@media (max-height: 640px) {
  .hopfion-sim { min-height: 0; }
}
</style>

<style>
.hopfion-page { overflow-x: hidden; background: #03010a; }
/* .VPLocalNav carries the outline dropdown + "Return to top" button —
   hiding the whole strip also reclaims ~48px above the canvas that the
   svh calculation assumed it owned. */
.hopfion-page .VPDocFooter,
.hopfion-page .VPBackToTop,
.hopfion-page .VPLocalNav,
.hopfion-page .aside-top {
  display: none !important;
}
@media (pointer: coarse), (max-width: 820px) {
  .hopfion-page .VPContent { padding-top: var(--vp-nav-height, 64px) !important; }
}
.hopfion-page .hopfion-doc { max-width: 768px; margin: 0 auto; padding: 24px 24px 72px; }
</style>
