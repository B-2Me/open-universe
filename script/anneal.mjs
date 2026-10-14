#!/usr/bin/env node
/*
 * anneal.mjs — chiral-arc nucleation probe for planck3.wasm.
 *
 * The kinematics campaign (frontier.md Stage 3) established that bound
 * structures cannot translate — three momentum mechanisms all fail. If
 * matter cannot MOVE, the remaining dynamics question is whether it can
 * GROW: does the lattice anneal an open chiral arc into a closed loop?
 *
 * Protocol:
 *   1. Load a dictionary seed, reconstruct its spin-cycle digraph
 *      (each painted cell's successor = the cell at its spin port —
 *      exact-traced loops make this a functional graph), extract the
 *      longest cycle.
 *   2. Keep a contiguous --arc fraction (default 0.75) of that cycle —
 *      an open streamline with a free head and a free tail.
 *   3. Spawn it, tick DURATION ticks, census each tick:
 *        - live cells, freeEnds (live cells whose spin-target is dead)
 *        - longest spin-cycle inside the live component (closure!)
 *        - head/tail positions (does the arc advance along the lattice?)
 *
 * Interpretation: the tail's outbound flux lands on a dead successor;
 * if that cell's induced spin chains back toward the head, the arc is
 * annealing closed. If the tail just piles mass into a straight-line
 * dead-end, arcs grow but never close — nucleation needs more.
 *
 *   node script/anneal.mjs --seed=hopfion_25_9 --arc=0.75 --ticks=300
 *
 * Results → logs/anneal-<seed>-<arc>.json; heartbeat →
 * logs/anneal-status.json.
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

const SEED = String(opt('seed', 'hopfion_25_9'));
const ARC = num('arc', 0.75);                 // fraction of the cycle kept
const TICKS = num('ticks', num('duration_ticks', 300));
const DISS = num('diss', 15), LIMIT = num('limit', 50000), MODE = num('mode', 0);
const SYNC = num('sync', 0);
const WASM_JS = resolve(ROOT, String(opt('wasm', 'docs/public/wasm/loom/planck3.js')));

// Per-parity port offsets — verbatim from planck3.c HOFF/POFF (index 0
// is padding; equatorial ports 1-6 are planar, zenith 7-9 lift via odd
// hex dirs, nadir 10-12 drop via even hex dirs).
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
const hb = (extra) => writeFileSync(join(LOGDIR, 'anneal-status.json'), JSON.stringify({ ts: Date.now(), ...extra }, null, 2));

// ---------- load seed, extract longest spin-cycle ----------
const seedPath = [SEED, `seeds256/${SEED}.json`, `seeds/${SEED}.json`].map(p => resolve(ROOT, p)).find(existsSync);
if (!seedPath) { console.error(`seed not found: ${SEED}`); process.exit(1); }
const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const [w, h, d] = seed.dims, n = w * h * d;
const idx = (x, y, z) => (z * h + y) * w + x;

// Painted set + successor map: succ(i) = neighbor at spin port.
const cellSet = new Map();               // idx → [x,y,z,s]
for (const [x, y, z, s] of seed.cells) cellSet.set(idx(x, y, z), [x, y, z, s]);
const succ = (i) => {
  const [x, y, z, s] = cellSet.get(i);
  if (!s) return -1;
  const c = step(x, y, z, s);
  const k = idx(c[0], c[1], c[2]);
  return cellSet.has(k) ? k : -1;
};

// Extract all cycles by walking the functional graph.
const visited = new Set(), cycles = [];
for (const i of cellSet.keys()) {
  if (visited.has(i)) continue;
  const path = [], seen = new Map();
  let cur = i;
  while (cur >= 0 && !seen.has(cur) && !visited.has(cur)) { seen.set(cur, path.length); path.push(cur); cur = succ(cur); }
  for (const j of path) visited.add(j);
  if (cur >= 0 && seen.has(cur)) cycles.push(path.slice(seen.get(cur)));
}
if (!cycles.length) { console.error('no spin-cycles in seed — cannot extract an arc'); process.exit(1); }
cycles.sort((a, b) => b.length - a.length);
const loop = cycles[0];
const arcLen = Math.max(8, Math.round(loop.length * ARC));
const arc = loop.slice(0, arcLen);       // contiguous subpath — open ends
const headI = arc[0], tailI = arc[arc.length - 1];
const arcCells = arc.map(i => cellSet.get(i));

console.log(`anneal: ${SEED} ${w}x${h}x${d} — ${cycles.length} cycles, longest ${loop.length} cells; ` +
  `arc keeps ${arcLen} (${(ARC * 100).toFixed(0)}%) — head ${cellSet.get(headI)} tail ${cellSet.get(tailI)}`);
console.log(`  loop census: ${cycles.map(c => c.length).join(', ')}`);

// ---------- spawn + run ----------
if (wasm._planck3_init_dims(w, h, d) !== 0) { console.error('init_dims rejected'); process.exit(1); }
wasm._planck3_set_dissipation(DISS);
wasm._planck3_set_thermal_limit(LIMIT);
wasm._planck3_set_mode(MODE);
if (wasm._planck3_set_sync) wasm._planck3_set_sync(SYNC);
wasm._planck3_reset_stats();

const buf = new Uint8Array(16 + n * 6);
const dv = new DataView(buf.buffer);
buf.set([0x50, 0x33, 0x53, 0x54]);
dv.setUint32(4, w, true); dv.setUint32(8, h, true); dv.setUint32(12, d, true);
const qp = buf.subarray(16, 16 + n), sp = buf.subarray(16 + n, 16 + 2 * n);
const hp = new DataView(buf.buffer, 16 + 4 * n, 2 * n);
for (const [x, y, z, s] of arcCells) {
  const i = idx(x, y, z);
  qp[i] = seed.q ?? 80; sp[i] = s; hp.setUint16(2 * i, seed.heat ?? 400, true);
}
hb({ phase: 'loading' });
const loadPtr = wasm._planck3_load_pointer();
heap8().set(buf, loadPtr);
if (wasm._planck3_load_commit() !== 0) { console.error('load_commit rejected'); process.exit(1); }
wasm._planck3_prepare();
let statePtr = wasm._planck3_state_pointer();

// Arc provenance mask.
const arcMask = new Uint8Array(n);
for (const i of arc) arcMask[i] = 1;

// Census: live cells, free ends (spin-target dead), longest live cycle.
const NB = [];
for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) for (const dz of [-1, 0, 1])
  if (dx || dy || dz) NB.push([dx, dy, dz]);
const dec = (i) => [i % w, ((i % (h * w)) / w) | 0, (i / (h * w)) | 0];

const census = () => {
  const mem = heap8();
  let live = 0, freeEnds = 0, arcLive = 0;
  const liveSet = new Set();
  for (let i = 0; i < n; i++) {
    if (mem[statePtr + i * 6] === 0) continue;
    live++; liveSet.add(i);
    if (arcMask[i]) arcLive++;
  }
  // Free ends: live cell whose spin port lands on a dead neighbor.
  for (const i of liveSet) {
    const s = mem[statePtr + i * 6 + 1];
    if (!s) { freeEnds++; continue; }
    const [x, y, z] = dec(i);
    const c = step(x, y, z, s);
    if (c[2] < 0 || c[2] >= d) { freeEnds++; continue; }
    const k = idx(((c[0] % w) + w) % w, ((c[1] % h) + h) % h, c[2]);
    if (!liveSet.has(k)) freeEnds++;
  }
  // Longest cycle among live cells (functional walk, bounded hops).
  const seen2 = new Set(); let maxCycle = 0;
  for (const i of liveSet) {
    if (seen2.has(i)) continue;
    const path = [], seen = new Map();
    let cur = i, hops = 0;
    while (cur >= 0 && !seen.has(cur) && !seen2.has(cur) && hops < 5000) {
      seen.set(cur, path.length); path.push(cur); seen2.add(cur); hops++;
      const s = mem[statePtr + cur * 6 + 1];
      if (!s || !liveSet.has(cur)) { cur = -1; break; }
      const [x, y, z] = dec(cur);
      const c = step(x, y, z, s);
      if (c[2] < 0 || c[2] >= d) { cur = -1; break; }
      const k = idx(((c[0] % w) + w) % w, ((c[1] % h) + h) % h, c[2]);
      cur = liveSet.has(k) ? k : -1;
    }
    if (cur >= 0 && seen.has(cur)) maxCycle = Math.max(maxCycle, path.length - seen.get(cur));
  }
  return { live, arcLive, freeEnds, maxCycle };
};

console.log(`  t      live  arcLive  freeEnds  maxCycle`);
const series = [];
const t0ms = Date.now();
for (let t = 0; t < TICKS; t++) {
  wasm._planck3_tick();
  statePtr = wasm._planck3_state_pointer();   // fixed since memcpy-back, kept robust
  const c = census();
  series.push({ t, ...c });
  if (t % 25 === 0 || t === TICKS - 1)
    console.log(`  t${t}: live=${c.live} arcLive=${c.arcLive} freeEnds=${c.freeEnds} maxCycle=${c.maxCycle}`);
  hb({ seed: SEED, arc: ARC, phase: 'ticking', t, ...c });
}

const out = {
  seed: SEED, arcFrac: ARC, dims: [w, h, d], ticks: TICKS, diss: DISS, limit: LIMIT,
  cycles: cycles.map(c => c.length), arcLen,
  head: cellSet.get(headI), tail: cellSet.get(tailI),
  ms: Date.now() - t0ms, series,
};
const outPath = join(LOGDIR, `anneal-${SEED}-${String(ARC).replace('.', 'p')}${SYNC ? '-sync' : ''}.json`);
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`\n→ ${outPath}`);
