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
 *   Per-scenario experiment fields:
 *     separation / overlap   explicit sep, or target overlap fraction
 *                            of combined axis-extent (0=just touching)
 *     clr_A / clr_B          hug −x/+x wall: nearest knot cell at that
 *                            x-coord (drain-erosion reach probe)
 *     wound_A/B: f           cut contiguous f-arc of the longest cycle
 *     arc_A/B: f             keep ONLY an f-arc of the longest cycle (anneal isolate)
 *     bite_A/B: f            delete top-f fraction of cells along +axis
 *     kick: {buf,cells,hemi} buffer mass injected into knot cells
 *     slug: {dir,off,len,w,q} rod of spin-locked projectile cells
 *     emit: [{pos,r,dir,quant,mod}] driven emitter cells (mod=period)
 *     random_fill: {box:[x0,y0,z0,x1,y1,z1]|null, density:0..1,
 *                   q:[lo,hi]|int, heat:int, spin:'random'|'none'|port,
 *                   seed:int}  hot-random condensation init (quench arm);
 *                   fills only still-empty cells so it can overlay seeds
 *     pinch                  per-scenario wall tension override
 */
import { readFileSync, writeFileSync, existsSync, openSync, writeSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, loadConfig, opts, V3, nearestPort, extractCycles } from './lib/p3.mjs';

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
  const seedA = sc.seed_A ? loadSeed(sc.seed_A) : null;
  const seedB = sc.seed_B ? loadSeed(sc.seed_B) : null;
  if (!seedA && !seedB && !sc.block && !sc.random_fill && !(sc.emit && sc.emit.length)) {
    console.error(`  ${sc.name}: needs seed_A, seed_B, block, random_fill, or emit`); process.exit(1);
  }
  const axis = Math.min(11, Math.max(0, sc.fcc_axis ?? 0));
  const u = unit(V3[axis + 1]), o = orthoOf(u);
  const center = CFG.center ?? [W / 2, H / 2, D / 2];
  const b = sc.impact_parameter ?? 0;

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
  // Axis-projected extent: how far the knot reaches along the separation
  // axis. Drives `overlap` (fraction of combined axis-extent overlapped).
  const axExt = (seed) => { const r = extent(seed);
    return Math.abs(u[0]) * r[0] + Math.abs(u[1]) * r[1] + Math.abs(u[2]) * r[2]; };
  let cellsA = [], cellsB = [], cA = null, cB = null;
  if (seedA || seedB) {
    // overlap f ⇒ centers 2·sep apart = (1-f)·(axExtA+axExtB)
    let sep = sc.separation ?? SEP;
    if (sc.overlap != null)
      sep = (1 - sc.overlap) * (axExt(seedA) + (seedB ? axExt(seedB) : 0)) / 2;
    // clr_A: place the knot hugging the −x wall so its nearest cell sits
    // `clr_A` cells from the boundary (erosion-reach probe). clr_B hugs +x.
    if (sc.clr_A != null) cA = [sc.clr_A + extent(seedA)[0], H / 2, D / 2];
    else if (!seedB) cA = [...center];          // single knots sit centered
    else cA = center.map((v, a) => v - sep * u[a]);
    if (seedB) {
      if (sc.clr_B != null) cB = [W - sc.clr_B - extent(seedB)[0], H / 2, D / 2];
      else cB = center.map((v, a) => v + sep * u[a] + b * o[a]);
    }
    cA = clampC(cA, extent(seedA));
    if (cB) cB = clampC(cB, extent(seedB));

    const move = (seed, c) => {
      const [sw, sh, sd] = seed.dims;
      const ac = [sw / 2, sh / 2, sd / 2];
      return seed.cells.map(([x, y, z, s]) =>
        [Math.round(x + c[0] - ac[0]), Math.round(y + c[1] - ac[1]), Math.round(z + c[2] - ac[2]), s]);
    };
    cellsA = seedA ? move(seedA, cA) : [];
    cellsB = seedB ? move(seedB, cB) : [];
  }

  // Wounds — two distinct failure geometries:
  //   wound: f   topological cut — delete a contiguous f-fraction arc of
  //              the longest spin-cycle (anneal.mjs semantics). Tests the
  //              repair threshold and whether wounds re-tie differently.
  //   bite:  f   spatial cap — delete the f-fraction of cells with the
  //              highest projection along +u (drain-erosion geometry).
  const cutIdx = ([x, y, z]) => (z * H + y) * W + x;
  const wound = (cells, f) => {
    const { cycles } = extractCycles(cells, W, H, D);
    if (!cycles.length) return cells;
    const dead = new Set(cycles[0].slice(0, Math.round(cycles[0].length * f)));
    return cells.filter(c => !dead.has(cutIdx(c)));
  };
  //   arc: f | [start,f]   nucleation probe — keep ONLY a contiguous
  //            arc of the longest cycle (anneal.mjs's bare-arc isolate).
  //            Ranged form takes cycle[start..start+f] — complementary
  //            halves of one loop spawn two open chains whose ends sit
  //            junction-gap apart (arc–arc retying test).
  const arc = (cells, af) => {
    const [st, f] = Array.isArray(af) ? af : [0, af];
    const { cycles } = extractCycles(cells, W, H, D);
    if (!cycles.length) return cells;
    const cyc = cycles[0];
    const keep = new Set(cyc.slice(Math.round(cyc.length * st),
      Math.round(cyc.length * (st + f))));
    return cells.filter(c => keep.has(cutIdx(c)));
  };
  const bite = (cells, f, dir = u) => {
    const keep = Math.round(cells.length * (1 - f));
    return [...cells].sort((a2, b2) =>
      (a2[0] * dir[0] + a2[1] * dir[1] + a2[2] * dir[2]) -
      (b2[0] * dir[0] + b2[1] * dir[1] + b2[2] * dir[2])).slice(0, keep);
  };
  if (sc.wound_A) cellsA = wound(cellsA, sc.wound_A);
  if (sc.wound_B) cellsB = wound(cellsB, sc.wound_B);
  if (sc.arc_A) cellsA = arc(cellsA, sc.arc_A);
  if (sc.arc_B) cellsB = arc(cellsB, sc.arc_B);
  if (sc.bite_A) cellsA = bite(cellsA, sc.bite_A, sc.bite_dir_A);
  if (sc.bite_B) cellsB = bite(cellsB, sc.bite_B, sc.bite_dir_B);

  const bst = parseBoost(sc.boost_A ?? null);  if (bst) cellsA = applyBoost(cellsA, bst);
  const bstB = parseBoost(sc.boost_B ?? null); if (bstB) cellsB = applyBoost(cellsB, bstB);

  // block: { pos:[x,y,z], r, q, heat, spin? } — a painted sphere of
  // inert cells (spin=0 by default: outbound routing is spin-gated, so
  // the only vent channel is thermal unwind spray — a "hot chip").
  // Painted into maskA so block retention is a clean depletion metric.
  const blockCells = [];
  if (sc.block) {
    const bk = sc.block;
    for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if ((x - bk.pos[0]) ** 2 + (y - bk.pos[1]) ** 2 + (z - bk.pos[2]) ** 2 > bk.r * bk.r) continue;
      if (x < MARGIN + 1 || x >= W - MARGIN - 1 || y < MARGIN + 1 || y >= H - MARGIN - 1 || z < MARGIN + 1 || z >= D - MARGIN - 1) continue;
      blockCells.push([x, y, z, bk.spin ?? 0]);
    }
    cellsA = [...cellsA, ...blockCells];
  }

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
  const seedQ = seedA?.q ?? 80, seedHeat = seedA?.heat ?? 400;
  for (const [x, y, z, sp] of [...cellsA, ...cellsB]) {
    const i = (z * H + y) * W + x;
    q[i] = seedQ; s[i] = sp;
    planes.writeUInt16LE(seedHeat, 2 * N + 2 * i);
  }
  // block cells override seed defaults (hot: their own q/heat)
  if (sc.block) for (const [x, y, z] of blockCells) {
    const i = (z * H + y) * W + x;
    q[i] = sc.block.q ?? 255;
    planes.writeUInt16LE(sc.block.heat ?? 400, 2 * N + 2 * i);
  }
  // random_fill: hot-dense condensation init — Bernoulli fill over a box
  // (default: interior minus sponge) with uniform q in [lo,hi] and spins
  // either random ports or none. Unpainted: nucleation is measured from
  // the dump's cycle census, not provenance. Seeded PRNG = reproducible.
  let fillN = 0;
  if (sc.random_fill) {
    const rf = sc.random_fill;
    let rngS = (rf.seed ?? 1) >>> 0;
    const rng = () => {
      rngS = (rngS + 0x6D2B79F5) >>> 0;
      let t = rngS;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const [x0, y0, z0, x1, y1, z1] = rf.box ??
      [MARGIN + 1, MARGIN + 1, MARGIN + 1, W - MARGIN - 2, H - MARGIN - 2, D - MARGIN - 2];
    const [qlo, qhi] = Array.isArray(rf.q) ? rf.q : [rf.q ?? 60, rf.q ?? 60];
    const heat = rf.heat ?? 400, spin = rf.spin ?? 'random';
    const dens = rf.density ?? 0.25;
    for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (rng() >= dens) continue;
      const i = (z * H + y) * W + x;
      if (q[i]) continue;                      // never overwrite authored cells
      q[i] = Math.min(255, Math.round(qlo + rng() * (qhi - qlo)));
      s[i] = spin === 'random' ? 1 + Math.floor(rng() * 12) : spin === 'none' ? 0 : spin;
      planes.writeUInt16LE(heat, 2 * N + 2 * i);
      fillN++;
    }
    console.log(`  ${sc.name}: random_fill ${fillN} cells (density ${dens}, q ${qlo}–${qhi}, heat ${heat}, spin ${spin})`);
  }
  // kick: { buf, cells:'A'|'B'|'AB', hemi:[dx,dy,dz] } — write buffer
  // mass into knot cells at spawn. hemi restricts to the half of the
  // knot on the +hemi side of its centroid — a directional impulse.
  // (Isotropic buf surge = uniform overcharge control; hemispheric =
  // does a one-tick momentum pulse translate or shred?)
  if (sc.kick) {
    const bufP = planes.subarray(4 * N, 5 * N);
    const targets = sc.kick.cells === 'B' ? [cellsB] : sc.kick.cells === 'AB' ? [cellsA, cellsB] : [cellsA];
    for (const cells of targets) {
      if (!cells.length) continue;
      let cx = 0, cy = 0, cz = 0;
      for (const [x, y, z] of cells) { cx += x; cy += y; cz += z; }
      cx /= cells.length; cy /= cells.length; cz /= cells.length;
      for (const [x, y, z] of cells) {
        if (sc.kick.hemi && (x - cx) * sc.kick.hemi[0] + (y - cy) * sc.kick.hemi[1] + (z - cz) * sc.kick.hemi[2] < 0) continue;
        bufP[(z * H + y) * W + x] = Math.min(255, sc.kick.buf ?? 60);
      }
    }
  }
  // slug: { dir, off, len, w, q, at:'A' } — a compact rod of driven
  // cells aimed at the knot: quanta with spins locked on dir. Unpainted
  // (provenance-clean); tests momentum transfer vs erosion.
  if (sc.slug && cA) {
    const sg = sc.slug;
    const dir = unit(sg.dir);
    const tc = sg.at === 'B' && cB ? cB : cA;
    const tExt = (sg.at === 'B' && seedB ? axExt(seedB) : (seedA ? axExt(seedA) : 0));
    const r0 = tc.map((v, a) => v - dir[a] * (tExt + (sg.off ?? 12)));
    const e2 = [Math.abs(dir[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]];
    const e1 = unit([dir[1] * e2[0][2] - dir[2] * e2[0][1], dir[2] * e2[0][0] - dir[0] * e2[0][2], dir[0] * e2[0][1] - dir[1] * e2[0][0]]);
    const e2v = unit([dir[1] * e1[2] - dir[2] * e1[1], dir[2] * e1[0] - dir[0] * e1[2], dir[0] * e1[1] - dir[1] * e1[0]]);
    const sp = nearestPort(...dir.map(v => v * 256));
    const painted = new Set([...cellsA, ...cellsB].map(cutIdx));
    const half = (sg.w ?? 3) / 2;
    let slugN = 0;
    for (let t = 0; t < (sg.len ?? 24); t++)
      for (let a1 = -Math.ceil(half); a1 <= Math.ceil(half); a1++)
        for (let a2 = -Math.ceil(half); a2 <= Math.ceil(half); a2++) {
          if (a1 * a1 + a2 * a2 > half * half) continue;
          const x = Math.round(r0[0] - dir[0] * t + e1[0] * a1 + e2v[0] * a2);
          const y = Math.round(r0[1] - dir[1] * t + e1[1] * a1 + e2v[1] * a2);
          const z = Math.round(r0[2] - dir[2] * t + e1[2] * a1 + e2v[2] * a2);
          if (x < MARGIN + 1 || x >= W - MARGIN - 1 || y < MARGIN + 1 || y >= H - MARGIN - 1 || z < MARGIN + 1 || z >= D - MARGIN - 1) continue;
          const i = (z * H + y) * W + x;
          if (painted.has(i)) continue;
          q[i] = sg.q ?? 80; s[i] = sp; slugN++;
        }
    console.log(`  ${sc.name}: slug ${slugN} cells, spin=${sp}`);
  }
  // Force list: pinch walls on both axis ends (tension add per tick),
  // plus per-scenario emitters — a disc of force-driven cells that
  // re-assert spin + inject quanta, optionally square-wave modulated
  // (emit.mod = period in ticks; the acoustic/resonant drive channel).
  const force = [];
  const PINCH_SC = sc.pinch ?? PINCH;
  if (PINCH_SC > 0) {
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
        force.push({ i, spin: 0, tens: PINCH_SC, quant: 0, mod: 0 });
      }
    }
  }
  for (const em of sc.emit ?? []) {
    const dir = unit(em.dir ?? [1, 0, 0]);
    const sp = em.spin !== undefined ? em.spin : nearestPort(...dir.map(v => v * 256));
    let en = 0;
    if (em.plane) {
      // plane emitter: [axis, lo, hi] slab — still needs the full sweep
      const [pa, lo, hi] = em.plane;
      for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const v = [x, y, z][pa];
        if (v < lo || v > hi) continue;
        force.push({ i: (z * H + y) * W + x, spin: sp, tens: 0, quant: em.quant ?? 0, mod: em.mod ?? 0 });
        en++;
      }
    } else {
      // ball emitter: scan only its bounding box, not the whole grid
      const r = em.r ?? 6, r2 = r * r;
      const [cx, cy, cz] = em.pos;
      for (let z = Math.max(0, cz - r); z <= Math.min(D - 1, cz + r); z++)
        for (let y = Math.max(0, cy - r); y <= Math.min(H - 1, cy + r); y++)
          for (let x = Math.max(0, cx - r); x <= Math.min(W - 1, cx + r); x++) {
            if ((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2 > r2) continue;
            force.push({ i: (z * H + y) * W + x, spin: sp, tens: 0, quant: em.quant ?? 0, mod: em.mod ?? 0 });
            en++;
          }
    }
    if ((sc.emit ?? []).length <= 16)
      console.log(`  ${sc.name}: emitter ${en} cells mod=${em.mod ?? 0} q+${em.quant ?? 0} spin=${sp}`);
  }
  if ((sc.emit ?? []).length > 16)
    console.log(`  ${sc.name}: ${sc.emit.length} emitters (${force.length} force pts total)`);
  return { planes, force, axis, b, name: String(sc.name ?? 'run').slice(0, 31),
           spec: { overlap: sc.overlap, clr_A: sc.clr_A, clr_B: sc.clr_B,
                   wound_A: sc.wound_A, wound_B: sc.wound_B, bite_A: sc.bite_A,
                   bite_B: sc.bite_B, kick: sc.kick, slug: sc.slug, emit: sc.emit,
                   block: sc.block, random_fill: sc.random_fill, pinch: PINCH_SC },
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

// Force list (8B each): u32 global idx, u8 spin, u8 tension, u8 quanta,
// u8 mod (0 = every tick; p>0 = 50%-duty square wave at period p)
const fbuf = Buffer.alloc(allForce.length * 8);
allForce.forEach((f, k) => {
  const o = k * 8;
  fbuf.writeUInt32LE(f.i, o);
  fbuf.writeUInt8(f.spin, o + 4);
  fbuf.writeUInt8(f.tens, o + 5);
  fbuf.writeUInt8(f.quant, o + 6);
  fbuf.writeUInt8(f.mod ?? 0, o + 7);
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
    painted: b.counts, spec: b.spec ?? null, maskA: b.maskA, maskB: b.maskB,
  })),
};
writeFileSync(OUT + '.meta.json', JSON.stringify(meta));
console.log(`→ ${OUT}  (${(BATCH * N * 6 / 1e6).toFixed(0)} MB — ${BATCH} batches × ${N * 6} B, ${allForce.length} force pts)`);
console.log(`→ ${OUT}.meta.json  (${meta.batches.length} batch provenance records)`);
