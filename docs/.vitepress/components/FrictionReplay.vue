<template>
  <div class="fr-wrap">
    <canvas
      ref="cv"
      class="fr-canvas"
      @pointerdown="dragStart"
      @pointermove="dragMove"
      @pointerup="dragEnd"
      @pointerleave="dragEnd"
    ></canvas>
    <div class="fr-hud">
      <div class="fr-phase" :class="phaseClass">{{ phaseLabel }}</div>
      <div class="fr-stats">
        t={{ cur ? cur.t : 0 }} · rest {{ cur && cur.rm ? cur.rm : 0 }}q
        <span v-if="cur && cur.rc">
          · lump ({{ cur.rc[0].toFixed(1) }}, {{ cur.rc[1].toFixed(1) }}, {{ cur.rc[2].toFixed(1) }})
        </span>
      </div>
    </div>
    <div class="fr-bar">
      <button class="fr-btn" @click="toggle">{{ playing ? '❚❚' : '▶' }}</button>
      <input
        class="fr-scrub" type="range" :min="0" :max="frames.length - 1"
        v-model.number="fi" @input="render"
      />
      <button class="fr-btn" @click="spin = !spin" :class="{ on: spin }">⟳</button>
    </div>
    <div class="fr-legend">
      <span class="dot mov"></span> moving flux
      <span class="dot rest"></span> parked heat
      <span class="dot cm"></span> rest-mass centroid
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const cv = ref(null)
const frames = ref([])
const phases = ref([])
const fi = ref(0)
const playing = ref(false)
const spin = ref(true)
const yaw = ref(0.7)
const pitch = ref(0.45)

let data = null, ctx, raf = 0, dragging = false, lx = 0, ly = 0, lastT = 0

const cur = computed(() => frames.value[fi.value])

const phaseLabel = computed(() => {
  const t = cur.value ? cur.value.t : 0
  if (t < 200) return 'DRIVEN — accreting while venting'
  if (t < 600) return 'QUIET — carrier-gated freeze'
  return 'BEAM — one-sided ablation drift'
})
const phaseClass = computed(() => {
  const t = cur.value ? cur.value.t : 0
  return t < 200 ? 'p-drive' : t < 600 ? 'p-quiet' : 'p-beam'
})

function load() {
  fetch('/data/lump-life.json')
    .then(r => r.json())
    .then(j => { data = j; frames.value = j.frames; phases.value = j.phases; render() })
}

function project(x, y, z, out) {
  // center on lattice mid, rotate yaw about z then pitch about x'
  const cx = x - 22, cy = y - 22, cz = z - 22
  const cyw = Math.cos(yaw.value), syw = Math.sin(yaw.value)
  const rx = cx * cyw - cy * syw
  const ry = cx * syw + cy * cyw
  const cp = Math.cos(pitch.value), sp = Math.sin(pitch.value)
  const ry2 = ry * cp - cz * sp
  const rz = ry * sp + cz * cp
  out[0] = rx; out[1] = ry2; out[2] = rz
}

function render() {
  const f = cur.value
  if (!f || !ctx || !data) return
  const w = cv.value.width, h = cv.value.height
  ctx.clearRect(0, 0, w, h)
  const scale = w / 44
  const v = f.v, pts = []
  const p = [0, 0, 0]
  for (let i = 0; i < v.length; i += 5) {
    project(v[i], v[i + 1], v[i + 2], p)
    pts.push([p[0], p[1], p[2], v[i + 3], v[i + 4]])
  }
  pts.sort((a, b) => b[2] - a[2])
  for (const [px, py, , rest, mov] of pts) {
    const sx = w / 2 + px * scale * 0.9
    const sy = h / 2 - py * scale * 0.9
    if (mov) {
      ctx.fillStyle = 'rgba(80,200,255,0.75)'
      ctx.fillRect(sx - 1, sy - 1, 2.5, 2.5)
    }
    if (rest) {
      const r = 1 + Math.sqrt(rest) * 0.55
      ctx.fillStyle = 'rgba(255,160,40,0.55)'
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.2832); ctx.fill()
      ctx.fillStyle = 'rgba(255,220,120,0.85)'
      ctx.beginPath(); ctx.arc(sx, sy, r * 0.45, 0, 6.2832); ctx.fill()
    }
  }
  // centroid marker
  if (f.rc) {
    project(f.rc[0], f.rc[1], f.rc[2], p)
    const sx = w / 2 + p[0] * scale * 0.9, sy = h / 2 - p[1] * scale * 0.9
    ctx.strokeStyle = 'rgba(120,255,140,0.9)'
    ctx.lineWidth = 1.4
    ctx.strokeRect(sx - 4, sy - 4, 8, 8)
  }
  // beam arrow during beam phase
  if (f.t >= 600) {
    ctx.strokeStyle = 'rgba(255,120,60,0.8)'
    ctx.lineWidth = 2
    const y0 = h * 0.82
    ctx.beginPath(); ctx.moveTo(w * 0.12, y0); ctx.lineTo(w * 0.32, y0)
    ctx.lineTo(w * 0.28, y0 - 6); ctx.moveTo(w * 0.32, y0); ctx.lineTo(w * 0.28, y0 + 6)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,120,60,0.8)'
    ctx.font = '11px monospace'
    ctx.fillText('carrier beam +x', w * 0.12, y0 + 16)
  }
}

function tick(now) {
  if (playing.value && frames.value.length) {
    if (now - lastT > 90) {
      fi.value = (fi.value + 1) % frames.value.length
      lastT = now
    }
  }
  if (spin.value && !dragging) yaw.value += 0.002
  render()
  raf = requestAnimationFrame(tick)
}

function toggle() { playing.value = !playing.value }
function dragStart(e) { dragging = true; lx = e.clientX; ly = e.clientY; cv.value.setPointerCapture(e.pointerId) }
function dragMove(e) {
  if (!dragging) return
  yaw.value += (e.clientX - lx) * 0.008
  pitch.value = Math.max(-1.4, Math.min(1.4, pitch.value + (e.clientY - ly) * 0.008))
  lx = e.clientX; ly = e.clientY
}
function dragEnd() { dragging = false }

function resize() {
  if (!cv.value) return
  const w = cv.value.clientWidth
  cv.value.width = Math.min(w, 720)
  cv.value.height = Math.round(cv.value.width * 0.72)
  render()
}

onMounted(() => {
  ctx = cv.value.getContext('2d')
  resize()
  window.addEventListener('resize', resize)
  load()
  raf = requestAnimationFrame(tick)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
})
</script>

<style scoped>
.fr-wrap {
  position: relative;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  overflow: hidden;
  background: #05070f;
}
.fr-canvas {
  width: 100%;
  display: block;
  cursor: grab;
  touch-action: none;
}
.fr-canvas:active { cursor: grabbing; }
.fr-hud {
  position: absolute; top: 10px; left: 10px; right: 10px;
  display: flex; justify-content: space-between; align-items: baseline;
  pointer-events: none; font-family: monospace; font-size: 12px;
}
.fr-phase { font-weight: 700; letter-spacing: 0.06em; }
.p-drive { color: #50c8ff; }
.p-quiet { color: #e0b060; }
.p-beam  { color: #ff7840; }
.fr-stats { color: #9fb4c8; }
.fr-bar {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; background: rgba(255,255,255,0.03);
}
.fr-btn {
  background: #14202e; color: #bfe0f0; border: 1px solid #2a3b4d;
  border-radius: 6px; width: 34px; height: 28px; cursor: pointer; font-size: 12px;
}
.fr-btn.on { border-color: #50c8ff; color: #50c8ff; }
.fr-scrub { flex: 1; accent-color: #50c8ff; }
.fr-legend {
  display: flex; gap: 18px; padding: 6px 14px;
  font-family: monospace; font-size: 11px; color: #8aa0b4;
}
.dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 5px; }
.dot.mov { background: #50c8ff; }
.dot.rest { background: #ffa028; }
.dot.cm { background: transparent; border: 1.5px solid #78ff8c; }
</style>
