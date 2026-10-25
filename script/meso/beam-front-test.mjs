// beam-front-test: verify the apertured plane-wave laser fires on
// every axial direction, stays collimated in flight, and grazes
// off-center when OffU/OffV shift the aperture.
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
wasm._meso3i_collmode(0);
wasm._meso3i_friction(8);
wasm._meso3i_fricmode(-4);
wasm._meso3i_phot(0);            // uncoupled — pure propagation test

const NCH = wasm._meso3i_nch(), NMOV = NCH - 1;
const CV = [];
for (let c = 0; c < NMOV; c++)
  CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);
const AXIS = { x: 0, y: 1, z: 2 };
const DIM = [W, H, D], CTR = [W >> 1, H >> 1, D >> 1];
const PHV = 8;

// --- replica of the UI's beamFire() ---------------------------------------
const beamFire = (bdir, bap, bou, bov) => {
  const a = AXIS[bdir[1]], s = bdir[0] === '+' ? 1 : -1;
  const c = CV.findIndex(v => v[a] === 2 * s && !v[(a + 1) % 3] && !v[(a + 2) % 3]);
  const u = (a + 1) % 3, w = (a + 2) % 3;
  const p0 = s > 0 ? 4 : DIM[a] - 5;
  const pt = [0, 0, 0]; pt[a] = p0;
  let n = 0;
  for (let du = -bap; du <= bap; du++)
  for (let dv = -bap; dv <= bap; dv++) {
    if (du * du + dv * dv > bap * bap) continue;
    pt[u] = CTR[u] + bou + du;
    pt[w] = CTR[w] + bov + dv;
    if (pt[u] < 0 || pt[u] >= DIM[u] || pt[w] < 0 || pt[w] >= DIM[w]) continue;
    wasm._meso3i_phset(pt[0], pt[1], pt[2], c, PHV);
    n++;
  }
  return { n, c, a };
};

// beam cross-section at a slab coordinate along axis a:
// returns occupied (u,v) cells of photons riding beam channel c
const cross = (a, c, coord) => {
  const out = [];
  const u = (a + 1) % 3, w = (a + 2) % 3;
  for (let i = 0; i < DIM[u]; i++) for (let j = 0; j < DIM[w]; j++) {
    const pt = [0, 0, 0];
    pt[a] = coord; pt[u] = i; pt[w] = j;
    const v = wasm._meso3i_phget(pt[0], pt[1], pt[2], c);
    if (v) out.push([i - CTR[u], j - CTR[w], v]);
  }
  return out;
};

console.log('=== direction sweep: each axial beam, aperture 4 ===');
for (const dir of ['+x', '-x', '+y', '-y', '+z', '-z']) {
  wasm._meso3i_clear();
  const { n, c, a } = beamFire(dir, 4, 0, 0);
  // fire 8 more times so the beam reaches mid-flight
  for (let i = 0; i < 7; i++) { beamFire(dir, 4, 0, 0); wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); }
  // probe a plane 12 cells from the source along the beam axis
  const s = dir[0] === '+' ? 1 : -1;
  const mid = s > 0 ? 4 + 12 : DIM[a] - 5 - 12;
  const xs = cross(a, c, mid).filter(([, , v]) => v > 0);
  const g = wasm._meso3i_photons();
  const us = xs.map(p => p[0]), vs = xs.map(p => p[1]);
  const box = xs.length
    ? `u∈[${Math.min(...us)},${Math.max(...us)}] v∈[${Math.min(...vs)},${Math.max(...vs)}] n=${xs.length}`
    : 'empty';
  console.log(`  ${dir}: ${n} src sites (ch ${c}) · γ_total=${g} · plane ${a === 0 ? 'x' : a === 1 ? 'y' : 'z'}=${mid} footprint ${box}`);
}

console.log('=== off-center graze: +x beam, OffU=+6 (should shift footprint in u) ===');
wasm._meso3i_clear();
for (let i = 0; i < 12; i++) { beamFire('+x', 4, 6, 0); wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); }
const cx = cross(0, CV.findIndex(v => v[0] === 2 && !v[1] && !v[2]), 16);
const us = cx.map(p => p[0]);
console.log(`  +x beam OffU=6 → u footprint [${Math.min(...us)},${Math.max(...us)}] at x=16 (expect ~+6±4)`);

console.log('=== ablation check: plane wave vs lump (Phot=stimulated) ===');
wasm._meso3i_clear();
wasm._meso3i_phot(2);
// seed a cold lump at center
const CX = CTR[0], CY = CTR[1], CZ = CTR[2];
let seed = 0;
for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if ((x + y + z) & 1) continue;
  const r2 = (x - CX) ** 2 + (y - CY) ** 2 + (z - CZ) ** 2;
  if (r2 <= 25) { wasm._meso3i_set(x, y, z, NCH - 1, 64); seed += 64; }
}
wasm._meso3i_rg_refresh();
const before = wasm._meso3i_rest_mass();
// fire +x plane wave straight at it for 120 ticks
const ch = CV.findIndex(v => v[0] === 2 && !v[1] && !v[2]);
for (let i = 0; i < 120; i++) { beamFire('+x', 4, 0, 0); wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); }
wasm._meso3i_rg_refresh();
console.log(`  lump ${before} → ${wasm._meso3i_rest_mass()} rest after 120t of plane wave`);
