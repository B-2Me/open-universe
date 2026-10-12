<script setup>
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { withBase } from 'vitepress'

const host = ref(null)
const knots = ref([])
const current = ref(null)
const spinning = ref(true)
const railOpen = ref(true)
const status = ref('booting…')
let zoo = null

const fmtMass = (q) => q >= 1e6 ? `${(q / 1e6).toFixed(2)}M` : q >= 1e3 ? `${(q / 1e3).toFixed(0)}k` : q
const select = async (k) => {
  current.value = k
  status.value = 'loading…'
  try {
    await zoo.load(k)
    status.value = 'ok'
  } catch (e) {
    status.value = 'ERR ' + (e?.message || e)
  }
}
const toggleSpin = () => { spinning.value = !spinning.value; zoo?.setAutoRotate(spinning.value) }

const preset = ref('orbit')
const setPreset = (p) => { preset.value = p; zoo?.setPreset(p) }

const colorModes = ['spin', 'tension', 'quanta']
const colorMode = ref('spin')
const cycleColor = () => {
  colorMode.value = colorModes[(colorModes.indexOf(colorMode.value) + 1) % colorModes.length]
  zoo?.setColorMode(colorMode.value)
}

const clipOn = ref(false)
const clipT = ref(50)
const applyClip = () => zoo?.setClip(clipOn.value, clipT.value / 100)

onMounted(async () => {
  document.body.classList.add('zoo-page')
  if (matchMedia('(pointer: coarse)').matches) railOpen.value = false
  try {
    const res = await fetch(withBase('/zoo/index.json'))
    const manifest = await res.json()
    knots.value = manifest.knots ?? []
    if (!knots.value.length) { status.value = 'dictionary empty — run script/export-zoo.mjs'; return }
    const { initZoo } = await import('../zoo/main.js')
    zoo = initZoo(host.value, withBase('/'))
    // Heaviest knot front and center — the flagship.
    await select(knots.value[knots.value.length - 1])
  } catch (e) {
    status.value = 'ERR ' + (e?.message || e)
    console.error(e)
  }
})
onUnmounted(() => {
  document.body.classList.remove('zoo-page')
  zoo?.dispose()
})
</script>

<template>
  <div ref="host" class="zoo-sim">
    <div class="zoo-canvas" data-canvas></div>
    <div class="zoo-vignette" aria-hidden="true"></div>

    <div class="zoo-card" data-hud>
      <template v-if="current">
        <div class="zoo-card-name">{{ current.name }}</div>
        <div class="zoo-card-stats">
          <div><span>Mass</span><b>{{ fmtMass(current.mass) }}q</b></div>
          <div><span>Loops</span><b>{{ current.loops }}</b></div>
          <div><span>Aspect</span><b>{{ current.R0 }} : {{ current.R1 }}</b></div>
          <div><span>Cells</span><b>{{ current.cells.toLocaleString() }}</b></div>
          <div><span>Radius</span><b>{{ current.radiusXY }} × {{ current.radiusZ }}</b></div>
          <div><span>Grid</span><b>{{ current.dims.join('×') }}</b></div>
        </div>
        <div class="zoo-legend">
          <span><i class="eq"></i>equatorial</span>
          <span><i class="zen"></i>zenith</span>
          <span><i class="nad"></i>nadir</span>
        </div>
      </template>
      <div v-if="status !== 'ok'" class="zoo-card-status">{{ status }}</div>
    </div>
    <div class="zoo-ctrl">
      <button class="cbtn cbtn-gizmo" @click="zoo?.reset()" title="Orientation — click to reset view">
        <canvas data-gizmo width="72" height="72"></canvas>
      </button>
      <button class="cbtn" :class="{ on: preset === 'orbit' }" @click="setPreset('orbit')" title="¾ view">¾</button>
      <button class="cbtn" :class="{ on: preset === 'top' }" @click="setPreset('top')" title="Top-down">TOP</button>
      <button class="cbtn" :class="{ on: preset === 'side' }" @click="setPreset('side')" title="Edge-on">SIDE</button>
      <button class="cbtn" :class="{ on: spinning }" @click="toggleSpin" title="Auto-rotate">
        <i class="lvl"></i>⟳
      </button>
      <button class="cbtn cbtn-color" @click="cycleColor" :title="'Color by ' + colorMode">
        <i :class="colorMode"></i>{{ colorMode }}
      </button>
      <button class="cbtn" :class="{ on: clipOn }" @click="clipOn = !clipOn; applyClip()" title="Z cross-section">
        <i class="lvl"></i>Z✂
      </button>
      <input v-if="clipOn" class="zoo-slider" type="range" min="2" max="98" v-model.number="clipT" @input="applyClip">
    </div>

    <div class="zoo-index" :class="{ closed: !railOpen }">
      <button class="zoo-index-title" @click="railOpen = !railOpen"
              :title="railOpen ? 'Collapse specimens' : 'Expand specimens'">
        <span class="caret" :class="{ open: railOpen }">▸</span>
        SPECIMENS · {{ knots.length }}
      </button>
      <div class="zoo-rows" v-show="railOpen">
        <button v-for="k in knots" :key="k.name"
                class="zoo-row" :class="{ on: current && current.name === k.name }"
                @click="select(k)">
          <span class="zoo-row-name">{{ k.name }}</span>
          <span class="zoo-row-meta">{{ fmtMass(k.mass) }}q · {{ k.loops }}L</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.zoo-sim {
  position: relative;
  height: 80vh;
  height: 80dvh;
  min-height: 480px;
  max-width: 1200px;
  margin: 0 auto;
  background: #03010a;
  border-radius: 12px;
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
}
.zoo-canvas { position: absolute; inset: 0; }
.zoo-canvas :deep(canvas) { display: block; }

/* Cinematic vignette — darkens the frame edges over the render. */
.zoo-vignette {
  position: absolute; inset: 0; z-index: 2; pointer-events: none;
  background: radial-gradient(ellipse at center,
    transparent 42%,
    rgba(4, 1, 14, 0.38) 78%,
    rgba(2, 0, 10, 0.72) 100%);
}

.zoo-card {
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
.zoo-card-name {
  font-size: 13px;
  font-weight: 700;
  color: #7fe;
  letter-spacing: 0.06em;
  text-shadow: 0 0 8px rgba(0, 229, 255, 0.45);
  margin-bottom: 6px;
}
.zoo-card-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 12px;
}
.zoo-card-stats span {
  display: block;
  font-size: 8px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #7fd89a;
}
.zoo-card-stats b {
  font-size: 11px;
  font-weight: 600;
  color: #e8fff0;
}
.zoo-legend {
  display: flex;
  gap: 10px;
  margin-top: 8px;
  padding-top: 7px;
  border-top: 1px solid rgba(160, 200, 255, 0.12);
  font-size: 9px;
  color: #b9c8e8;
}
.zoo-legend i {
  display: inline-block;
  width: 8px; height: 8px;
  border-radius: 50%;
  margin-right: 4px;
  vertical-align: -1px;
}
.zoo-legend .eq { background: #ffa040; box-shadow: 0 0 6px #ffa04088; }
.zoo-legend .zen { background: #26d9ff; box-shadow: 0 0 6px #26d9ff88; }
.zoo-legend .nad { background: #a770ff; box-shadow: 0 0 6px #a770ff88; }
.zoo-card-status { color: #ffb0a0; margin-top: 4px; }

/* ── control bar (bottom center) ── */
.zoo-ctrl {
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
/* level-bubble toggle indicator — hollow ring off, filled glow on */
.cbtn .lvl {
  display: inline-block;
  width: 7px; height: 7px;
  border-radius: 50%;
  margin-right: 5px;
  vertical-align: 0;
  border: 1px solid #7fb0d8;
  background: transparent;
  transition: all 0.15s;
}
.cbtn.on .lvl {
  background: #7fe;
  border-color: #7fe;
  box-shadow: 0 0 7px rgba(119, 255, 238, 0.9);
}
.cbtn-color i {
  display: inline-block;
  width: 8px; height: 8px;
  border-radius: 50%;
  margin-right: 5px;
  vertical-align: -1px;
}
.cbtn-color i.spin { background: #ffa040; box-shadow: 0 0 6px #ffa040; }
.cbtn-color i.tension { background: #26d9ff; box-shadow: 0 0 6px #26d9ff; }
.cbtn-color i.quanta { background: #a770ff; box-shadow: 0 0 6px #a770ff; }
.zoo-slider {
  width: 90px;
  accent-color: #7fe;
  cursor: pointer;
}

.zoo-index {
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
.zoo-index.closed {
  width: auto;
  max-height: none;
  border-radius: 10px;
}
.zoo-index-title {
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
.zoo-index-title .caret {
  display: inline-block;
  font-size: 8px;
  color: #9ef;
  transition: transform 0.15s;
}
.zoo-index-title .caret.open { transform: rotate(90deg); }
.zoo-rows {
  overflow-y: auto;
  padding: 0 6px 8px;
  scrollbar-width: thin;
}
.zoo-row {
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
.zoo-row:hover { background: rgba(34, 49, 79, 0.55); }
.zoo-row.on {
  color: #7fe;
  background: rgba(119, 255, 238, 0.08);
  border-color: rgba(119, 255, 238, 0.4);
}
.zoo-row-meta { font-size: 9px; opacity: 0.65; }

@media (pointer: coarse) {
  .zoo-sim {
    height: 100vh;
    height: calc(100dvh - var(--vp-nav-height, 64px));
    min-height: 0;
    max-width: none;
    border-radius: 0;
  }
  .zoo-ctrl { bottom: calc(10px + env(safe-area-inset-bottom, 0px)); }
}
</style>

<style>
.zoo-page { overflow-x: hidden; background: #03010a; }
.zoo-page .VPDocFooter, .zoo-page .VPBackToTop { display: none !important; }
@media (pointer: coarse) {
  .zoo-page .VPContent { padding-top: var(--vp-nav-height, 64px) !important; }
}
.zoo-page .zoo-doc { max-width: 768px; margin: 0 auto; padding: 24px 24px 72px; }
</style>
