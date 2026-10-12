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
    <button class="zoo-rotate" :class="{ on: spinning }" @click="toggleSpin"
            title="Auto-rotate" aria-label="Toggle auto-rotate">⟳</button>

    <button class="zoo-indexbtn" @click="railOpen = !railOpen"
            :title="railOpen ? 'Hide specimens' : 'Show specimens'">≡</button>
    <div class="zoo-index" :class="{ closed: !railOpen }">
      <div class="zoo-index-title">SPECIMENS · {{ knots.length }}</div>
      <button v-for="k in knots" :key="k.name"
              class="zoo-row" :class="{ on: current && current.name === k.name }"
              @click="select(k)">
        <span class="zoo-row-name">{{ k.name }}</span>
        <span class="zoo-row-meta">{{ fmtMass(k.mass) }}q · {{ k.loops }}L</span>
      </button>
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

.zoo-rotate {
  position: absolute;
  top: 10px; right: 10px;
  width: 38px; height: 38px;
  font: 16px monospace;
  color: #9ef;
  background: rgba(8, 6, 22, 0.55);
  border: 1px solid rgba(160, 200, 255, 0.16);
  border-radius: 10px;
  backdrop-filter: blur(10px);
  cursor: pointer;
  z-index: 3;
}
.zoo-rotate.on { color: #7fe; border-color: rgba(119, 255, 238, 0.5); box-shadow: 0 0 12px rgba(119, 255, 238, 0.25); }

.zoo-indexbtn {
  position: absolute;
  top: 10px; right: 56px;
  width: 38px; height: 38px;
  font: 16px/1 monospace;
  color: #9ef;
  background: rgba(8, 6, 22, 0.55);
  border: 1px solid rgba(160, 200, 255, 0.16);
  border-radius: 10px;
  backdrop-filter: blur(10px);
  cursor: pointer;
  z-index: 3;
}
.zoo-index {
  position: absolute;
  top: 54px; right: 10px; bottom: 12px;
  width: 172px;
  overflow-y: auto;
  padding: 8px 6px;
  scrollbar-width: thin;
  background: rgba(8, 6, 22, 0.55);
  border: 1px solid rgba(160, 200, 255, 0.16);
  border-radius: 14px;
  backdrop-filter: blur(12px);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.55);
  z-index: 3;
  transition: transform 0.22s, opacity 0.22s;
}
.zoo-index.closed { transform: translateX(120%); opacity: 0; pointer-events: none; }
.zoo-index-title {
  font: 700 9px monospace;
  letter-spacing: 0.14em;
  color: #7fd89a;
  padding: 2px 8px 8px;
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
  .zoo-index { bottom: calc(10px + env(safe-area-inset-bottom, 0px)); }
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
