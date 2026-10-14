#!/usr/bin/env node
/*
 * sweep.mjs — headless thermodynamic harness for planck3.wasm.
 *
 * Feeds pathfinder.mjs seed geometries to the real engine and records
 * whether each knot survives the field's metabolism — the "Particle
 * Dictionary" pass: stable knots are the substrate's geometric
 * eigenvalues; we log their invariant mass and cross-sectional radius.
 * (Per the spec: these are LOCAL calibration telemetry — particles of
 * THIS universe at THIS ambient tension, not Standard Model matches.)
 *
 *   node script/sweep.mjs --seeds=seeds [--ticks=400] [options]
 *
 * Options (CLI > --config file > defaults):
 *   --seeds=seeds       seed JSON file or directory of them
 *   --only=a,b,c        curate: only these seed names
 *   --config=x.json     options file (same keys as flags)
 *   --ticks=400         ticks per candidate
 *   --sample=25         telemetry window
 *   --diss=15           dissipation (engine knob)
 *   --limit=50000       thermal limit (ambient tension — Earth's foam)
 *   --mode=0            engine: 0=flat 1=halo 2=ordered (flat is canonical)
 *   --pass-retain=0.85  min final/initial mass ratio to pass
 *   --pass-spray=0.05   max sprayed-mass fraction of initial mass
 *   --out=knot_dictionary.json
 *   --fresh             ignore prior dictionary entries (default: resume)
 *   --wasm=docs/public/wasm/loom/planck3.js
 *
 * Resume: the dictionary is rewritten atomically after EVERY candidate.
 * Re-running the same command skips entries whose signature
 * (name|dims|ticks|diss|limit|mode) already passed or failed — so a
 * crashed/killed run picks up where it left off, not from zero.
 */
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, writeFileSync, renameSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

const arg = (k) => {
  const m = process.argv.find(a => a === `--${k}` || a.startsWith(`--${k}=`));
  return m ? (m.includes('=') ? m.split('=')[1] : true) : undefined;
};
// --config=x.json seeds defaults; CLI flags always win.
const cfgPath = arg('config');
const CFG = cfgPath ? JSON.parse(readFileSync(resolve(ROOT, String(cfgPath)), 'utf8')) : {};
const opt = (k, d) => { const v = arg(k); return v !== undefined ? v : (CFG[k] !== undefined ? CFG[k] : d); };
const num = (k, d) => parseFloat(opt(k, d));

const SEEDS = resolve(ROOT, String(opt('seeds', 'seeds')));
const TICKS = num('ticks', 400), SAMPLE = num('sample', 25);
const DISS = num('diss', 15), LIMIT = num('limit', 50000);
const MODE = num('mode', 0);
const SYNC = num('sync', 0);           // synchronous update (deferred pushes)
const PASS_RETAIN = num('pass-retain', 0.85), PASS_SPRAY = num('pass-spray', 0.05);
const OUT = resolve(ROOT, String(opt('out', 'knot_dictionary.json')));
const WASM_JS = resolve(ROOT, String(opt('wasm', 'docs/public/wasm/loom/planck3.js')));
const ONLY = opt('only', null) ? String(opt('only')).split(',') : null;
const FRESH = !!arg('fresh');

// ---------- load the engine ----------
// The repo is "type": "module", so a plain require() would treat the
// Emscripten glue as ESM and its module.exports tail would never run.
// Wrap the source in a Function with CJS bindings instead — the glue
// resolves planck3.wasm via its own __dirname.
if (!existsSync(WASM_JS)) { console.error(`wasm glue not found: ${WASM_JS} — run src/build.sh first`); process.exit(1); }
const glueSrc = readFileSync(WASM_JS, 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'require', '__dirname', '__filename',
  glueSrc)(mod, mod.exports, createRequire(WASM_JS),
  resolve(WASM_JS, '..'), WASM_JS);
const createPlanck3 = mod.exports;
if (typeof createPlanck3 !== 'function') { console.error('glue did not export createPlanck3'); process.exit(1); }
const wasm = await createPlanck3();
const heap8 = () => new Uint8Array(wasm.wasmMemory.buffer); // fresh view — growth detaches old ones

// ---------- seed enumeration ----------
let files = statSync(SEEDS).isDirectory()
  ? readdirSync(SEEDS).filter(f => f.startsWith('hopfion') && f.endsWith('.json')).map(f => join(SEEDS, f))
  : [SEEDS];
if (ONLY) files = files.filter(f => ONLY.includes(basename(f, '.json')));
if (!files.length) { console.error(`no seed geometries under ${SEEDS}`); process.exit(1); }

// P3ST pack: 16B header + q,s,b,tn byte planes + u16le heat plane.
const packState = (w, h, d, cells, q0, h0) => {
  const n = w * h * d;
  const buf = new Uint8Array(16 + n * 6);
  const dv = new DataView(buf.buffer);
  buf.set([0x50, 0x33, 0x53, 0x54]); // "P3ST"
  dv.setUint32(4, w, true); dv.setUint32(8, h, true); dv.setUint32(12, d, true);
  const q = buf.subarray(16, 16 + n), s = buf.subarray(16 + n, 16 + 2 * n);
  const hp = new DataView(buf.buffer, 16 + 4 * n, 2 * n);
  for (const [x, y, z, sp] of cells) {
    const i = (z * h + y) * w + x;
    q[i] = q0; s[i] = sp; hp.setUint16(2 * i, h0, true);
  }
  return buf;
};

// Geometry probe: live-cell census, centroid, RMS radii — reads the
// canonical flat state straight from wasm memory (one pass).
const probe = (w, h, n, statePtr) => {
  const mem = heap8();
  let live = 0, sx = 0, sy = 0, sz = 0;
  const xs = [], ys = [], zs = [];
  for (let i = 0; i < n; i++) {
    if (mem[statePtr + i * 6] === 0) continue;
    live++;
    const x = i % w, y = ((i % (h * w)) / w) | 0, z = (i / (h * w)) | 0;
    sx += x; sy += y; sz += z; xs.push(x); ys.push(y); zs.push(z);
  }
  if (!live) return { live: 0, rxy: 0, rz: 0 };
  const cx = sx / live, cy = sy / live, cz = sz / live;
  let vxy = 0, vz = 0;
  for (let k = 0; k < live; k++) {
    vxy += (xs[k] - cx) ** 2 + (ys[k] - cy) ** 2;
    vz += (zs[k] - cz) ** 2;
  }
  return { live, rxy: +Math.sqrt(vxy / live).toFixed(2), rz: +Math.sqrt(vz / live).toFixed(2) };
};

// ---------- sweep ----------
// Resume: merge a prior dictionary and skip signature-matched entries.
// A signature pins the run parameters — same name under different
// physics is a different measurement, not a duplicate.
// Sync runs get a distinct signature so they can't collide with (or
// impersonate) legacy entries; legacy sigs stay byte-identical.
const sig = (name, dims) => `${name}|${dims.join('x')}|t${TICKS}|d${DISS}|l${LIMIT}|m${MODE}${SYNC ? '|y1' : ''}`;
let dict = { generated: new Date().toISOString(), ticks: TICKS, diss: DISS, limit: LIMIT, mode: MODE, entries: [] };
const done = new Set();
if (!FRESH && existsSync(OUT)) {
  try {
    dict = JSON.parse(readFileSync(OUT, 'utf8'));
    for (const e of dict.entries ?? []) if (e.sig) done.add(e.sig);
    if (done.size) console.log(`resume: ${done.size} completed entries loaded from ${OUT}`);
  } catch { console.warn(`could not parse prior ${OUT} — starting fresh`); }
}
const flush = () => {  // atomic rewrite — safe against a kill mid-candidate
  writeFileSync(OUT + '.tmp', JSON.stringify(dict, null, 2));
  renameSync(OUT + '.tmp', OUT);
};
// Live heartbeat for script/status.mjs — rewritten every telemetry
// window so an observer sees mid-candidate progress, not just
// completed entries.
const LOGDIR = resolve(ROOT, 'logs');
mkdirSync(LOGDIR, { recursive: true });
const sweepStart = Date.now();
const hb = (extra) => writeFileSync(join(LOGDIR, 'status.json'), JSON.stringify({
  ts: Date.now(), started: sweepStart, config: { ticks: TICKS, sample: SAMPLE, diss: DISS, limit: LIMIT, mode: MODE },
  total: files.length, completed: done.size, ...extra,
}, null, 2));
console.log(`sweep: ${files.length} candidates × ${TICKS} ticks · diss=${DISS} limit=${LIMIT} mode=${MODE}`);
for (const f of files) {
  const seed = JSON.parse(readFileSync(f, 'utf8'));
  const [w, h, d] = seed.dims;
  const name = seed.name || basename(f, '.json');
  const s = sig(name, seed.dims);
  if (done.has(s)) { console.log(`SKIP ${name} — already in dictionary`); continue; }
  const n = w * h * d;
  const t0 = Date.now();
  if (wasm._planck3_init_dims(w, h, d) !== 0) { console.error(`${name}: init_dims rejected`); continue; }
  wasm._planck3_set_dissipation(DISS);
  wasm._planck3_set_thermal_limit(LIMIT);
  wasm._planck3_set_mode(MODE);
  if (wasm._planck3_set_sync) wasm._planck3_set_sync(SYNC);
  wasm._planck3_reset_stats();
  // bulk-load the painted state through the P3ST channel
  hb({ candidate: name, phase: 'loading', t: 0 });
  const blob = packState(w, h, d, seed.cells, seed.q, seed.heat);
  const loadPtr = wasm._planck3_load_pointer();   // malloc may grow memory — wrap AFTER
  heap8().set(blob, loadPtr);
  if (wasm._planck3_load_commit() !== 0) { console.error(`${name}: load_commit rejected`); continue; }
  wasm._planck3_prepare();

  const q0 = wasm._planck3_total_quanta();
  const live0 = wasm._planck3_live_cells();
  hb({ candidate: name, phase: 'start', t: 0 });
  const series = [];
  let stableTail = true, lastQ, lastDead;
  for (let t = SAMPLE; t <= TICKS; t += SAMPLE) {
    for (let k = 0; k < SAMPLE; k++) {
      wasm._planck3_tick();
      hb({ candidate: name, phase: 'ticking', t: t - SAMPLE + k + 1, q: lastQ, dead: lastDead });
    }
    if (MODE !== 0) wasm._planck3_collect();
    const q = wasm._planck3_total_quanta();
    const dead = wasm._planck3_deadlocked();
    lastQ = Math.round(q); lastDead = dead;
    series.push({ t, q: lastQ, dead });
    hb({ candidate: name, phase: 'ticking', t, q: lastQ, dead });
    if (t > TICKS * 0.5 && series.length >= 2) {
      const prev = series[series.length - 2].q;
      if (Math.abs(q - prev) / Math.max(1, prev) > 0.05) stableTail = false;
    }
  }
  const qEnd = wasm._planck3_total_quanta();
  const dead = wasm._planck3_deadlocked();
  const spray = wasm._planck3_spray_quanta();
  const geo = probe(w, h, n, wasm._planck3_state_pointer());
  const retain = qEnd / Math.max(1, q0);
  const liveRetain = geo.live / Math.max(1, live0);
  // Fitness: survives if mass holds, spray stayed bounded, the tail is
  // quiet (mass oscillation <5% per window), and the knot didn't thin out.
  const verdict = retain >= PASS_RETAIN && liveRetain >= 0.8 &&
                  spray <= q0 * PASS_SPRAY && stableTail ? 'stable' : 'unraveled';
  const rec = {
    sig: s, name, dims: seed.dims, R0: seed.R0, R1: seed.R1,
    painted: seed.painted ?? seed.cells.length, loops: seed.loops,
    mass0: Math.round(q0), massEnd: Math.round(qEnd), retain: +retain.toFixed(3),
    live0, liveEnd: geo.live, radiusXY: geo.rxy, radiusZ: geo.rz,
    deadlocked: dead, sprayEvents: wasm._planck3_spray_events(),
    sprayQuanta: Math.round(spray), stableTail,
    verdict, ms: Date.now() - t0, series,
  };
  dict.entries.push(rec);
  done.add(s);
  flush(); // checkpoint — the dictionary survives a kill right now
  hb({ candidate: name, phase: 'done', verdict });
  console.log(`${verdict === 'stable' ? 'PASS' : 'FAIL'} ${rec.name}: mass ${rec.mass0}→${rec.massEnd} ` +
    `(${retain.toFixed(2)}) live ${live0}→${geo.live} r=(${geo.rxy},${geo.rz}) ` +
    `dead=${dead} spray=${rec.sprayEvents}/${Math.round(spray)} (${rec.ms}ms)`);
}
flush();
const pass = dict.entries.filter(e => e.verdict === 'stable').length;
console.log(`\n${pass}/${dict.entries.length} stable knots → ${OUT}`);
