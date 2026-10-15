#!/usr/bin/env node
/*
 * smatrix_pack.mjs — emit an SMX1 binary job for the CUDA runner.
 *
 * Shares collide.mjs's spawn geometry: seeds are translated so their
 * authored center lands at ±separation·u along fcc_axis (+ impact
 * parameter along an orthogonal dir applied to B), with optional
 * Galilean boost re-quantization. Overlap policy identical to collide:
 * contested cells go to A, and nonzero overlap warns unless
 * --allow-overlap.
 *
 * The runner binary knows nothing about seeds/scenarios — this script
 * does all lattice-space work and ships finished state planes.
 *
 *   node script/smatrix_pack.mjs --config=config/smatrix-pilot.json --out=job.smx
 *
 * Config schema:
 *   dims [w,h,d]        sub-grid (default 256,256,256)
 *   batch               copies of the scenario list padded by cycling
 *   ticks, dump_every   run length / snapshot cadence
 *   diss, limit         engine knobs
 *   separation, pinch_tension   spawn + wall forcing (same semantics
 *                       as collide.mjs: constant per-tick wall add)
 *   absorb_margin       sponge-shell thickness (default 0 = periodic
 *                       x/y + z hard wall; >0 drains q/buf + halves heat
 *                       on the shell each tick — open boundary, kills
 *                       wraparound contamination; absorbed mass lands
 *                       in counter slot 2 → status.json "absorbed")
 *   scenarios[]         { name, seed_A, seed_B, fcc_axis,
 *                         impact_parameter, boost_A, boost_B }
 *                       seed_B may be omitted (single-knot survival job)
 */
import { readFileSync, writeFileSync, existsSync, openSync, writeSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, loadConfig, opts, V3, nearestPort } from './lib/p3.mjs';

const CFG = loadConfig();
const { opt, num } = opts(CFG);

const DIMS = String(opt('dims', '256,256,256')).split(',').map(Number);
const [W, H, D] = DIMS, N = W * H * D;
const TICKS = num('ticks', 1000), DUMP = num('dump_every', num('dumpEvery', 0));
const DISS = num('diss', 15), LIMIT = num('limit', 50000);
const SEP = num('separation', 64);
const PINCH = num('pinch_tension', 0);
const MARGIN = num('absorb_margin', 0);   // sponge shell — open boundary
const OUT = String(opt('out', 'job.smx'));
const ALLOW_OVERLAP = !!opt('allow_overlap', false);

const unit = (v) => { const L = Math.hypot(...v); return v.map(c => c / L); };
const orthoOf = (u) => {
  const ref = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const cr = [u[1] * ref[2] - u[2] * ref[1], u[2] * ref[0] - u[0] * ref[2], u[0] * ref[1] - u[1] * ref[0]];
  return unit(cr);
};

const seedFile = (name) => [name, `seeds256/${name}.json`, `seeds/${name}.json`]
  .map(p => resolve(ROOT, p)).find(existsSync);
const loadSeed = (name) => {
  const p = seedFile(name);
  if (!p) { console.error(`seed not found: ${name}`); process.exit(1); }
  return JSON.parse(readFileSync(p, 'utf8'));
};

const parseBoost = (spec) => {
  if (!spec) return null;
  let dir, mag;
  if (typeof spec === 'string') { const a = spec.split(',').map(Number); dir = a.slice(0, 3); mag = a[3]; }
  else { dir = spec.dir; mag = spec.mag; }
  if (!dir || !mag || !dir.some(c => c)) return null;
  return unit(dir).map(c => c * mag * 256);
};
const applyBoost = (cells, dv) => {
  if (!dv) return cells;
  return cells.map(([x, y, z, s]) => {
    const v = V3[s] || [0, 0, 0];
    const nv = [v[0] + dv[0], v[1] + dv[1], v[2] + dv[2]];
    return [x, y, z, nearestPort(nv[0], nv[1], nv[2])];
  });
};

// ---- build one batch's state planes + force list ----
const buildBatch = (sc) => {
  const seedA = loadSeed(sc.seed_A);
  const seedB = sc.seed_B ? loadSeed(sc.seed_B) : null;
  const axis = Math.min(11, Math.max(0, sc.fcc_axis ?? 0));
  const u = unit(V3[axis + 1]), o = orthoOf(u);
  const center = CFG.center ?? [W / 2, H / 2, D / 2];
  const b = sc.impact_parameter ?? 0;
  const sep = sc.separation ?? SEP;          // per-scenario spawn distance

  // Seeds are authored around their OWN grid's center (seed.dims/2,
  // not the job grid's — collide.mjs measured both against seed dims
  // because grid == seed dims there; here they can differ).
  const extent = (seed) => {
    const [sw, sh, sd] = seed.dims;
    const r = [0, 0, 0], m = [sw / 2, sh / 2, sd / 2];
    for (const [x, y, z] of seed.cells)
      for (let a = 0; a < 3; a++) r[a] = Math.max(r[a], Math.abs([x, y, z][a] - m[a]));
    return r.map(v => Math.ceil(v));
  };
  // MARGIN+1 inset: spawning inside the sponge shell would get drained
  // on the first tick — the clamp must keep knot cells clear of it.
  const clampC = (c, r) => c.map((v, a) =>
    Math.min(DIMS[a] - r[a] - MARGIN - 1, Math.max(r[a] + MARGIN + 1, v)));
  const cA = clampC(center.map((v, a) => v - sep * u[a]), extent(seedA));
  const cB = seedB ? clampC(center.map((v, a) => v + sep * u[a] + b * o[a]), extent(seedB)) : null;

  const move = (seed, c) => {
    const [sw, sh, sd] = seed.dims;
    const ac = [sw / 2, sh / 2, sd / 2];
    return seed.cells.map(([x, y, z, s]) =>
      [Math.round(x + c[0] - ac[0]), Math.round(y + c[1] - ac[1]), Math.round(z + c[2] - ac[2]), s]);
  };
  let cellsA = move(seedA, cA);
  let cellsB = seedB ? move(seedB, cB) : [];
  const bst = parseBoost(sc.boost_A ?? null);  if (bst) cellsA = applyBoost(cellsA, bst);
  const bstB = parseBoost(sc.boost_B ?? null); if (bstB) cellsB = applyBoost(cellsB, bstB);

  // Provenance (collide.mjs semantics, verbatim): contested cells are
  // claimed by maskA but get B's state written — B is listed second in
  // the state loop, so its spin wins the overlapping cell while
  // provenance credits A. maskB excludes contested indices.
  const paintedA = new Set(cellsA.map(([x, y, z]) => (z * H + y) * W + x));
  let overlap = 0;
  const maskB = new Set();
  for (const [x, y, z] of cellsB) {
    const i = (z * H + y) * W + x;
    if (paintedA.has(i)) overlap++; else maskB.add(i);
  }
  if (overlap && !ALLOW_OVERLAP) {
    // Same guard as collide.mjs: spawn overlap means every downstream
    // verdict measures an artifact. Emit an empty batch — the slot is
    // preserved so batch indices still line up with the scenario table.
    console.warn(`  ${sc.name}: SKIP — ${overlap} cells overlap at spawn (allow_overlap to force)`);
    return { planes: Buffer.alloc(N * 6), force: [], axis, b,
             name: String(sc.name ?? 'run').slice(0, 31),
             maskA: new Uint8Array(N), maskB: new Uint8Array(N),
             seeds: [sc.seed_A, sc.seed_B ?? null],
             counts: [cellsA.length, cellsB.length], verdict: 'invalid_spawn', overlap };
  }
  if (overlap)
    console.warn(`  ${sc.name}: WARN ${overlap} overlap cells credited to A (B state written — collide semantics)`);

  // State planes in runner order: q[n], s[n], heat16[2n], buf[n], tn[n].
  const planes = Buffer.alloc(N * 6);
  const q = planes.subarray(0, N), s = planes.subarray(N, 2 * N);
  for (const [x, y, z, sp] of [...cellsA, ...cellsB]) {
    const i = (z * H + y) * W + x;
    q[i] = seedA.q ?? 80; s[i] = sp;
    planes.writeUInt16LE(seedA.heat ?? 400, 2 * N + 2 * i);
  }
  // Force list: pinch walls on both axis ends (tension add per tick).
  const force = [];
  if (PINCH > 0) {
    const DIR = u.map(Math.sign);
    const seen = new Set();
    for (const pol of [1, -1]) for (let a = 0; a < 3; a++) {
      const sg = DIR[a] * pol;
      if (!sg) continue;
      const lo = sg > 0 ? 0 : DIMS[a] - 1;
      for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if ([x, y, z][a] !== lo) continue;
        const i = (z * H + y) * W + x;
        if (seen.has(i)) continue;
        seen.add(i);
        force.push({ i, spin: 0, tens: PINCH, quant: 0 });
      }
    }
  }
  return { planes, force, axis, b, name: String(sc.name ?? 'run').slice(0, 31),
           maskA: [...paintedA], maskB: [...maskB],
           seeds: [sc.seed_A, sc.seed_B ?? null], counts: [cellsA.length, cellsB.length] };
};

// ---- expand scenarios across the batch ----
const spec = CFG.scenarios ?? [];
if (!spec.length) { console.error('config has no scenarios[]'); process.exit(1); }
const BATCH = num('batch', spec.length);
const batches = [];
const allForce = [];
for (let bi = 0; bi < BATCH; bi++) {
  const r = buildBatch(spec[bi % spec.length]);
  // rebase force indices into this batch's slice
  for (const f of r.force) allForce.push({ ...f, i: f.i + bi * N });
  batches.push(r);
  console.log(`batch ${bi}: ${r.name} axis=${r.axis} b=${r.b} — packed`);
}

// ---- emit SMX1 ----
// Header (48B): magic, ver, batch, w,h,d, ticks, dumpEvery, nForce,
// reserved, diss, limit — matches runner.cpp's read order.
const header = Buffer.alloc(48);
header.writeUInt32LE(0x31584D53, 0);   // 'SMX1'
header.writeUInt32LE(1, 4);            // version
header.writeUInt32LE(BATCH, 8);
header.writeUInt32LE(W, 12); header.writeUInt32LE(H, 16); header.writeUInt32LE(D, 20);
header.writeUInt32LE(TICKS, 24); header.writeUInt32LE(DUMP, 28);
header.writeUInt32LE(allForce.length, 32);
header.writeUInt32LE(MARGIN, 36);      // absorb_margin (was: reserved)
header.writeInt32LE(DISS, 40);
header.writeInt32LE(LIMIT, 44);

// Per-batch scenario records (40B each — matches runner.cpp Scenario):
//   u8 axis, u8 pad, i16 impact_milli, f32 phase, char name[32]
const scen = Buffer.alloc(BATCH * 40);
for (let bi = 0; bi < BATCH; bi++) {
  const r = batches[bi], o = bi * 40;
  scen.writeUInt8(r.axis, o);
  scen.writeUInt8(0, o + 1);
  scen.writeInt16LE(Math.round(r.b * 1000), o + 2);
  scen.writeFloatLE(0, o + 4);
  scen.write(r.name, o + 8, 31, 'ascii');
}

// Force list (8B each): u32 global idx, u8 spin, u8 tension, u8 quanta, pad
const fbuf = Buffer.alloc(allForce.length * 8);
allForce.forEach((f, k) => {
  const o = k * 8;
  fbuf.writeUInt32LE(f.i, o);
  fbuf.writeUInt8(f.spin, o + 4);
  fbuf.writeUInt8(f.tens, o + 5);
  fbuf.writeUInt8(f.quant, o + 6);
});

// Streamed — a 32×256³ job is ~3.2GB, over Node's single-buffer write cap.
const fd = openSync(OUT, 'w');
for (const chunk of [header, scen, fbuf, ...batches.map(b => b.planes)])
  writeSync(fd, chunk);
closeSync(fd);

// Sidecar: provenance masks + metadata per batch — the runner's state
// dumps carry no knot identity (same constraint as collide.mjs), so
// post-run classification reads this file.
const meta = {
  dims: DIMS, ticks: TICKS, diss: DISS, limit: LIMIT, batch: BATCH,
  absorb_margin: MARGIN,
  batches: batches.map((b, i) => ({
    batch: i, name: b.name, axis: b.axis, impact: b.b, seeds: b.seeds,
    painted: b.counts, maskA: b.maskA, maskB: b.maskB,
  })),
};
writeFileSync(OUT + '.meta.json', JSON.stringify(meta));
console.log(`→ ${OUT}  (${(BATCH * N * 6 / 1e6).toFixed(0)} MB — ${BATCH} batches × ${N * 6} B, ${allForce.length} force pts)`);
console.log(`→ ${OUT}.meta.json  (${meta.batches.length} batch provenance records)`);
