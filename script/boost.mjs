#!/usr/bin/env node
/*
 * boost.mjs — kinematic interference basin for planck3.wasm.
 *
 * Tests the translational kinematics of stable dictionary knots:
 * instead of a naive wind tunnel, the basin couples thermodynamic
 * fluxes (quanta, tension, spin, heat) through the 12 True FCC routing
 * axes (24 with polarity) mapped onto the grid boundary walls, driven
 * by time-variant wave envelopes (constant / sine / ADSR) so no
 * unphysical step-function shockwave hits the lattice.
 *
 *   node script/boost.mjs --config=config/boost-pilot.json
 *
 * Config schema (all keys overridable by same-named CLI flags):
 *   seed:            "hopfion_32_8" — looked up in seeds256/, seeds/, or path
 *   vector:          0-23 — axis = v%12 (ports 1-12), polarity = v<12 ? inflow : reverse
 *   duration_ticks:  total simulation length
 *   wall_skin:       boundary slab thickness in planes (default 1)
 *   diss/limit/mode: engine knobs (defaults match the dictionary baseline)
 *   flux_profile:    { quanta, tension, spin, heat } each one of:
 *     { "type": "constant", "value": 5 }
 *     { "type": "sine", "amplitude": 5, "period": 20 }
 *     { "type": "adsr", "peak": 10, "attack": 50, "sustain": 100, "release": 50 }
 *
 * Each tick, BEFORE wasm._planck3_tick(): the evaluated magnitudes are
 * ADDED to source-wall node registers and SUBTRACTED on the sink wall
 * (macroscopic flux conservation — prevents standing-wave reflection).
 * quanta/tension clamp to u8, heat to u16. The spin register is a port
 * index (0-12), not an accumulator: a nonzero spin magnitude writes the
 * injection stream's own port direction on the source wall, and the
 * sink erases it to 0 — the only physically meaningful interpretation.
 *
 * Telemetry per tick: live-cell centroid, rolling 10-tick translation
 * velocity, mass retention. Summary reports translation, deflection
 * angle off the injected axis (chiral shear signature), and survival
 * (retain >= 0.95). Result JSON → logs/boost-<seed>-v<vector>.json.
 */
import { writeVtkFrame } from './vtk.mjs';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  ROOT, LOGDIR, loadConfig, opts, loadPlanck3, initEngine,
  V3, packLoad, commitLoad, heartbeat,
} from './lib/p3.mjs';

const CFG = loadConfig();
const { opt, num } = opts(CFG);

const SEED_NAME = String(opt('seed', 'hopfion_25_9'));
const VECTOR = num('vector', 1);               // 0-23; default port 2 (+X+Y) inflow
const TICKS = num('duration_ticks', num('ticks', 500));
const SKIN = num('wall_skin', 1);
const DISS = num('diss', 15), LIMIT = num('limit', 50000), MODE = num('mode', 0);
const SYNC = num('sync', 0);
const FLUX = CFG.flux_profile ?? {};
const VTK_EVERY = num('vtk-interval', num('vtk_interval', 0));   // 0 = off
const WASM_JS = String(opt('wasm', 'docs/public/wasm/loom/planck3.js'));

// ---------- wave envelope evaluator f(t) ----------
const envelope = (t, p) => {
  if (!p) return 0;
  switch (p.type) {
    case 'constant': return p.value ?? 0;
    case 'sine': return Math.round((p.amplitude ?? 0) * Math.sin((t / (p.period || 1)) * 2 * Math.PI));
    case 'adsr': {
      const { peak = 0, attack = 0, sustain = 0, release = 0 } = p;
      if (t < attack) return Math.round(peak * (attack ? t / attack : 1));
      if (t < attack + sustain) return peak;
      if (t < attack + sustain + release) return Math.round(peak * (1 - (t - attack - sustain) / (release || 1)));
      return 0;
    }
    default: return 0;
  }
};

// ---------- 24-vector → boundary-face map ----------
// Port vectors come from the shared lib (same fixed-point table as
// engine-sim.mjs / planck3.c: √(2/3)·256 axial, (1/√3)·256 planar).
const PORT = (VECTOR % 12) + 1;                 // axis → port 1-12
const POL = VECTOR < 12 ? 1 : -1;               // polarity: inflow vs reverse
const DIR = V3[PORT].map(c => Math.sign(c) * POL);
const DIRF = V3[PORT].map(c => c * POL / 256);  // unit-ish vector for deflection angle
// Antipodal port per port — for reversed polarity the stream still
// flows along DIR, so injected spin must point that way.
const REV3 = [0];
for (let a = 1; a <= 12; a++) {
  let best = 0, bd = Infinity;
  for (let b = 1; b <= 12; b++) {
    const dd = (V3[a][0] * V3[b][0] + V3[a][1] * V3[b][1] + V3[a][2] * V3[b][2]) >> 8;
    if (dd < bd) { bd = dd; best = b; }
  }
  REV3.push(best);
}
const STREAM_PORT = POL > 0 ? PORT : REV3[PORT];

// Node index = (z*h + y)*w + x — canonical flat layout.
// For a +component the source wall is the min face, sink the max face.
const wallIndices = (w, h, d, sign, axis) => {
  const out = [];
  const lo = sign > 0 ? 0 : [w, h, d][axis] - SKIN;
  const hi = lo + SKIN - 1;
  for (let z = 0; z < d; z++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = [x, y, z][axis];
    if (c >= lo && c <= hi) out.push((z * h + y) * w + x);
  }
  return out;
};

// ---------- load engine + seed ----------
const wasm = await loadPlanck3(WASM_JS);
const heap8 = wasm.heap8; // fresh view — growth detaches old ones

const seedPath = [SEED_NAME, `seeds256/${SEED_NAME}.json`, `seeds/${SEED_NAME}.json`]
  .map(p => resolve(ROOT, p)).find(existsSync);
if (!seedPath) { console.error(`seed not found: ${SEED_NAME} (tried seeds256/, seeds/)`); process.exit(1); }
const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const [w, h, d] = seed.dims, n = w * h * d;

// Build the two boundary slabs (deduped — edges belong to two faces but
// receive flux once).
const seen = new Uint8Array(n);
const srcWall = [], sinkWall = [];
for (let a = 0; a < 3; a++) {
  const s = DIR[a];
  if (!s) continue;
  for (const i of wallIndices(w, h, d, s, a)) if (!seen[i]) { seen[i] = 1; srcWall.push(i); }
}
seen.fill(0);
for (let a = 0; a < 3; a++) {
  const s = DIR[a];
  if (!s) continue;
  for (const i of wallIndices(w, h, d, -s, a)) if (!seen[i]) { seen[i] = 1; sinkWall.push(i); }
}

// ---------- run ----------
const hb = heartbeat('boost-status.json', {
  seed: seed.name || SEED_NAME, vector: VECTOR, dir: DIR, ticks: TICKS,
});

if (!initEngine(wasm, { w, h, d, diss: DISS, limit: LIMIT, mode: MODE, sync: SYNC })) process.exit(1);

// P3ST bulk-load (same channel as sweep.mjs).
const { buf, q: qp, s: sp2, heat: hp2 } = packLoad(w, h, d);
for (const [x, y, z, s] of seed.cells) {
  const i = (z * h + y) * w + x;
  qp[i] = seed.q; sp2[i] = s; hp2.setUint16(2 * i, seed.heat, true);
}
hb({ phase: 'loading', t: 0 });
if (!commitLoad(wasm, buf)) process.exit(1);

// g_rd/g_wr swap every tick — re-fetch after each _planck3_tick() or
// wall injects land in the write buffer half the time (silently eaten)
// and census reads a one-tick-stale frame on alternate ticks.
let statePtr = wasm._planck3_state_pointer();
const q0 = wasm._planck3_total_quanta();

// Register layout per node (6 bytes): u8 quanta, u8 spin, u16le heat,
// u8 buffer, u8 tension.
const inject = (t) => {
  const mq = envelope(t, FLUX.quanta), ms = envelope(t, FLUX.spin);
  const mh = envelope(t, FLUX.heat), mt = envelope(t, FLUX.tension);
  if (!mq && !ms && !mh && !mt) return;
  const mem = heap8(), dv = new DataView(mem.buffer);
  const spinPort = ms !== 0 ? STREAM_PORT : 0;
  for (const i of srcWall) {
    const p = statePtr + i * 6;
    if (mq) mem[p] = Math.min(255, mem[p] + mq);
    if (spinPort) mem[p + 1] = spinPort;
    if (mh) dv.setUint16(p + 2, Math.min(65535, dv.getUint16(p + 2, true) + mh), true);
    if (mt) mem[p + 5] = Math.min(255, mem[p + 5] + mt);
  }
  for (const i of sinkWall) {
    const p = statePtr + i * 6;
    if (mq) mem[p] = Math.max(0, mem[p] - mq);
    if (spinPort) mem[p + 1] = 0;
    if (mh) dv.setUint16(p + 2, Math.max(0, dv.getUint16(p + 2, true) - mh), true);
    if (mt) mem[p + 5] = Math.max(0, mem[p + 5] - mt);
  }
};

// Live-cell census in one pass. Two centroids:
//   `all`  = every quanta-bearing cell (spec literal).
//   `knot` = the connected live component still containing painted
//            matter — wall flood is a separate component until it
//            physically merges with the knot, so it cannot contaminate
//            the translation measurement. (Component BFS over the
//            ±1 box neighborhood — the 12 ports are all unit offsets.)
const painted = new Uint8Array(n);
for (const [x, y, z] of seed.cells) painted[(z * h + y) * w + x] = 1;
let paintedAlive = seed.cells.length;

const NB = [];
for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) for (const dz of [-1, 0, 1])
  if (dx || dy || dz) NB.push([dx, dy, dz]);

const visit = new Uint8Array(n);
const queue = new Int32Array(n);
const census = () => {
  const mem = heap8();
  let live = 0, sx = 0, sy = 0, sz = 0, seedIdx = -1;
  for (let i = 0; i < n; i++) {
    if (mem[statePtr + i * 6] === 0) continue;
    live++;
    sx += i % w; sy += ((i % (h * w)) / w) | 0; sz += (i / (h * w)) | 0;
    if (seedIdx < 0 && painted[i]) seedIdx = i;
  }
  let knot = null;
  if (seedIdx >= 0) {
    visit.fill(0);
    let head = 0, tail = 0, kl = 0, kq = 0, kx = 0, ky = 0, kz = 0;
    let kp = 0, px = 0, py = 0, pz = 0;
    queue[tail++] = seedIdx; visit[seedIdx] = 1;
    while (head < tail) {
      const i = queue[head++];
      const x = i % w, y = ((i % (h * w)) / w) | 0, z = (i / (h * w)) | 0;
      kl++; kq += mem[statePtr + i * 6]; kx += x; ky += y; kz += z;
      if (painted[i]) { kp++; px += x; py += y; pz += z; }
      for (const [dx, dy, dz] of NB) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h || nz < 0 || nz >= d) continue;
        const ni = (nz * h + ny) * w + nx;
        if (!visit[ni] && mem[statePtr + ni * 6] !== 0) { visit[ni] = 1; queue[tail++] = ni; }
      }
    }
    // `skeleton` = centroid of surviving painted cells only — immune to
    // accretion bias; it measures where the original loop skeleton went.
    knot = {
      live: kl, painted: kp, q: kq, x: kx / kl, y: ky / kl, z: kz / kl,
      skeleton: kp ? { x: px / kp, y: py / kp, z: pz / kp } : null,
    };
  }
  return { live, x: sx / live, y: sy / live, z: sz / live, knot };
};

console.log(`boost: ${seed.name || SEED_NAME} ${w}x${h}x${d} vector=${VECTOR} (port ${PORT}, dir ${DIR})`);
console.log(`walls: ${srcWall.length} src / ${sinkWall.length} sink nodes (skin ${SKIN}) · ticks=${TICKS} diss=${DISS} limit=${LIMIT}`);

const c0 = census();
if (!c0 || !c0.knot) { console.error('no live/spin-locked cells after load'); process.exit(1); }
const kq0 = c0.knot.q;
console.log(`t0: knot centroid=(${c0.knot.x.toFixed(2)},${c0.knot.y.toFixed(2)},${c0.knot.z.toFixed(2)}) ` +
  `knotQ=${kq0} live=${c0.live} q=${Math.round(q0)}`);

const skel0 = c0.knot.skeleton ?? c0.knot;       // skeleton = painted-cell centroid
const trail = [skel0];                           // rolling window for v10
const series = [];
let cLast = c0, aborted = false;
const t0ms = Date.now();
const VTK_DIR = VTK_EVERY ? join(LOGDIR, 'vtk', `boost-${seed.name || SEED_NAME}-v${VECTOR}`) : null;
if (VTK_DIR) mkdirSync(VTK_DIR, { recursive: true });
for (let t = 0; t < TICKS; t++) {
  if (VTK_DIR && t % VTK_EVERY === 0)
    writeVtkFrame({
      file: join(VTK_DIR, `frame_${String(t).padStart(5, '0')}.vtk`),
      w, h, d, statePtr, heap8, masks: { a: painted }, tick: t,
      title: `boost ${seed.name || SEED_NAME} v${VECTOR}`,
    });
  inject(t);
  wasm._planck3_tick();
  statePtr = wasm._planck3_state_pointer();     // buffer swap — see above
  const c = census();
  if (!c || !c.knot) { aborted = true; console.log(`t${t}: knot dissolved — aborting`); break; }
  const skel = c.knot.skeleton ?? c.knot;        // fall back to blob centroid if skeleton emptied
  trail.push(skel); if (trail.length > 11) trail.shift();
  const q = wasm._planck3_total_quanta();
  const retain = q / Math.max(1, q0);
  const kRetain = c.knot.q / Math.max(1, kq0);
  const win = trail[0], dt = trail.length - 1;
  const v = dt > 0 ? [(skel.x - win.x) / dt, (skel.y - win.y) / dt, (skel.z - win.z) / dt] : [0, 0, 0];
  const coherence = c.knot.painted / paintedAlive;
  series.push({
    t, kx: +skel.x.toFixed(3), ky: +skel.y.toFixed(3), kz: +skel.z.toFixed(3),
    bx: +c.knot.x.toFixed(3), by: +c.knot.y.toFixed(3), bz: +c.knot.z.toFixed(3),
    cx: +c.x.toFixed(3), cy: +c.y.toFixed(3), cz: +c.z.toFixed(3),
    live: c.live, knotLive: c.knot.live, knotQ: c.knot.q, q: Math.round(q),
    retain: +retain.toFixed(4), knotRetain: +kRetain.toFixed(4), coherence: +coherence.toFixed(4),
  });
  hb({ phase: 'ticking', t, kx: +skel.x.toFixed(2), ky: +skel.y.toFixed(2), kz: +skel.z.toFixed(2), knotRetain: +kRetain.toFixed(3), coherence: +coherence.toFixed(3) });
  if (t % 25 === 0 || t === TICKS - 1)
    console.log(`t${t}: skel=(${skel.x.toFixed(2)},${skel.y.toFixed(2)},${skel.z.toFixed(2)}) v10=(${v.map(x => x.toFixed(3))}) knotRetain=${kRetain.toFixed(3)} coherence=${coherence.toFixed(2)} massRetain=${retain.toFixed(3)}`);
  if (kRetain < 0.4) { aborted = true; console.log(`t${t}: catastrophic unwind (knotRetain ${kRetain.toFixed(2)})`); break; }
  cLast = c;
}

// ---------- summary ----------
const qEnd = wasm._planck3_total_quanta();
const retain = qEnd / Math.max(1, q0);
const kRetain = cLast.knot.q / Math.max(1, kq0);
const skelLast = cLast.knot.skeleton ?? cLast.knot;
const disp = [skelLast.x - skel0.x, skelLast.y - skel0.y, skelLast.z - skel0.z];
const dispMag = Math.hypot(...disp);
const dirMag = Math.hypot(...DIRF);
const deflect = dispMag > 0.5
  ? Math.acos(Math.max(-1, Math.min(1, (disp[0] * DIRF[0] + disp[1] * DIRF[1] + disp[2] * DIRF[2]) / (dispMag * dirMag)))) * 180 / Math.PI
  : null;
const verdict = aborted ? 'shattered' : kRetain >= 0.95 ? 'survived' : 'shredded';
console.log(`
BOOST RESULT — ${seed.name || SEED_NAME} vector ${VECTOR}
  knot translation: (${disp.map(x => x.toFixed(2)).join(', ')}) |${dispMag.toFixed(2)}| cells over ${series.length} ticks
  deflection:       ${deflect === null ? 'n/a (no displacement)' : deflect.toFixed(1) + '°'} off injected axis ${DIR}
  survival:         ${verdict} — knotRetain ${kRetain.toFixed(3)} coherence ${(cLast.knot.painted / paintedAlive).toFixed(3)} (knot live ${c0.knot.live}→${cLast.knot.live}) total retain ${retain.toFixed(3)} in ${((Date.now() - t0ms) / 1000).toFixed(0)}s`);

const rec = {
  seed: seed.name || SEED_NAME, dims: seed.dims, vector: VECTOR, port: PORT, dir: DIR,
  ticks: series.length, diss: DISS, limit: LIMIT, mode: MODE, flux: FLUX,
  centroid0: { x: +skel0.x.toFixed(3), y: +skel0.y.toFixed(3), z: +skel0.z.toFixed(3) },
  centroidEnd: { x: +skelLast.x.toFixed(3), y: +skelLast.y.toFixed(3), z: +skelLast.z.toFixed(3) },
  displacement: disp.map(x => +x.toFixed(3)),
  deflectionDeg: deflect === null ? null : +deflect.toFixed(2),
  mass0: Math.round(q0), massEnd: Math.round(qEnd), retain: +retain.toFixed(4),
  knotQ0: kq0, knotQEnd: cLast.knot.q, knotRetain: +kRetain.toFixed(4),
  coherence: +(cLast.knot.painted / paintedAlive).toFixed(4),
  verdict, ms: Date.now() - t0ms, series,
};
const out = join(LOGDIR, `boost-${rec.seed}-v${VECTOR}${SYNC ? '-sync' : ''}.json`);
writeFileSync(out, JSON.stringify(rec, null, 2));
hb({ phase: 'done', verdict });
console.log(`→ ${out}`);
