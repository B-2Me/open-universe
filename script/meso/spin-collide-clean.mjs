// spin-collide-clean: M45 with NO drive. Lumps self-radiate
// (fricm=8 unconditional boil) — each lump's own carrier field is the
// only coupling medium. Any spin transfer / weld collapse here is
// lump-generated, not lamp-mediated.
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
  wasm._meso3i_fricmode(8);      // self-radiating — NO drive anywhere
  wasm._meso3i_lat(1);
  wasm._meso3i_drest(1);
};

const woundLump = (lx, R, Q, s) => {
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x + y + z) & 1) continue;
    const dx = x - lx, dy = y - CY, dz = z - CZ;
    if (dx * dx + dy * dy + dz * dz > R * R) continue;
    wasm._meso3i_set(x, y, z, REST, Q);
    if (s) {
      const vx = -s * dy, vy = s * dx;
      for (let c = 0; c < NMOV; c++) {
        const d = vx * CV[c][0] + vy * CV[c][1];
        if (d > 0) wasm._meso3i_rset(x, y, z, c, Math.min(255, Math.round(d * 8)));
      }
    }
  }
};
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

// per-region parked Lz + parked mass + scalar rest
const region = (lx, RR) => {
  let Lr = 0, pk = 0, sc = 0;
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x - lx) ** 2 + (y - CY) ** 2 + (z - CZ) ** 2 > RR * RR) continue;
    sc += wasm._meso3i_get(x, y, z, REST);
    let rx = 0, ry = 0;
    for (let c = 0; c < NMOV; c++) {
      const n = wasm._meso3i_rget(x, y, z, c);
      rx += n * CV[c][0]; ry += n * CV[c][1]; pk += n;
    }
    Lr += (x - lx) * ry - (y - CY) * rx;
  }
  return [Lr, pk, sc];
};

const run = (tag, seedFn, regions, T = 200) => {
  boot(); seedFn();
  console.log(`\n=== ${tag} ===`);
  for (let t = 0; t <= T; t++) {
    if (t % 25 === 0) {
      const out = regions.map(([lx, rr]) => {
        const [L, pk, sc] = region(lx, rr);
        return `L=${String(L).padStart(6)}/pk=${pk}/sc=${sc}`;
      }).join('  ');
      console.log(`t${String(t).padStart(3)}: ${out}`);
    }
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
  }
};

const SEP = 8;
run('antiparallel (+Lz vs -Lz)', () => { woundLump(CX - SEP, 4, 48, +1); woundLump(CX + SEP, 4, 48, -1); },
  [[CX - SEP, 7], [CX + SEP, 7]]);
run('parallel (+Lz vs +Lz)', () => { woundLump(CX - SEP, 4, 48, +1); woundLump(CX + SEP, 4, 48, +1); },
  [[CX - SEP, 7], [CX + SEP, 7]]);
run('induction (+Lz vs cold)', () => { woundLump(CX - SEP, 4, 48, +1); woundLump(CX + SEP, 4, 48, 0); },
  [[CX - SEP, 7], [CX + SEP, 7]]);
run('weld (one lump, halves counter-rotate)', () => weldLump(6, 48, +1),
  [[CX - 4, 5], [CX + 4, 5]]);
