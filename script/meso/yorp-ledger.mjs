// yorp-ledger: does IPHOT=3 absorption close the momentum books?
// No drain, no drive — a photon volley at a lump, totals() before
// and after each tick (totals now counts photon p under mode 3).
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
wasm._meso3i_collmode(0);
wasm._meso3i_friction(8);
wasm._meso3i_fricmode(-4);
wasm._meso3i_drest(1);
wasm._meso3i_phot(3);

const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
const CV = [];
for (let c = 0; c < NMOV; c++)
  CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);
const cpx = CV.findIndex(v => v[0] === 2 && !v[1] && !v[2]);

// lump at center
for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if ((x + y + z) & 1) continue;
  if ((x - CX) ** 2 + (y - CY) ** 2 + (z - CZ) ** 2 <= 25)
    wasm._meso3i_set(x, y, z, REST, 64);
}

const totals = () => {
  const m = wasm._malloc(8 * 4);
  wasm._meso3i_totals(m, m + 8, m + 16, m + 24);
  const h = new BigInt64Array(wasm.wasmMemory.buffer, m, 4);
  const out = [Number(h[0]), Number(h[1]), Number(h[2]), Number(h[3])];
  wasm._free(m);
  return out;
};

let [m0, px0, py0, pz0] = totals();
console.log(`t0: mass=${m0} p=(${px0},${py0},${pz0}) γ=${wasm._meso3i_photons()}`);
// volley: photons injected each tick at x=4 (no drain — momentum
// bookkeeping open: injection adds +2 per photon, absorption moves it
// from light to matter)
for (let t = 1; t <= 40; t++) {
  for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++)
    wasm._meso3i_phset(4, CY + dy, CZ + dz, cpx, 8);
  wasm._meso3i_tick();
  if (t % 10 === 0) {
    const [m, px, py, pz] = totals();
    console.log(`t${t}: mass=${m} p=(${px},${py},${pz}) γ=${wasm._meso3i_photons()}`);
  }
}
// stop the beam — let the system settle; momentum should stop changing
for (let t = 41; t <= 60; t++) wasm._meso3i_tick();
const [m1, px1, py1, pz1] = totals();
console.log(`t60 settled: mass=${m1} p=(${px1},${py1},${pz1}) γ=${wasm._meso3i_photons()}`);
