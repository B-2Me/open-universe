#!/usr/bin/env node
/*
 * fountain.mjs — sustained chiral-injection probe for planck3.wasm.
 *
 * The anneal campaign proved the lattice can REPAIR an open arc cut
 * from an existing loop — but every reclosure started from a fragment
 * of already-exact-traced topology. The strong "Cold Matter Inversion"
 * question is whether closure can be GROWN FROM FLUX: feed a sustained
 * stream of chiral momentum into the substrate and watch whether it
 * curls into a phase-locked cycle because that is the efficient route.
 *
 * Two injection modes:
 *
 *   --mode=tail   Load the longest spin-cycle from a dictionary seed,
 *                 keep an --arc fraction (same cut as anneal.mjs), then
 *                 force the tail cell every tick (quanta += level,
 *                 spin pinned). The tail's outbound flux pours onto its
 *                 dead successor continuously — does the growing strand
 *                 curl back and close, or is it just a fountain?
 *
 *   --mode=ring   No seed at all. A ring of --count aperture cells at
 *                 mid-plane z=zc, each forced per tick to quanta=level
 *                 and a spin quantized to (tangential + --bias·inward-
 *                 normal) — a rotating updraft, the lattice analogue of
 *                 a smoke-ring launcher. TRUE nucleation test: nothing
 *                 chiral is ever painted except the aperture spins.
 *
 * Telemetry per tick (same census as anneal.mjs): live cells, free
 * ends (live spin→dead target), longest live spin-cycle, plus count
 * of distinct nontrivial cycles (>2 cells). Nucleation signature:
 * maxCycle jumps to a nontrivial value AND persists while the stream
 * keeps feeding — freeEnds dropping to 0 under sustained injection
 * means the stream found a closed route, not just a basin.
 *
 *   node script/fountain.mjs --mode=ring --level=80 --radius=12 --bias=0.6
 *   node script/fountain.mjs --mode=tail --seed=hopfion_25_9 --arc=0.5 --level=80
 *   node script/fountain.mjs --mode=ring --foam=5 --foamheat=50   # confinement bath
 *
 * Results → logs/fountain-<mode>-*.json; heartbeat →
 * logs/fountain-status.json.
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

const arg = (k) => {
  const m = process.argv.find(a => a === `--${k}` || a.startsWith(`--${k}=`));
  return m ? (m.includes('=') ? m.split('=')[1] : true) : undefined;
};
const cfgPath = arg('config');
const CFG = cfgPath ? JSON.parse(readFileSync(resolve(ROOT, String(cfgPath)), 'utf8')) : {};
const opt = (k, d) => { const v = arg(k); return v !== undefined ? v : (CFG[k] !== undefined ? CFG[k] : d); };
const num = (k, d) => parseFloat(opt(k, d));

const MODE = String(opt('mode', 'ring'));
const SEED = String(opt('seed', 'hopfion_25_9'));
const ARC = num('arc', 0.5);
const TICKS = num('ticks', num('duration_ticks', 400));
const DISS = num('diss', 15), LIMIT = num('limit', 50000), EMODE = num('emode', 0);
const LEVEL = num('level', 80);        // quanta forced at sources/tick
const RADIUS = num('radius', 12);      // ring mode: aperture radius (cells)
const COUNT = num('count', 24);        // ring mode: aperture count
const BIAS = num('bias', 0.6);         // ring mode: z-component of tangent dir
const FOAM = num('foam', 0);           // ambient noise floor: quanta/cell at t0
const FOAMHEAT = num('foamheat', 50);  // ambient noise floor: heat/cell at t0
const FSEED = num('foamseed', 1);      // PRNG seed for the noise floor
const PINCH = num('pinch', 0);         // wall-shell inward quanta flux/tick
const PTENSION = num('ptension', 0);   // wall-shell tension register/tick — pressure
                                       // gradient WITHOUT mass injection (unlike
                                       // --pinch, which floods: quanta accumulate,
                                       // nothing drains them; tension decays)
const PSHELL = num('pshell', 2);       // pinch wall thickness (cells)
const W = num('w', 100), H = num('h', 100), D = num('d', 40);
const WASM_JS = resolve(ROOT, String(opt('wasm', 'docs/public/wasm/loom/planck3.js')));

// Per-parity port offsets — verbatim from planck3.c HOFF/POFF.
const HOFF = [
  [[0,0],[1,0],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1]],   // y even
  [[0,0],[1,0],[1,1],[0,1],[-1,0],[0,-1],[1,-1]],     // y odd
];
const ZU = [1, 3, 5], ZD = [2, 4, 6];
const step = (x, y, z, p) => {
  const par = y & 1;
  if (p <= 6) { const o = HOFF[par][p]; return [x + o[0], y + o[1], z]; }
  const j = (p - 7) % 3, up = p <= 9;
  const o = HOFF[par][(up ? ZU : ZD)[j]];
  return [x + o[0], y + o[1], z + (up ? 1 : -1)];
};

// Port direction vectors in the engine's fixed-point embedding
// (collide.mjs V3): planar ports length-256, axial ports FP-planar + FZ.
const HEX_MX = [0, 256, 128, -128, -256, -128, 128];
const HEX_MY = [0, 0, 222, 222, 0, -222, -222];
const FZ = 209, FP = 148;
const V3 = [null];
for (let s = 1; s <= 6; s++) V3.push([HEX_MX[s], HEX_MY[s], 0]);
for (const d of [1, 3, 5]) V3.push([Math.round(HEX_MX[d] * FP / 256), Math.round(HEX_MY[d] * FP / 256), FZ]);
for (const d of [2, 4, 6]) V3.push([Math.round(HEX_MX[d] * FP / 256), Math.round(HEX_MY[d] * FP / 256), -FZ]);

// Nearest port to a desired direction (same embedding as V3).
const nearestPort = (dx, dy, dz) => {
  let best = 1, bd = -Infinity;
  for (let p = 1; p <= 12; p++) {
    const dd = dx * V3[p][0] + dy * V3[p][1] + dz * V3[p][2];
    if (dd > bd) { bd = dd; best = p; }
  }
  return best;
};

// ---------- engine ----------
if (!existsSync(WASM_JS)) { console.error(`wasm glue not found: ${WASM_JS}`); process.exit(1); }
const glueSrc = readFileSync(WASM_JS, 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'require', '__dirname', '__filename',
  glueSrc)(mod, mod.exports, createRequire(WASM_JS), resolve(WASM_JS, '..'), WASM_JS);
const createPlanck3 = mod.exports;
if (typeof createPlanck3 !== 'function') { console.error('glue did not export createPlanck3'); process.exit(1); }
const wasm = await createPlanck3();
const heap8 = () => new Uint8Array(wasm.wasmMemory.buffer);

const LOGDIR = resolve(ROOT, 'logs');
mkdirSync(LOGDIR, { recursive: true });
const tag = MODE === 'ring'
  ? `ring-r${RADIUS}-b${String(BIAS).replace('.', 'p')}-l${LEVEL}${FOAM ? '-f' + FOAM : ''}${PINCH ? '-p' + PINCH : ''}${PTENSION ? '-t' + PTENSION : ''}`
  : `tail-${SEED}-${String(ARC).replace('.', 'p')}-l${LEVEL}${FOAM ? '-f' + FOAM : ''}${PINCH ? '-p' + PINCH : ''}${PTENSION ? '-t' + PTENSION : ''}`;
const hb = (extra) => writeFileSync(join(LOGDIR, `fountain-${tag}-status.json`), JSON.stringify({ ts: Date.now(), mode: MODE, ...extra }, null, 2));

// ---------- build source set ----------
let w = W, h = H, d = D;
let arcCells = [], arcIdx = [];
let sources = [];                        // [x,y,z,spin] forced each tick
let provenance = null;                   // tail mode: arc membership mask
let cycles = [], loop = [], headI = -1, tailI = -1, cellSet = null;

if (MODE === 'tail') {
  const seedPath = [SEED, `seeds256/${SEED}.json`, `seeds/${SEED}.json`].map(p => resolve(ROOT, p)).find(existsSync);
  if (!seedPath) { console.error(`seed not found: ${SEED}`); process.exit(1); }
  const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
  [w, h, d] = seed.dims;
  const n0 = w * h * d;
  const idx0 = (x, y, z) => (z * h + y) * w + x;
  cellSet = new Map();
  for (const [x, y, z, s] of seed.cells) cellSet.set(idx0(x, y, z), [x, y, z, s]);
  const succ = (i) => {
    const [x, y, z, s] = cellSet.get(i);
    if (!s) return -1;
    const c = step(x, y, z, s);
    const k = idx0(c[0], c[1], c[2]);
    return cellSet.has(k) ? k : -1;
  };
  const visited = new Set();
  for (const i of cellSet.keys()) {
    if (visited.has(i)) continue;
    const path = [], seen = new Map();
    let cur = i;
    while (cur >= 0 && !seen.has(cur) && !visited.has(cur)) { seen.set(cur, path.length); path.push(cur); cur = succ(cur); }
    for (const j of path) visited.add(j);
    if (cur >= 0 && seen.has(cur)) cycles.push(path.slice(seen.get(cur)));
  }
  cycles.sort((a, b) => b.length - a.length);
  loop = cycles[0];
  const arcLen = Math.max(8, Math.round(loop.length * ARC));
  arcIdx = loop.slice(0, arcLen);
  headI = arcIdx[0]; tailI = arcIdx[arcIdx.length - 1];
  arcCells = arcIdx.map(i => cellSet.get(i));
  // Sustained feed: pin the tail cell's quanta+spin every tick.
  const [tx, ty, tz, ts] = cellSet.get(tailI);
  sources.push([tx, ty, tz, ts]);
  console.log(`fountain tail: ${SEED} ${w}x${h}x${d} — ${cycles.length} cycles, longest ${loop.length}; ` +
    `arc ${arcIdx.length} (${(ARC * 100).toFixed(0)}%), feed at tail ${tx},${ty},${tz} s${ts}`);
} else if (MODE === 'ring') {
  // Ring of aperture cells at mid-plane, spins = tangential + z-bias.
  const cx = w >> 1, cy = h >> 1, zc = Math.min(d - 3, Math.max(2, d >> 2));
  const used = new Set();
  for (let k = 0; k < COUNT; k++) {
    const th = 2 * Math.PI * k / COUNT;
    // Embedding: E = (256x + 128y, 222y, 209z). Ring in xy-plane.
    const ex = RADIUS * 256 * Math.cos(th), ey = RADIUS * 222 * Math.sin(th);
    const ly = Math.round(ey / 222);
    const lx = Math.round((ex - 128 * ly) / 256);
    const x = cx + lx, y = cy + ly;
    const key = `${x},${y}`;
    if (used.has(key)) continue;
    used.add(key);
    // Desired spin: tangential (+z bias = updraft swirl).
    const txv = -Math.sin(th) * 256, tyv = Math.cos(th) * 222, tzv = BIAS * 209;
    const s = nearestPort(txv, tyv, tzv);
    sources.push([x, y, zc, s]);
  }
  console.log(`fountain ring: ${w}x${h}x${d} — ${sources.length} apertures r=${RADIUS} z=${zc} bias=${BIAS} level=${LEVEL}/tick`);
} else {
  console.error(`unknown mode: ${MODE} (tail|ring)`); process.exit(1);
}

const n = w * h * d;
const idx = (x, y, z) => (z * h + y) * w + x;

// ---------- init + spawn ----------
if (wasm._planck3_init_dims(w, h, d) !== 0) { console.error('init_dims rejected'); process.exit(1); }
wasm._planck3_set_dissipation(DISS);
wasm._planck3_set_thermal_limit(LIMIT);
wasm._planck3_set_mode(EMODE);
wasm._planck3_reset_stats();

const buf = new Uint8Array(16 + n * 6);
const dv = new DataView(buf.buffer);
buf.set([0x50, 0x33, 0x53, 0x54]);
dv.setUint32(4, w, true); dv.setUint32(8, h, true); dv.setUint32(12, d, true);
const qp = buf.subarray(16, 16 + n), sp = buf.subarray(16 + n, 16 + 2 * n);
const hp = new DataView(buf.buffer, 16 + 4 * n, 2 * n);
// Ambient foam: uniform disorganized noise floor. The stream must route
// THROUGH occupied cells — ambient congestion is the confinement
// hypothesis: a zero-impedance vacuum lets flux spray; a pressurized
// bath forces the stream to find the zero-friction closed loop.
if (FOAM > 0) {
  let rs = (FSEED >>> 0) || 1;                    // mulberry32 — deterministic
  const rnd = () => { rs |= 0; rs = (rs + 0x6D2B79F5) | 0; let t = Math.imul(rs ^ (rs >>> 15), 1 | rs); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = 0; i < n; i++) {
    qp[i] = FOAM;
    sp[i] = 1 + ((rnd() * 12) | 0);               // disorganized spin
    hp.setUint16(2 * i, FOAMHEAT, true);
  }
}
for (const [x, y, z, s] of arcCells) { const i = idx(x, y, z); qp[i] = 80; sp[i] = s; hp.setUint16(2 * i, 400, true); }
hb({ phase: 'loading' });
const loadPtr = wasm._planck3_load_pointer();
heap8().set(buf, loadPtr);
if (wasm._planck3_load_commit() !== 0) { console.error('load_commit rejected'); process.exit(1); }
wasm._planck3_prepare();
let statePtr = wasm._planck3_state_pointer();

provenance = new Uint8Array(n);
for (const i of arcIdx) provenance[i] = 1;
const srcMask = new Uint8Array(n);
for (const [x, y, z] of sources) srcMask[idx(x, y, z)] = 1;

// Acoustic pinch: the outer PSHELL-thick wall shell is forced each tick
// to quanta=PINCH with spin aimed at the grid center — convergent
// boundary pressure, a lattice-native confinement vessel. The fountain
// then has to curl inside a stagnation zone instead of spraying into
// zero-impedance vacuum.
const walls = [];
if (PINCH > 0 || PTENSION > 0) {
  const cx = (w - 1) / 2, cy = (h - 1) / 2, cz = (d - 1) / 2;
  for (let z = 0; z < d; z++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x >= PSHELL && x < w - PSHELL && y >= PSHELL && y < h - PSHELL && z >= PSHELL && z < d - PSHELL) continue;
    // Desired direction: toward center, in the V3 fixed-point embedding.
    const dx = (cx - x) * 256, dy = (cy - y) * 222, dz = (cz - z) * 209;
    walls.push([idx(x, y, z) * 6, nearestPort(dx, dy, dz)]);
  }
  console.log(`  walls: ${walls.length} shell cells — pinch=${PINCH}q ptension=${PTENSION}t /tick`);
}

// ---------- census (same as anneal.mjs) + nontrivial cycle count ----------
const dec = (i) => [i % w, ((i % (h * w)) / w) | 0, (i / (h * w)) | 0];
const census = () => {
  const mem = heap8();
  let live = 0, freeEnds = 0, arcLive = 0;
  const liveSet = new Set();
  for (let i = 0; i < n; i++) {
    if (mem[statePtr + i * 6] === 0) continue;
    live++; liveSet.add(i);
    if (provenance[i]) arcLive++;
  }
  for (const i of liveSet) {
    const s = mem[statePtr + i * 6 + 1];
    if (!s) { freeEnds++; continue; }
    const [x, y, z] = dec(i);
    const c = step(x, y, z, s);
    if (c[2] < 0 || c[2] >= d) { freeEnds++; continue; }
    const k = idx(((c[0] % w) + w) % w, ((c[1] % h) + h) % h, c[2]);
    if (!liveSet.has(k)) freeEnds++;
  }
  const seen2 = new Set(); let maxCycle = 0, nCycles = 0;
  for (const i of liveSet) {
    if (seen2.has(i)) continue;
    const path = [], seen = new Map();
    let cur = i, hops = 0;
    while (cur >= 0 && !seen.has(cur) && !seen2.has(cur) && hops < 5000) {
      seen.set(cur, path.length); path.push(cur); seen2.add(cur); hops++;
      const s = mem[statePtr + cur * 6 + 1];
      if (!s) { cur = -1; break; }
      const [x, y, z] = dec(cur);
      const c = step(x, y, z, s);
      if (c[2] < 0 || c[2] >= d) { cur = -1; break; }
      const k = idx(((c[0] % w) + w) % w, ((c[1] % h) + h) % h, c[2]);
      cur = liveSet.has(k) ? k : -1;
    }
    if (cur >= 0 && seen.has(cur)) {
      const len = path.length - seen.get(cur);
      if (len > maxCycle) maxCycle = len;
      if (len > 2) nCycles++;
    }
  }
  return { live, arcLive, freeEnds, maxCycle, nCycles };
};

// ---------- run ----------
console.log(`  t      live  arcLive  freeEnds  maxCycle  nCycles  srcQ`);
const series = [];
const t0ms = Date.now();
let tNucleate = -1;
for (let t = 0; t < TICKS; t++) {
  // Sustained injection: force source cells BEFORE the tick reads state.
  const mem = heap8();
  for (const [x, y, z, s] of sources) {
    const i = idx(x, y, z), o = statePtr + i * 6;
    mem[o] = Math.min(255, mem[o] + LEVEL);
    mem[o + 1] = s;
  }
  for (const [o, s] of walls) {
    if (PINCH > 0) { mem[statePtr + o] = PINCH; mem[statePtr + o + 1] = s; }
    if (PTENSION > 0) mem[statePtr + o + 5] = PTENSION;   // tension reg, no mass
  }
  wasm._planck3_tick();
  statePtr = wasm._planck3_state_pointer();
  const c = census();
  let srcQ = 0;
  { const m2 = heap8(); for (const [x, y, z] of sources) srcQ += m2[statePtr + idx(x, y, z) * 6]; }
  series.push({ t, ...c, srcQ });
  if (tNucleate < 0 && c.maxCycle > 10) tNucleate = t;
  if (t % 25 === 0 || t === TICKS - 1)
    console.log(`  t${t}: live=${c.live} arcLive=${c.arcLive} freeEnds=${c.freeEnds} maxCycle=${c.maxCycle} nCycles=${c.nCycles} srcQ=${srcQ}`);
  hb({ phase: 'ticking', t, level: LEVEL, ...c });
}

const out = {
  mode: MODE, seed: MODE === 'tail' ? SEED : null, arcFrac: MODE === 'tail' ? ARC : null,
  dims: [w, h, d], ticks: TICKS, diss: DISS, limit: LIMIT, level: LEVEL,
  foam: FOAM > 0 ? { quanta: FOAM, heat: FOAMHEAT, seed: FSEED } : null,
  pinch: PINCH > 0 ? { level: PINCH, shell: PSHELL, wallCells: walls.length } : null,
  ptension: PTENSION > 0 ? { level: PTENSION, shell: PSHELL, wallCells: walls.length } : null,
  ring: MODE === 'ring' ? { radius: RADIUS, count: COUNT, bias: BIAS } : null,
  cycles: cycles.map(c => c.length), arcLen: arcIdx.length,
  sources, tNucleate,
  ms: Date.now() - t0ms, series,
};
const outPath = join(LOGDIR, `fountain-${tag}.json`);
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`\n→ ${outPath}`);
