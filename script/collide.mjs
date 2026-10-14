#!/usr/bin/env node
/*
 * collide.mjs — S-Matrix harness for planck3.wasm.
 *
 * Spawns two dictionary knots at opposing ends of a True FCC routing
 * axis, applies a symmetric tension pinch at both boundary walls, and
 * lets them slide downhill to collide at grid center. Classifies the
 * topological aftermath per scenario:
 *
 *   elastic bounce — 2 distinct components, each ≥90% painted survival
 *   fusion         — 1 component containing markers of BOTH seeds
 *   annihilation   — 0 coherent components (structural shatter/spray)
 *   asymmetric     — exactly one knot's skeleton survives
 *   degraded       — 2 components but one dropped below 90%
 *
 *   node script/collide.mjs --config=config/collide-matrix.json
 *
 * Marker tagging: the engine's 6-byte node has no spare ID register,
 * so "distinct markers" are load-time provenance — paintedA/paintedB
 * index masks (like boost's skeleton tracker, ×2). A cell's allegiance
 * is which seed painted it; the BFS reads component membership live.
 *
 * Per tick the census runs one BFS from a surviving painted-A cell and
 * counts painted-B cells inside — if the seeds share a component,
 * that's fusion in progress; otherwise a second BFS maps B's component.
 *
 * Config:
 *   duration_ticks, pinch_tension (number → constant, or envelope
 *   object), separation (default 64 cells along the axis, clamped to
 *   grid bounds), center (default dims/2), diss/limit/mode, scenarios[]:
 *     name, seed_A, seed_B, fcc_axis (0-11 → ports 1-12, undirected:
 *     spawn offsets go ± the port direction), impact_parameter
 *     (lateral cells along an orthogonal vector, applied to B),
 *     boost_A / boost_B (optional "dx,dy,dz,mag" — blends a uniform
 *     drift vector into every cell's spin register, re-quantized to
 *     the nearest FCC port; mag is in port units, 1.0 = full port
 *     strength. CLI --boostA=/--boostB= override all scenarios).
 *
 * Heartbeat → logs/collide-status.json; per-scenario result →
 * logs/collide-<name>.json; appended summary → logs/collide-results.json.
 */
import { writeVtkFrame } from './vtk.mjs';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  ROOT, LOGDIR, arg, loadConfig, opts, loadPlanck3, initEngine,
  V3, packLoad, commitLoad, heartbeat, makeDrain,
} from './lib/p3.mjs';

const CFG_PATH = String(arg('config') ?? 'config/collide-matrix.json');
const CFG = loadConfig('config/collide-matrix.json');
const { opt, num } = opts(CFG);

const TICKS = num('duration_ticks', 1000);
const SEP = num('separation', 64);
const PINCH = CFG.pinch_tension ?? 20;
const DISS = num('diss', 15), LIMIT = num('limit', 50000), MODE = num('mode', 0);
const SYNC = num('sync', 0);           // synchronous update (deferred pushes)
const VTK_EVERY = num('vtk-interval', num('vtk_interval', 0));   // 0 = off
// Sponge shell (cells) drained each tick — open-boundary semantics:
// stops periodic wraparound spray re-entering the arena from behind.
// Absorbed mass is counted per tick (missing-transverse-energy channel).
const ABSORB = num('absorb_margin', 0);
const ONLY = opt('only', null) ? String(opt('only')).split(',') : null;
const WASM_JS = String(opt('wasm', 'docs/public/wasm/loom/planck3.js'));

// pinch_tension accepts a scalar (→ constant envelope) or an envelope
// object with the same evaluator grammar as boost.mjs.
const envelope = (t, p) => {
  if (p == null) return 0;
  if (typeof p === 'number') return p;
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

// ---------- FCC axis geometry (V3 port table from the shared lib) ----
const unit = (v) => { const L = Math.hypot(...v); return v.map(c => c / L); };
const orthoOf = (u) => {
  const ref = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const cr = [
    u[1] * ref[2] - u[2] * ref[1],
    u[2] * ref[0] - u[0] * ref[2],
    u[0] * ref[1] - u[1] * ref[0],
  ];
  return unit(cr);
};

// Galilean boost: add a uniform drift vector to each cell's circulation
// spin and re-quantize to the nearest FCC port (max dot product). Spin
// is the momentum carrier — if the lattice supports translation, the
// knot should advect along dir at ~mag hops/tick without shredding.
// spec: "dx,dy,dz,mag" or {dir:[x,y,z], mag} — mag in port units (1.0
// ≈ the spin register's own strength).
const parseBoost = (spec) => {
  if (!spec) return null;
  let dir, mag;
  if (typeof spec === 'string') {
    const a = spec.split(',').map(Number);
    dir = a.slice(0, 3); mag = a[3];
  } else { dir = spec.dir; mag = spec.mag; }
  if (!dir || !mag || !dir.some(c => c)) return null;
  const u = unit(dir);
  return u.map(c => c * mag * 256);               // V3 fixed-point scale
};
const applyBoost = (cells, dv) => {
  if (!dv) return cells;
  let changed = 0;
  const out = cells.map(([x, y, z, s]) => {
    const v = V3[s] || [0, 0, 0];
    const nv = [v[0] + dv[0], v[1] + dv[1], v[2] + dv[2]];
    let best = s, bd = -Infinity;
    for (let p = 1; p <= 12; p++) {
      const dd = nv[0] * V3[p][0] + nv[1] * V3[p][1] + nv[2] * V3[p][2];
      if (dd > bd) { bd = dd; best = p; }
    }
    if (best !== s) changed++;
    return [x, y, z, best];
  });
  return { cells: out, changed };
};

// Boundary slab for a signed axis component — shared with boost.mjs.
const wallIndices = (w, h, d, sign, axis, skin = 1) => {
  const out = [];
  const lo = sign > 0 ? 0 : [w, h, d][axis] - skin;
  const hi = lo + skin - 1;
  for (let z = 0; z < d; z++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = [x, y, z][axis];
    if (c >= lo && c <= hi) out.push((z * h + y) * w + x);
  }
  return out;
};

// ---------- engine load ----------
const wasm = await loadPlanck3(WASM_JS);
const heap8 = wasm.heap8;

const hb = heartbeat('collide-status.json', { config: CFG_PATH });

const seedFile = (name) => [name, `seeds256/${name}.json`, `seeds/${name}.json`]
  .map(p => resolve(ROOT, p)).find(existsSync);
const loadSeed = (name) => {
  const p = seedFile(name);
  if (!p) { console.error(`seed not found: ${name}`); return null; }
  return JSON.parse(readFileSync(p, 'utf8'));
};

const scenarios = (CFG.scenarios ?? []).filter(s => !ONLY || ONLY.includes(s.name));
if (!scenarios.length) { console.error('no scenarios to run'); process.exit(1); }
const resultsPath = join(LOGDIR, 'collide-results.json');
const results = existsSync(resultsPath) ? JSON.parse(readFileSync(resultsPath, 'utf8')) : [];

// ---------- scenario loop ----------
const NB = [];
for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) for (const dz of [-1, 0, 1])
  if (dx || dy || dz) NB.push([dx, dy, dz]);

for (const sc of scenarios) {
  const seedA = loadSeed(sc.seed_A), seedB = loadSeed(sc.seed_B);
  if (!seedA || !seedB) { console.error(`${sc.name}: missing seed`); continue; }
  const [w, h, d] = seedA.dims;
  if (seedB.dims.join() !== seedA.dims.join()) { console.error(`${sc.name}: seed dims differ`); continue; }
  const n = w * h * d;
  const axis = Math.min(11, Math.max(0, sc.fcc_axis ?? 0));
  const u = unit(V3[axis + 1]);
  const o = orthoOf(u);
  const center = CFG.center ?? [w / 2, h / 2, d / 2];
  const b = sc.impact_parameter ?? 0;

  // Spawn centers: A at −SEP·u, B at +SEP·u (+ b·ortho). Each center is
  // clamped so the seed's own bounding box stays inside the grid.
  const extent = (seed) => {
    const r = [0, 0, 0];
    for (const [x, y, z] of seed.cells) {
      // seeds are painted around the grid center — per-axis half-extent
      const c = [x, y, z], m = [w / 2, h / 2, d / 2];
      for (let a = 0; a < 3; a++) r[a] = Math.max(r[a], Math.abs(c[a] - m[a]));
    }
    return r.map(v => Math.ceil(v));
  };
  const clampCenter = (c, r) => c.map((v, a) => Math.min([w, h, d][a] - r[a] - 1, Math.max(r[a], v)));
  const rA = extent(seedA), rB = extent(seedB);
  const cA = clampCenter(center.map((v, a) => v - SEP * u[a]), rA);
  const cB = clampCenter(center.map((v, a) => v + SEP * u[a] + b * o[a]), rB);

  // Translate each seed to its spawn center; seeds are authored around
  // their grid's center, so the delta is just (spawn − authored center).
  const move = (seed, c) => {
    const ac = [w / 2, h / 2, d / 2];
    return seed.cells.map(([x, y, z, sp]) => [
      Math.round(x + c[0] - ac[0]), Math.round(y + c[1] - ac[1]), Math.round(z + c[2] - ac[2]), sp]);
  };
  const cellsA = move(seedA, cA), cellsB = move(seedB, cB);

  // Galilean boost: uniform drift blended into the circulation spins.
  // CLI flag overrides the per-scenario spec. The boosted knot's
  // painted mask is unchanged — translation (if any) shows up as
  // skeleton-centroid drift in the series.
  const boostA = parseBoost(arg('boostA') ?? sc.boost_A);
  const boostB = parseBoost(arg('boostB') ?? sc.boost_B);
  let bA = null, bB = null;
  if (boostA) { const r = applyBoost(cellsA, boostA); cellsA.splice(0, cellsA.length, ...r.cells); bA = r.changed; }
  if (boostB) { const r = applyBoost(cellsB, boostB); cellsB.splice(0, cellsB.length, ...r.cells); bB = r.changed; }

  const paintedA = new Uint8Array(n), paintedB = new Uint8Array(n);
  let overlap = 0;
  for (const [x, y, z] of cellsA) paintedA[(z * h + y) * w + x] = 1;
  for (const [x, y, z] of cellsB) {
    const i = (z * h + y) * w + x;
    if (paintedA[i]) overlap++; else paintedB[i] = 1;
  }
  // Separation guard: overlapping spawn masks mean the knots are already
  // touching at t=0 — every downstream verdict ("fusion" by halo bridge
  // or otherwise) is then measuring a spawn artifact, not a collision.
  // Default: record invalid_spawn and skip. --allow-overlap overrides
  // (e.g. for deliberate merger-into-remnant studies).
  if (overlap && !arg('allow-overlap')) {
    console.log(`${sc.name}: SKIP — ${overlap} cells overlap at spawn (use --allow-overlap to force)`);
    results.push({ scenario: sc.name, seeds: [sc.seed_A, sc.seed_B], verdict: 'invalid_spawn', overlap });
    writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    continue;
  }
  if (overlap) console.log(`${sc.name}: WARN ${overlap} cells overlap between seeds (A wins)`);

  // Init engine + P3ST bulk-load of both knots.
  if (!initEngine(wasm, { w, h, d, diss: DISS, limit: LIMIT, mode: MODE, sync: SYNC })) continue;
  const { buf, q: qp, s: sp, heat: hp } = packLoad(w, h, d);
  for (const [x, y, z, s] of [...cellsA, ...cellsB]) {
    const i = (z * h + y) * w + x;
    qp[i] = seedA.q; sp[i] = s; hp.setUint16(2 * i, seedA.heat, true);
  }
  hb({ scenario: sc.name, phase: 'loading', t: 0 });
  if (!commitLoad(wasm, buf)) continue;
  // g_rd/g_wr swap every tick — re-fetch after each _planck3_tick() or
  // pinch writes land in the write buffer half the time (silently eaten)
  // and census reads a one-tick-stale frame on alternate ticks.
  let statePtr = wasm._planck3_state_pointer();
  const q0 = wasm._planck3_total_quanta();

  // Pinch walls: both ends of the axis (same mapping as boost — a wall
  // slab per nonzero component on each polarity).
  const DIR = u.map(Math.sign);
  const seen = new Uint8Array(n);
  const pinchWalls = [];
  for (const pol of [1, -1]) {
    seen.fill(0);
    const wall = [];
    for (let a = 0; a < 3; a++) {
      const s = DIR[a] * pol;
      if (!s) continue;
      for (const i of wallIndices(w, h, d, s, a)) if (!seen[i]) { seen[i] = 1; wall.push(i); }
    }
    pinchWalls.push(wall);
  }
  const pinch = (t) => {
    const tn = envelope(t, PINCH);
    if (!tn) return;
    const mem = heap8();
    for (const wall of pinchWalls) for (const i of wall) {
      const p = statePtr + i * 6 + 5;
      mem[p] = Math.min(255, mem[p] + tn);
    }
  };

  // Dual-BFS census: component containing painted A (and whether B's
  // markers are inside it), then B's component if distinct.
  const visit = new Uint8Array(n);
  const queue = new Int32Array(n);
  const compFrom = (seedIdx, mem) => {
    if (seedIdx < 0) return null;
    visit.fill(0);
    let head = 0, tail = 0, live = 0, q = 0;
    let pA = 0, pB = 0, ax = 0, ay = 0, az = 0, bx = 0, by = 0, bz = 0;
    let lx = 0, ly = 0, lz = 0;                 // live-component centroid
    queue[tail++] = seedIdx; visit[seedIdx] = 1;
    while (head < tail) {
      const i = queue[head++];
      const x = i % w, y = ((i % (h * w)) / w) | 0, z = (i / (h * w)) | 0;
      live++; q += mem[statePtr + i * 6]; lx += x; ly += y; lz += z;
      if (paintedA[i]) { pA++; ax += x; ay += y; az += z; }
      if (paintedB[i]) { pB++; bx += x; by += y; bz += z; }
      for (const [dx, dy, dz] of NB) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h || nz < 0 || nz >= d) continue;
        const ni = (nz * h + ny) * w + nx;
        if (!visit[ni] && mem[statePtr + ni * 6] !== 0) { visit[ni] = 1; queue[tail++] = ni; }
      }
    }
    return {
      live, q, paintedA: pA, paintedB: pB,
      // Live centroid: follows a translating knot — the painted skeleton
      // stays at spawn, so boost/flight reads as retain→0 while THIS
      // keeps tracking the actual structure.
      lcent: live ? { x: +(lx / live).toFixed(2), y: +(ly / live).toFixed(2), z: +(lz / live).toFixed(2) } : null,
      skelA: pA ? { x: ax / pA, y: ay / pA, z: az / pA } : null,
      skelB: pB ? { x: bx / pB, y: by / pB, z: bz / pB } : null,
    };
  };
  const census = () => {
    const mem = heap8();
    let live = 0, seedAi = -1, seedBi = -1;
    for (let i = 0; i < n; i++) {
      if (mem[statePtr + i * 6] === 0) continue;
      live++;
      if (seedAi < 0 && paintedA[i]) seedAi = i;
      if (seedBi < 0 && paintedB[i]) seedBi = i;
    }
    const compA = compFrom(seedAi, mem);
    const merged = compA && compA.paintedB > 0;
    const compB = (!merged && seedBi >= 0) ? compFrom(seedBi, mem) : null;
    return { live, compA, compB, merged };
  };

  console.log(`\ncollide: ${sc.name} ${w}x${h}x${d} axis ${axis} dir (${u.map(c => c.toFixed(2))}) ` +
    `b=${b} sep=${SEP} pinch=${JSON.stringify(PINCH)}`);
  console.log(`  A=${sc.seed_A}@${cA.map(Math.round)} (${cellsA.length} cells${bA !== null ? `, boost→${bA} requantized` : ''})  ` +
    `B=${sc.seed_B}@${cB.map(Math.round)} (${cellsB.length} cells${bB !== null ? `, boost→${bB} requantized` : ''})` +
    `  walls ${pinchWalls[0].length}+${pinchWalls[1].length}`);

  const origA = cellsA.length, origB = cellsB.length;
  const drain = makeDrain(w, h, d, ABSORB);
  let absorbedTotal = 0;
  const series = [];
  let c0 = census(), cLast = c0;
  const gap0 = c0.compA?.skelA && (c0.merged ? c0.compA.skelB : c0.compB?.skelB)
    ? Math.hypot(
        (c0.merged ? c0.compA.skelB : c0.compB.skelB).x - c0.compA.skelA.x,
        (c0.merged ? c0.compA.skelB : c0.compB.skelB).y - c0.compA.skelA.y,
        (c0.merged ? c0.compA.skelB : c0.compB.skelB).z - c0.compA.skelA.z)
    : null;
  const t0ms = Date.now();
  const VTK_DIR = VTK_EVERY ? join(LOGDIR, 'vtk', `collide-${sc.name}`) : null;
  if (VTK_DIR) mkdirSync(VTK_DIR, { recursive: true });
  let aborted = false;
  for (let t = 0; t < TICKS; t++) {
    if (VTK_DIR && t % VTK_EVERY === 0)
      writeVtkFrame({
        file: join(VTK_DIR, `frame_${String(t).padStart(5, '0')}.vtk`),
        w, h, d, statePtr, heap8, masks: { a: paintedA, b: paintedB }, tick: t,
        title: `collide ${sc.name} axis${axis} b${b}`,
      });
    if (drain) absorbedTotal += drain.apply(heap8(), statePtr);
    pinch(t);
    wasm._planck3_tick();
    statePtr = wasm._planck3_state_pointer();   // buffer swap — see above
    const c = census();
    const q = wasm._planck3_total_quanta();
    const aS = c.compA?.skelA, bS = c.merged ? c.compA?.skelB : c.compB?.skelB;
    const gap = aS && bS ? Math.hypot(bS.x - aS.x, bS.y - aS.y, bS.z - aS.z) : null;
    const rec = {
      t, merged: !!c.merged, live: c.live, q: Math.round(q), absorbed: absorbedTotal,
      gap: gap === null ? null : +gap.toFixed(2),
      a: c.compA ? { live: c.compA.live, painted: c.compA.paintedA, q: c.compA.q, lcent: c.compA.lcent } : null,
      b: c.merged ? { insideA: c.compA.paintedB } : c.compB ? { live: c.compB.live, painted: c.compB.paintedB, q: c.compB.q, lcent: c.compB.lcent } : null,
      ax: aS ? +aS.x.toFixed(2) : null, ay: aS ? +aS.y.toFixed(2) : null,
      bx: bS ? +bS.x.toFixed(2) : null, by: bS ? +bS.y.toFixed(2) : null,
    };
    series.push(rec);
    hb({ scenario: sc.name, phase: 'ticking', t, gap: rec.gap, merged: rec.merged });
    if (t % 50 === 0 || t === TICKS - 1)
      console.log(`  t${t}: gap=${rec.gap ?? '—'} merged=${rec.merged} live=${rec.live} A=${rec.a?.painted ?? 0}/${origA} B=${c.merged ? rec.b.insideA : rec.b?.painted ?? 0}/${origB}`);
    if (!c.compA && !c.compB) { aborted = true; console.log(`  t${t}: both skeletons gone — annihilation`); break; }
    cLast = c;
  }

  // ---------- S-Matrix classification ----------
  const compA = cLast.compA, compB = cLast.merged ? cLast.compA : cLast.compB;
  const retA = compA ? compA.paintedA / origA : 0;
  const retB = cLast.merged ? compA.paintedB / origB : compB ? compB.paintedB / origB : 0;
  let verdict;
  if (cLast.merged) verdict = 'fusion';
  else if (!compA && !compB) verdict = 'annihilation';
  else if (!compA || !compB) verdict = 'asymmetric';
  else if (retA >= 0.9 && retB >= 0.9) verdict = 'elastic_bounce';
  else verdict = 'degraded';

  const qEnd = wasm._planck3_total_quanta();
  console.log(`\n  S-MATRIX ${sc.name}: ${verdict.toUpperCase()} — retain A=${retA.toFixed(2)} B=${retB.toFixed(2)} ` +
    `mass ${Math.round(q0)}→${Math.round(qEnd)} in ${((Date.now() - t0ms) / 1000).toFixed(0)}s`);

  const out = {
    scenario: sc.name, seeds: [sc.seed_A, sc.seed_B], axis, b,
    boostA: arg('boostA') ?? sc.boost_A ?? null, boostB: arg('boostB') ?? sc.boost_B ?? null,
    boostCellsA: bA, boostCellsB: bB,
    spawnA: cA.map(Math.round), spawnB: cB.map(Math.round), dims: [w, h, d],
    ticks: series.length, pinch: PINCH, diss: DISS, limit: LIMIT,
    absorb_margin: ABSORB, absorbed: absorbedTotal,
    verdict, retainA: +retA.toFixed(4), retainB: +retB.toFixed(4),
    mass0: Math.round(q0), massEnd: Math.round(qEnd),
    gap0: gap0 === null ? null : +gap0.toFixed(2),
    aborted, ms: Date.now() - t0ms, series,
  };
  writeFileSync(join(LOGDIR, `collide-${sc.name}.json`), JSON.stringify(out, null, 2));
  results.push({ name: sc.name, axis, b, verdict, retainA: out.retainA, retainB: out.retainB, sync: SYNC });
  writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  hb({ scenario: sc.name, phase: 'done', verdict });
}
console.log(`\n${results.length} scenarios → ${resultsPath}`);
