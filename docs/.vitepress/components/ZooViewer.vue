<script setup>
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { withBase } from 'vitepress'

const host = ref(null)
const knots = ref([])
const current = ref(null)
const spinning = ref(true)
const status = ref('booting…')
let zoo = null

const fmtMass = (q) => q >= 1e6 ? `${(q / 1e6).toFixed(2)}M` : q >= 1e3 ? `${(q / 1e3).toFixed(0)}k` : q
const select = async (k) => {
  current.value = k
  status.value = 'loading…'
  try {
    await zoo.load(k)
    status.value = `${k.name} · ${fmtMass(k.mass)}q · ${k.loops} loops · r=(${k.radiusXY}, ${k.radiusZ})`
  } catch (e) {
    status.value = 'ERR ' + (e?.message || e)
  }
}
const toggleSpin = () => { spinning.value = !spinning.value; zoo?.setAutoRotate(spinning.value) }

onMounted(async () => {
  document.body.classList.add('zoo-page')
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

    <div class="zoo-hud" data-hud>{{ status }}</div>
    <button class="zoo-rotate" :class="{ on: spinning }" @click="toggleSpin"
            title="Auto-rotate" aria-label="Toggle auto-rotate">⟳</button>

    <div class="zoo-rail">
      <button v-for="k in knots" :key="k.name"
              class="zoo-chip" :class="{ on: current && current.name === k.name }"
              @click="select(k)" :title="`${k.name} — ${fmtMass(k.mass)}q, ${k.loops} loops`">
        <span class="zoo-chip-name">{{ k.name.replace('hopfion_', '') }}</span>
        <span class="zoo-chip-mass">{{ fmtMass(k.mass) }}</span>
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

.zoo-hud {
  position: absolute;
  top: 10px; left: 10px;
  padding: 5px 12px;
  font: 11px/1.5 monospace;
  color: #7fe;
  background: rgba(8, 6, 22, 0.55);
  border: 1px solid rgba(160, 200, 255, 0.16);
  border-radius: 10px;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.5);
  pointer-events: none;
  text-shadow: 0 0 6px rgba(0, 229, 255, 0.4);
  z-index: 3;
}

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

.zoo-rail {
  position: absolute;
  left: 50%; bottom: 12px;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
  max-width: calc(100% - 20px);
  padding: 8px 10px;
  overflow-x: auto;
  scrollbar-width: thin;
  background: rgba(8, 6, 22, 0.55);
  border: 1px solid rgba(160, 200, 255, 0.16);
  border-radius: 14px;
  backdrop-filter: blur(12px);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.55);
  z-index: 3;
}
.zoo-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  min-width: 58px;
  padding: 6px 8px;
  font: 11px monospace;
  color: #9ef;
  background: linear-gradient(180deg, rgba(34, 49, 79, 0.9), rgba(19, 28, 48, 0.9));
  border: 1px solid rgba(0, 0, 0, 0.65);
  border-radius: 9px;
  cursor: pointer;
  white-space: nowrap;
}
.zoo-chip.on {
  color: #04141c;
  background: #7fe;
  border-color: rgba(119, 255, 238, 0.8);
  box-shadow: 0 0 14px rgba(119, 255, 238, 0.4);
}
.zoo-chip-mass { font-size: 9px; opacity: 0.75; }

@media (pointer: coarse) {
  .zoo-sim {
    height: 100vh;
    height: calc(100dvh - var(--vp-nav-height, 64px));
    min-height: 0;
    max-width: none;
    border-radius: 0;
  }
  .zoo-rail { bottom: calc(10px + env(safe-area-inset-bottom, 0px)); }
}
</style>

<style>
.zoo-page .VPDocFooter, .zoo-page .VPBackToTop { display: none !important; }
@media (pointer: coarse) {
  .zoo-page .VPContent { padding-top: var(--vp-nav-height, 64px) !important; }
}
.zoo-page .zoo-doc { max-width: 768px; margin: 0 auto; padding: 24px 24px 72px; }
</style>
