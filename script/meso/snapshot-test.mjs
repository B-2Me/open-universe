// snapshot-test: does save/restore now produce bit-for-bit replay?
// scenario mixes every saved subsystem: parked mass (iLT counters
// grow under transit), photons in flight, drive injection, latency>1.
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
wasm._meso3i_phot(2);
wasm._meso3i_pair(1);
wasm._meso3i_lat(4);

const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
const CV = [];
for (let c = 0; c < NMOV; c++)
  CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);
const CX = W >> 1, CY = H >> 1, CZ = D >> 1;
const cBeam = CV.findIndex(v => v[0] === 2 && !v[1] && !v[2]);

// lump + drive + beam every tick — the full entangled scene
const seedLump = () => {
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x + y + z) & 1) continue;
    if ((x - CX) ** 2 + (y - CY) ** 2 + (z - CZ) ** 2 <= 25)
      wasm._meso3i_set(x, y, z, REST, 64);
  }
};
const inject = () => {
  // sparse drive — enough transit to grow iLT counters without
  // instantly erasing the lump
  for (let c = 0; c < NMOV; c += 3) {
    const [vx, vy, vz] = CV[c];
    const sx = CX - 3 * vx, sy = CY - 3 * vy, sz = CZ - 3 * vz;
    wasm._meso3i_set(sx, sy, sz, c, wasm._meso3i_get(sx, sy, sz, c) + 1);
  }
  wasm._meso3i_phset(4, CY, CZ, cBeam, 16);
  wasm._meso3i_phset(6, CY + 2, CZ + 2, cBeam, 16);
};
const run = n => { for (let i = 0; i < n; i++) { inject(); wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); } };

// FNV-1a over every channel + photon cell — a full-state fingerprint
const hash = () => {
  let h = 0x811c9dc5;
  const mix = v => { h ^= v; h = Math.imul(h, 0x01000193) >>> 0; };
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    for (let c = 0; c < NCH; c++) mix(wasm._meso3i_get(x, y, z, c));
    for (let c = 0; c < NMOV; c++) mix(wasm._meso3i_phget(x, y, z, c));
  }
  return h >>> 0;
};

seedLump();
run(60);
wasm._meso3i_rg_refresh();
const rSave = wasm._meso3i_rest_mass(), mSave = wasm._meso3i_mov_mass();
console.log(`t60 primed (rest=${rSave} flux=${mSave}) — saving snapshot`);
wasm._meso3i_save();
const gSave = wasm._meso3i_photons();
run(80);
wasm._meso3i_rg_refresh();
const hA = hash(), rA = wasm._meso3i_rest_mass(), mA = wasm._meso3i_mov_mass(), pA = wasm._meso3i_photons();
console.log(`run A → t140: hash=${hA.toString(16)} rest=${rA} flux=${mA} γ=${pA}`);

console.log('restoring… γ before restore:', wasm._meso3i_photons(), '(saved state had', gSave + ')');
if (wasm._meso3i_restore() !== 0) throw new Error('restore failed');
console.log('after restore: γ =', wasm._meso3i_photons(), '(must equal', gSave + ')');
run(80);
wasm._meso3i_rg_refresh();
const hB = hash(), rB = wasm._meso3i_rest_mass(), mB = wasm._meso3i_mov_mass(), pB = wasm._meso3i_photons();
console.log(`run B → t140: hash=${hB.toString(16)} rest=${rB} flux=${mB} γ=${pB}`);
console.log(hA === hB ? 'DETERMINISTIC: bit-for-bit replay ✓' : 'MISMATCH: restore is lossy ✗');
