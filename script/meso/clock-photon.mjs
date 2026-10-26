// clock-photon (E7): photons never collide and carry no mass — the pure
// transit probe. Same corridor geometry as clock-lag: photon +x packet
// timed through rest density q — if transit is invariant even at q>=8
// (where the mov pulse got eaten), photons are the control that proves
// the lag mechanics are collision-driven.
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
const boot = () => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_fricp(128); wasm._meso3i_friccurve(0); wasm._meso3i_drest(0);
  wasm._meso3i_reflect(0); wasm._meso3i_phot(2);   // photon channel live
};
const seedCorridor = q => {
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = X0; x < X1; x++) {
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, REST, q);
  }
};
const phZone = () => {
  let m = 0;
  for (let x = X2; x <= X2 + 3; x++) for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) {
    if ((x + y + z) & 1) continue;
    m += wasm._meso3i_phget(x, y, z, XPX);
  }
  return m;
};
const run = q => {
  boot();
  seedCorridor(q);
  for (let t = 0; t < 20; t++) { wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); }
  let m0 = 0;
  for (let dy = -3; dy <= 3; dy++) for (let dz = -3; dz <= 3; dz++) {
    const x = 8, y = CY + dy, z = CZ + dz;
    if ((x + y + z) & 1) continue;
    wasm._meso3i_phset(x, y, z, XPX, 64); m0 += 64;
  }
  let tHit = -1;
  for (let t = 0; t < 200; t++) {
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    if (tHit < 0 && phZone() >= 12) tHit = t;
    if (tHit > 0 && t > tHit + 20) break;
  }
  console.log(`q=${String(q).padStart(2)}  t=${tHit > 0 ? tHit : 'no arrival'}  v=${tHit > 0 ? ((X2 - 10) / tHit).toFixed(2) : '--'}  photons=${wasm._meso3i_photons()}`);
};
console.log('E7 — photon transit through rest corridor (massless control)');
for (const q of [0, 8, 32, 96]) run(q);
