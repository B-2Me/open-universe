// pair-test: the wind/unwind cycle on the loom-meso branch.
//   WIND   — two antipodal axial beams collide head-on at a node;
//            does rest mass accumulate only when IPAIR is on?
//   UNWIND — a lump under carrier transit radiates; with IPAIR the
//            emitted flux should be antipodally balanced (c vs c^1).
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
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
const CV = [];
for (let c = 0; c < NMOV; c++)
  CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);
const CX = W >> 1, CY = H >> 1, CZ = D >> 1;
const cPX = CV.findIndex(v => v[0] === 2 && v[1] === 0 && v[2] === 0);   // +x axial
const cMX = CV.findIndex(v => v[0] === -2 && v[1] === 0 && v[2] === 0); // -x axial

const boot = pair => {
  wasm._meso3i_clear();
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8);
  wasm._meso3i_fricmode(-4); wasm._meso3i_phot(0); wasm._meso3i_pair(pair);
};
const led = () => { wasm._meso3i_rg_refresh();
  return `rest=${wasm._meso3i_rest_mass()} flux=${wasm._meso3i_mov_mass()}`; };
const step = () => { wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); };

// --- WIND: antipodal head-on collision ----------------------------------
// +x beam enters the target from x=T-2; -x beam from x=T+2. Both land
// on the target every tick: a standing pair-collision.
for (const pair of [0, 1]) {
  boot(pair);
  const T = [36, 36, 18];
  for (let t = 0; t < 300; t++) {
    // inject 4 quanta/tick upstream on each side
    for (let u = 0; u < 4; u++) {
      wasm._meso3i_set(T[0] - 2, T[1], T[2], cPX, wasm._meso3i_get(T[0] - 2, T[1], T[2], cPX) + 1);
      wasm._meso3i_set(T[0] + 2, T[1], T[2], cMX, wasm._meso3i_get(T[0] + 2, T[1], T[2], cMX) + 1);
    }
    step();
  }
  const r = wasm._meso3i_get(T[0], T[1], T[2], REST);
  console.log(`WIND  IPAIR=${pair}: rest at collision node = ${r} · ${led()}`);
}

// --- UNWIND: lump under transit, emitted-flux antipodal balance ---------
const seedLump = () => {
  for (let dz = -5; dz <= 5; dz++)
  for (let dy = -5; dy <= 5; dy++)
  for (let dx = -5; dx <= 5; dx++) {
    if (dx*dx + dy*dy + dz*dz > 25) continue;
    const x = CX+dx, y = CY+dy, z = CZ+dz;
    if (((x+y+z)&1) !== 0 || x<0||x>=W||y<0||y>=H||z<0||z>=D) continue;
    wasm._meso3i_set(x, y, z, REST, 96);
  }
};
const spokes = () => {          // the drive — carriers that license emission
  for (let c = 0; c < NMOV; c++) {
    const [vx, vy, vz] = CV[c];
    const sx = CX - 3*vx, sy = CY - 3*vy, sz = CZ - 3*vz;
    for (let u = 0; u < 4; u++)
      wasm._meso3i_set(sx, sy, sz, c, wasm._meso3i_get(sx, sy, sz, c) + 1);
  }
};
for (const pair of [0, 1]) {
  boot(pair); seedLump();
  wasm._meso3i_rg_refresh();
  const r0 = wasm._meso3i_rest_mass();
  for (let t = 0; t < 300; t++) { spokes(); step(); }
  // antipodal flux balance across the whole lattice
  let balance = 0, tot = 0;
  for (let s = 0; s < W*H*D; s += 7)      // sparse sample, ~1/7th of sites
    for (let c = 0; c < NMOV; c += 2) {
      const x = s % W, y = (s / W | 0) % H, z = s / (W * H) | 0;
      const a = wasm._meso3i_get(x, y, z, c), b = wasm._meso3i_get(x, y, z, c ^ 1);
      balance += Math.abs(a - b); tot += a + b;
    }
  wasm._meso3i_rg_refresh();
  console.log(`UNWIND IPAIR=${pair}: rest ${r0} -> ${wasm._meso3i_rest_mass()} · ` +
    `moving flux=${wasm._meso3i_mov_mass()} · antipodal imbalance ${balance}/${tot} ` +
    `(${(100*balance/Math.max(1,tot)).toFixed(1)}%)`);
}
