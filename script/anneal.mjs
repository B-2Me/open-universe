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
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  ROOT, LOGDIR, arg, loadConfig, opts, loadPlanck3, initEngine,
  packLoad, commitLoad, heartbeat, makeCensus, extractCycles,
} from './lib/p3.mjs';

const CFG = loadConfig();
const { opt, num } = opts(CFG);

const SEED = String(opt('seed', 'hopfion_25_9'));
const ARC = num('arc', 0.75);                 // fraction of the cycle kept
const TICKS = num('ticks', num('duration_ticks', 300));
const DISS = num('diss', 15), LIMIT = num('limit', 50000), MODE = num('mode', 0);
const SYNC = num('sync', 0);
const WASM_JS = String(opt('wasm', 'docs/public/wasm/loom/planck3.js'));

const wasm = await loadPlanck3(WASM_JS);
const hb = heartbeat('anneal-status.json');

// ---------- load seed, extract longest spin-cycle ----------
const seedPath = [SEED, `seeds256/${SEED}.json`, `seeds/${SEED}.json`].map(p => resolve(ROOT, p)).find(existsSync);
if (!seedPath) { console.error(`seed not found: ${SEED}`); process.exit(1); }
const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const [w, h, d] = seed.dims, n = w * h * d;
const idx = (x, y, z) => (z * h + y) * w + x;

const { cellSet, cycles } = extractCycles(seed.cells, w, h, d);
if (!cycles.length) { console.error('no spin-cycles in seed — cannot extract an arc'); process.exit(1); }
const loop = cycles[0];
const arcLen = Math.max(8, Math.round(loop.length * ARC));
const arc = loop.slice(0, arcLen);       // contiguous subpath — open ends
const headI = arc[0], tailI = arc[arc.length - 1];
const arcCells = arc.map(i => cellSet.get(i));

console.log(`anneal: ${SEED} ${w}x${h}x${d} — ${cycles.length} cycles, longest ${loop.length} cells; ` +
  `arc keeps ${arcLen} (${(ARC * 100).toFixed(0)}%) — head ${cellSet.get(headI)} tail ${cellSet.get(tailI)}`);
console.log(`  loop census: ${cycles.map(c => c.length).join(', ')}`);

// ---------- spawn + run ----------
if (!initEngine(wasm, { w, h, d, diss: DISS, limit: LIMIT, mode: MODE, sync: SYNC })) process.exit(1);

const { buf, q: qp, s: sp, heat: hp } = packLoad(w, h, d);
for (const [x, y, z, s] of arcCells) {
  const i = idx(x, y, z);
  qp[i] = seed.q ?? 80; sp[i] = s; hp.setUint16(2 * i, seed.heat ?? 400, true);
}
hb({ phase: 'loading' });
if (!commitLoad(wasm, buf)) process.exit(1);
let statePtr = wasm._planck3_state_pointer();

// Arc provenance mask.
const arcMask = new Uint8Array(n);
for (const i of arc) arcMask[i] = 1;

const census = makeCensus(wasm, { w, h, d, getPtr: () => statePtr, provenance: arcMask });

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
