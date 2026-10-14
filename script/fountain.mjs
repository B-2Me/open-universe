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
 * logs/fountain-<tag>-status.json.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  ROOT, LOGDIR, arg, loadConfig, opts, loadPlanck3, initEngine,
  nearestPort, packLoad, commitLoad, heartbeat, makeCensus, extractCycles,
} from './lib/p3.mjs';

const CFG = loadConfig();
const { opt, num } = opts(CFG);

const MODE = String(opt('mode', 'ring'));
const SEED = String(opt('seed', 'hopfion_25_9'));
const ARC = num('arc', 0.5);
const TICKS = num('ticks', num('duration_ticks', 400));
const DISS = num('diss', 15), LIMIT = num('limit', 50000), EMODE = num('emode', 0);
const SYNC = num('sync', 0);
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
const WASM_JS = String(opt('wasm', 'docs/public/wasm/loom/planck3.js'));

const wasm = await loadPlanck3(WASM_JS);

const tag = MODE === 'ring'
  ? `ring-r${RADIUS}-b${String(BIAS).replace('.', 'p')}-l${LEVEL}${FOAM ? '-f' + FOAM : ''}${PINCH ? '-p' + PINCH : ''}${PTENSION ? '-t' + PTENSION : ''}${SYNC ? '-sync' : ''}`
  : `tail-${SEED}-${String(ARC).replace('.', 'p')}-l${LEVEL}${FOAM ? '-f' + FOAM : ''}${PINCH ? '-p' + PINCH : ''}${PTENSION ? '-t' + PTENSION : ''}${SYNC ? '-sync' : ''}`;
const hb = heartbeat(`fountain-${tag}-status.json`, { mode: MODE });

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
  ({ cellSet, cycles } = extractCycles(seed.cells, w, h, d));
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
if (!initEngine(wasm, { w, h, d, diss: DISS, limit: LIMIT, mode: EMODE, sync: SYNC })) process.exit(1);

const { buf, q: qp, s: sp, heat: hp } = packLoad(w, h, d);
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
if (!commitLoad(wasm, buf)) process.exit(1);
let statePtr = wasm._planck3_state_pointer();

provenance = new Uint8Array(n);
for (const i of arcIdx) provenance[i] = 1;

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

const census = makeCensus(wasm, { w, h, d, getPtr: () => statePtr, provenance });

// ---------- run ----------
console.log(`  t      live  arcLive  freeEnds  maxCycle  nCycles  srcQ`);
const series = [];
const t0ms = Date.now();
let tNucleate = -1;
for (let t = 0; t < TICKS; t++) {
  // Sustained injection: force source cells BEFORE the tick reads state.
  const mem = wasm.heap8();
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
  { const m2 = wasm.heap8(); for (const [x, y, z] of sources) srcQ += m2[statePtr + idx(x, y, z) * 6]; }
  series.push({ t, ...c, srcQ });
  if (tNucleate < 0 && c.maxCycle > 10) tNucleate = t;
  if (t % 25 === 0 || t === TICKS - 1)
    console.log(`  t${t}: live=${c.live} arcLive=${c.arcLive} freeEnds=${c.freeEnds} maxCycle=${c.maxCycle} nCycles=${c.nCycles} srcQ=${srcQ}`);
  hb({ phase: 'ticking', t, level: LEVEL, ...c });
}

const out = {
  mode: MODE, seed: MODE === 'tail' ? SEED : null, arcFrac: MODE === 'tail' ? ARC : null,
  dims: [w, h, d], ticks: TICKS, diss: DISS, limit: LIMIT, level: LEVEL, sync: SYNC,
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
