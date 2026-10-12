#!/usr/bin/env node
/*
 * pathfinder.mjs — headless DFS loop-hunter for the True FCC substrate.
 *
 * Operates purely on the 12-port parity-free geometric graph (no
 * thermodynamics): from seeds tiled across a torus tube cross-section,
 * trace closed streamlines under the Phase-Lock constraint — every hop
 * must stay within 60° (DOTS >= 128/256) of the incoming dominant port.
 * Closure is proved as a graph cycle by memoized DFS (RFC-048), not by
 * greedy field-following (RFC-047 failure mode).
 *
 * Emits seed geometries as JSON for script/sweep.mjs to thermodynamically
 * test: seeds/hopfion_<R0>_<R1>.json
 *
 *   node script/pathfinder.mjs [options]
 *
 * Options (defaults reproduce the canonical 19-loop Hopfion geometry):
 *   --w=256 --h=256 --d=256   grid dims (headless arena; 100x100x40 ok)
 *   --r0=25                   major radii: list or range "20:80:8"
 *   --r1=9                    minor (tube) radii, same syntax
 *   --q=60                    painted quanta
 *   --heat=500                painted heat
 *   --shellw=1.6              same-shell tolerance (torus-surface gate)
 *   --seedstep=3              cross-section seed spacing
 *   --minlen=20 --maxlen=2000 loop length bounds
 *   --dfsmax=2000000          per-seed DFS budget
 *   --tw=1 --pw=1             toroidal/poloidal field weights
 *   --out=seeds               output directory
 *   --dbg                     per-seed closure logging
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------- args ----------
const arg = (k, d) => {
  const m = process.argv.find(a => a === `--${k}` || a.startsWith(`--${k}=`));
  return m ? (m.includes('=') ? m.split('=')[1] : true) : d;
};
const num = (k, d) => parseFloat(arg(k, d));
const list = (k, d) => {
  const v = String(arg(k, d));
  if (v.includes(':')) { const [a, b, s] = v.split(':').map(Number);
    const r = []; for (let x = a; x <= b + 1e-9; x += s) r.push(+x.toFixed(4)); return r; }
  return v.split(',').map(Number);
};
const DBG = !!arg('dbg', false);

const W = num('w', 256), H = num('h', 256), D = num('d', 256);
const N = W * H * D;
const R0S = list('r0', '25'), R1S = list('r1', '9');
const Q = num('q', 60), HEAT = num('heat', 500);
const SHELL_W = num('shellw', 1.6), SSTEP = num('seedstep', 3);
const MINLEN = num('minlen', 20), MAXLEN = num('maxlen', 2000);
const DFSMAX = num('dfsmax', 2000000);
const TW = num('tw', 1), PW = num('pw', 1);
const OUT = String(arg('out', 'seeds'));

// ---------- substrate tables (ported from planck3.c / engine-sim.mjs) ---
const HOFF = [
  [[0,0],[1,0],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1]], // even rows
  [[0,0],[1,0],[1,1],[0,1],[-1,0],[0,-1],[1,-1]]    // odd rows
];
const HINV = [0, 4, 5, 6, 1, 2, 3];
const ZU3 = [1, 3, 5], ZD3 = [2, 4, 6];
// Per-parity port offsets (dx,dy,dz) — arithmetic NT3 replacement.
const POFF = [[], []];
for (let par = 0; par < 2; par++) {
  for (let d = 1; d <= 6; d++) POFF[par][d] = [HOFF[par][d][0], HOFF[par][d][1], 0];
  for (let j = 0; j < 3; j++) {
    POFF[par][7 + j] = [HOFF[par][ZU3[j]][0], HOFF[par][ZU3[j]][1], 1];
    POFF[par][10 + j] = [HOFF[par][ZD3[j]][0], HOFF[par][ZD3[j]][1], -1];
  }
}
// Baked unit port vectors (x256) — identical to planck3.c V3.
const V3 = [null,
  [256,0,0],[128,222,0],[-128,222,0],[-256,0,0],[-128,-222,0],[128,-222,0],
  [148,0,209],[-74,128,209],[-74,-128,209],
  [74,128,-209],[-148,0,-209],[74,-128,-209]];
const BACK3 = [0, 4, 5, 6, 1, 2, 3, 11, 12, 10, 9, 7, 8];
const dotV = (a, b) => (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) >> 8;
const DOTS = [new Int16Array(13)];
for (let a = 1; a <= 12; a++) {
  DOTS.push(new Int16Array(13));
  for (let b = 1; b <= 12; b++) DOTS[a][b] = dotV(V3[a], V3[b]);
}

// Neighbor of (x,y,z) via port d → [nx,ny,nz,idx] or null on z-wall.
const nbr = (x, y, z, d) => {
  const o = POFF[y & 1][d];
  const nz = z + o[2];
  if (nz < 0 || nz >= D) return null;
  const nx = (x + o[0] + W) % W, ny = (y + o[1] + H) % H;
  return [nx, ny, nz, (nz * H + ny) * W + nx];
};
const idx = (x, y, z) => (z * H + y) * W + x;
const xyz = i => [i % W, ((i % (H * W)) / W) | 0, (i / (H * W)) | 0];

// ---------- Hopfion field ----------
const CX = W / 2, CY = H / 2, CZ = D / 2;
const hopfVec = (x, y, z, R0) => {
  const dx = x - CX, dy = y - CY, dz = z - CZ;
  const rho = Math.hypot(dx, dy);
  if (rho === 0) return [0, 0, 0];
  const psi = Math.atan2(dz, rho - R0);
  const ux = dx / rho, uy = dy / rho, sp = Math.sin(psi), cp = Math.cos(psi);
  return [TW * -uy + PW * sp * ux, TW * ux + PW * sp * uy, PW * -cp];
};

// ---------- tracer ----------
const painted = new Uint8Array(N); // shared moat across all runs in this process

function trace(sx, sy, sz, R0) {
  const seedI = idx(sx, sy, sz);
  if (painted[seedI]) return null; // painted-seed overwrite = double inflow
  const seen = new Set([seedI]);
  const path = [];
  let seedD = 0, steps = 0;
  const rt0 = Math.hypot(Math.hypot(sx - CX, sy - CY) - R0, sz - CZ);
  const memo = new Set();
  let budget = DFSMAX;
  const dfs = (i, x, y, z, tvx, tvy, tvz, depth) => {
    if (budget-- <= 0 || depth > MAXLEN) return false;
    steps++;
    const hv = hopfVec(x, y, z, R0);
    // Lock compares cs vs dom — the argmax port of incoming momentum,
    // not the travel vector itself.
    let domP = 0;
    if (depth > 0) {
      let dBest = -Infinity;
      for (let dd = 1; dd <= 12; dd++) {
        const sc = tvx * V3[dd][0] + tvy * V3[dd][1] + tvz * V3[dd][2];
        if (sc > dBest) { dBest = sc; domP = dd; }
      }
    }
    const cand = [];
    for (let d = 1; d <= 12; d++) {
      const n = nbr(x, y, z, d);
      if (!n) continue;
      const ni = n[3];
      if (depth > 0 && DOTS[d][domP] < 128) continue;
      if (ni === seedI) {
        if (depth + 1 >= MINLEN) {
          let sBest = -Infinity, sDom = 0;
          for (let dd = 1; dd <= 12; dd++) {
            const sc = V3[d][0] * V3[dd][0] + V3[d][1] * V3[dd][1] + V3[d][2] * V3[dd][2];
            if (sc > sBest) { sBest = sc; sDom = dd; }
          }
          if (DOTS[seedD][sDom] >= 128) { path.push([i, d]); return true; }
        }
        continue;
      }
      if (seen.has(ni) || painted[ni] || memo.has(ni * 13 + d)) continue;
      const rr = Math.hypot(Math.hypot(n[0] - CX, n[1] - CY) - R0, n[2] - CZ);
      if (Math.abs(rr - rt0) > SHELL_W) continue;
      cand.push([V3[d][0] * hv[0] + V3[d][1] * hv[1] + V3[d][2] * hv[2], d, ni, n]);
    }
    cand.sort((a, b) => b[0] - a[0]);
    for (const [, d, ni, n] of cand) {
      if (memo.has(ni * 13 + d)) continue;
      path.push([i, d]);
      if (depth === 0) seedD = d;
      seen.add(ni);
      if (dfs(ni, n[0], n[1], n[2], V3[d][0], V3[d][1], V3[d][2], depth + 1)) return true;
      seen.delete(ni); path.pop();
      memo.add(ni * 13 + d);
    }
    return false;
  };
  if (dfs(seedI, sx, sy, sz, 0, 0, 0, 0)) return { path, steps };
  if (DBG) console.log(`  seed(${sx},${sy},${sz}) exhausted dfs=${steps}`);
  return null;
}

// ---------- sweep ----------
mkdirSync(OUT, { recursive: true });
const manifest = [];
for (const R0 of R0S) {
  for (const R1 of R1S) {
    const t0 = Date.now();
    painted.fill(0); // fresh moat per geometry
    let loops = 0, attempts = 0, steepTurns = 0, cells = [];
    const cx = Math.round(CX), cy = Math.round(CY), cz = Math.round(CZ);
    for (let dz = -R1; dz <= R1; dz += SSTEP) {
      for (let dr = -R1; dr <= R1; dr += SSTEP) {
        if (Math.hypot(dr, dz) > R1) continue;
        attempts++;
        const sx = cx + Math.round(R0) + Math.round(dr);
        const r = trace(sx, cy, cz + Math.round(dz), R0);
        if (!r) continue;
        loops++;
        // Turn-angle audit on the closed loop (Phase Lock ≤60° per hop).
        const { path } = r;
        for (let k = 0; k < path.length; k++) {
          const [, pd] = path[k], [, nd] = path[(k + 1) % path.length];
          const iv = V3[pd];
          let bP = 0, bS = -Infinity;
          for (let dd = 1; dd <= 12; dd++) {
            const sc = iv[0] * V3[dd][0] + iv[1] * V3[dd][1] + iv[2] * V3[dd][2];
            if (sc > bS) { bS = sc; bP = dd; }
          }
          if (DOTS[nd][bP] < 128) steepTurns++;
        }
        for (const [i, d] of path) { painted[i] = 1; cells.push([...xyz(i), d]); }
      }
    }
    // Inflow audit: every painted cell should hear exactly one painted
    // predecessor; >1 means alien inflow rewires the knot at runtime.
    const spinOf = new Map(cells.map(([x, y, z, s]) => [idx(x, y, z), s]));
    let in0 = 0, in1 = 0, in2 = 0;
    for (const [x, y, z] of cells) {
      let inbound = 0;
      for (let d = 1; d <= 12; d++) {
        const n = nbr(x, y, z, d);
        if (!n) continue;
        const ns = spinOf.get(n[3]);
        if (ns === BACK3[d]) inbound++;
      }
      if (inbound === 1) in1++; else if (inbound === 0) in0++; else in2++;
    }
    const name = `hopfion_${R0}_${R1}`;
    const rec = {
      name, substrate: 'fcc12', dims: [W, H, D],
      R0, R1, q: Q, heat: HEAT, shellw: SHELL_W,
      loops, attempts, painted: cells.length,
      steepTurns, inflow: { dead: in0, clean: in1, alien: in2 },
      ms: Date.now() - t0,
      cells,
    };
    writeFileSync(join(OUT, `${name}.json`), JSON.stringify(rec));
    manifest.push({ name, loops, painted: cells.length, inflowClean: in1, alien: in2 });
    console.log(`${name}: ${loops}/${attempts} loops closed, ${cells.length} cells, ` +
      `steep=${steepTurns} inflow[0,1,>1]=${in0},${in1},${in2} (${Date.now() - t0}ms)`);
  }
}
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ dims: [W, H, D], generated: new Date().toISOString(), manifest }, null, 2));
console.log(`done — ${manifest.length} geometries in ${OUT}/`);
