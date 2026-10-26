// photon-matter (E9): does light pay a toll through matter?
// IPHOT=2 stimulated: photon survives, kicks parked mass onto its channel.
// IPHOT=3 absorbed: photon consumed on contact, momentum -> mass eject.
// Rest corridor q=96 x in [14,52]; sustained +x photon sheet from x=8;
// measure transmitted photons past x>=58, knocked-out mov downstream,
// and corridor rest loss. The refractive/attenuation analog.
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

const W = 72, H = 24, D = 24, CY = H >> 1, CZ = D >> 1;
const X0 = 14, X1 = 52, X2 = 58;
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
const CV = []; let XPX = -1;
for (let c = 0; c < NMOV; c++) {
  const v = [wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)];
  CV.push(v);
  if (v[0] > 0 && v[1] === 0 && v[2] === 0) XPX = c;
}
const boot = phot => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_fricp(128); wasm._meso3i_friccurve(0); wasm._meso3i_drest(0);
  wasm._meso3i_reflect(0); wasm._meso3i_phot(phot);
};
const seedCorridor = q => {
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = X0; x < X1; x++) {
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, REST, q);
  }
};
const beam = () => {   // sustained photon sheet entering the corridor
  for (let z = 4; z < D - 4; z++) for (let y = 4; y < H - 4; y++) {
    if ((8 + y + z) & 1) continue;
    wasm._meso3i_phset(8, y, z, XPX, 48);
  }
};
const phThru = () => {
  let m = 0;
  for (let x = X2; x < W - 1; x++) for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) {
    if ((x + y + z) & 1) continue;
    for (let c = 0; c < NMOV; c++) m += wasm._meso3i_phget(x, y, z, c);
  }
  return m;
};
const movOut = () => {
  let m = 0;
  for (let x = X1; x < W - 1; x++) for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) {
    if ((x + y + z) & 1) continue;
    for (let c = 0; c < NMOV; c++) m += wasm._meso3i_get(x, y, z, c);
  }
  return m;
};
const run = (phot, q) => {
  boot(phot); seedCorridor(q); wasm._meso3i_ev_reset();
  const R0 = (() => { wasm._meso3i_rg_refresh(); return wasm._meso3i_rest_mass(); })();
  for (let t = 0; t < 300; t++) { beam(); wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); }
  wasm._meso3i_rg_refresh();
  console.log(`IPHOT=${phot} q=${q}  rest ${R0}->${wasm._meso3i_rest_mass()}  phThru=${phThru()}  movOut=${movOut()}  peject=${wasm._meso3i_ev(5).toFixed(0)}`);
};
console.log('E9 — light through matter: photon coupling vs corridor density');
for (const phot of [2, 3, 4]) for (const q of [0, 96]) run(phot, q);
