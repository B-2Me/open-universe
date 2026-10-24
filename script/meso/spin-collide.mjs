// spin-collide: the spin-spin collision experiment.
// Lumps can't be thrown (parked mass doesn't translate), so this is a
// CONTACT experiment: two adjacent wound lumps plus a "weld" control —
// one lump whose two halves counter-rotate.
//
// Wound lump = scalar bulk + directional bins encoding rigid rotation:
//   at offset (dx,dy): v = ω(−dy, dx) → rest[c] ∝ max(0, v·ĉ)
//
// Cases: antiparallel (+−), parallel (++), induction (+0), weld (+|−
// inside one lump). Drive on: interface couples via carrier transit.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso3i.js'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'require', '__dirname', '__filename', src)
  (mod, mod.exports, require, join(here, '../../docs/public/wasm/ember'), 'meso3i.js');
const wasm = await mod.exports();

const W = 72, H = 72, D = 36;
const CX = W >> 1, CY = H >> 1, CZ = D >> 1;
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');

const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
const CV = [];
for (let c = 0; c < NMOV; c++)
  CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);

const boot = () => {
  wasm._meso3i_clear();
  wasm._meso3i_collmode(0);
  wasm._meso3i_friction(8);
  wasm._meso3i_fricmode(-4);
  wasm._meso3i_lat(1);
  wasm._meso3i_drest(1);
};

// lump at (lx,CY,CZ), radius R, bulk Q, wound with sign s (0=cold)
const woundLump = (lx, R, Q, s) => {
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x + y + z) & 1) continue;
    const dx = x - lx, dy = y - CY, dz = z - CZ;
    if (dx * dx + dy * dy + dz * dz > R * R) continue;
    wasm._meso3i_set(x, y, z, REST, Q);
    if (s) {
      // rigid rotation about z: v = s·ω·(−dy, dx, 0)
      const vx = -s * dy, vy = s * dx;
      for (let c = 0; c < NMOV; c++) {
        const d = vx * CV[c][0] + vy * CV[c][1];
        if (d > 0) wasm._meso3i_rset(x, y, z, c, Math.min(255, Math.round(d * 8)));
      }
    }
  }
};
// weld: single lump at center, x<XL spins s, x>=XL spins −s
const weldLump = (R, Q, s) => {
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x + y + z) & 1) continue;
    const dx = x - CX, dy = y - CY, dz = z - CZ;
    if (dx * dx + dy * dy + dz * dz > R * R) continue;
    wasm._meso3i_set(x, y, z, REST, Q);
    const sg = dx < 0 ? s : -s;
    const vx = -sg * dy, vy = sg * dx;
    for (let c = 0; c < NMOV; c++) {
      const d = vx * CV[c][0] + vy * CV[c][1];
      if (d > 0) wasm._meso3i_rset(x, y, z, c, Math.min(255, Math.round(d * 8)));
    }
  }
};
const drive = () => {
  for (let c = 0; c < NMOV; c++) {
    const [vx, vy, vz] = CV[c];
    wasm._meso3i_set(CX - 3 * vx, CY - 3 * vy, CZ - 3 * vz, c,
      wasm._meso3i_get(CX - 3 * vx, CY - 3 * vy, CZ - 3 * vz, c) + 4);
  }
};
// Lz_park + parked mass inside a region centered (lx, CY, CZ), r<=RR
const region = (lx, RR) => {
  let Lr = 0, pk = 0;
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x - lx) ** 2 + (y - CY) ** 2 + (z - CZ) ** 2 > RR * RR) continue;
    let rx = 0, ry = 0;
    for (let c = 0; c < NMOV; c++) {
      const n = wasm._meso3i_rget(x, y, z, c);
      rx += n * CV[c][0]; ry += n * CV[c][1]; pk += n;
    }
    Lr += (x - lx) * ry - (y - CY) * rx;
  }
  return [Lr, pk];
};

const run = (tag, seedFn, regions, T = 300) => {
  boot(); seedFn();
  console.log(`\n=== ${tag} ===`);
  for (let t = 0; t <= T; t++) {
    if (t % 60 === 0) {
      const out = regions.map(([lx, rr]) => {
        const [L, pk] = region(lx, rr);
        return `L=${String(L).padStart(6)}/pk=${pk}`;
      }).join('  ');
      wasm._meso3i_rg_refresh();
      console.log(`t${String(t).padStart(3)}: ${out} · rest=${wasm._meso3i_rest_mass()}`);
    }
    drive();
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
  }
};

const SEP = 8;   // R4 lumps at ±8: ~4-cell gap between surfaces at t0
run('antiparallel (+Lz vs −Lz)', () => { woundLump(CX - SEP, 4, 48, +1); woundLump(CX + SEP, 4, 48, -1); },
  [[CX - SEP, 7], [CX + SEP, 7]]);
run('parallel (+Lz vs +Lz)', () => { woundLump(CX - SEP, 4, 48, +1); woundLump(CX + SEP, 4, 48, +1); },
  [[CX - SEP, 7], [CX + SEP, 7]]);
run('induction (+Lz vs cold)', () => { woundLump(CX - SEP, 4, 48, +1); woundLump(CX + SEP, 4, 48, 0); },
  [[CX - SEP, 7], [CX + SEP, 7]]);
run('weld (one lump, halves counter-rotate)', () => weldLump(6, 48, +1),
  [[CX - 4, 5], [CX + 4, 5]]);
