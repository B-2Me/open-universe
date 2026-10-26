// clock-photon (E7): photons never collide and carry no mass — the pure
// transit sampleMoments. Same corridor geometry as clock-lag: photon +x packet
// timed through rest density density — if transit is invariant even at density>=8
// (where the moving pulse got eaten), photons are the control that proves
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

const gridW = 72, gridH = 24, gridD = 24, centerY = gridH >> 1, centerZ = gridD >> 1;
const X0 = 14, X1 = 52, X2 = 58;
if (wasm._meso3i_init(gridW, gridH, gridD, 1) !== 0) throw new Error('init failed');
const nChannels = wasm._meso3i_nch(), nMoving = nChannels - 1, restCh = nChannels - 1;
const chanVec = []; let chPX = -1;
for (let ch = 0; ch < nMoving; ch++) {
  const dir = [wasm._meso3i_cvc(ch, 0), wasm._meso3i_cvc(ch, 1), wasm._meso3i_cvc(ch, 2)];
  chanVec.push(dir);
  if (dir[0] > 0 && dir[1] === 0 && dir[2] === 0) chPX = ch;
}
const resetEngine = () => {
  wasm._meso3i_init(gridW, gridH, gridD, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_fricp(128); wasm._meso3i_friccurve(0); wasm._meso3i_drest(0);
  wasm._meso3i_reflect(0); wasm._meso3i_phot(2);   // photon channel live
};
const seedCorridor = density => {
  for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++) for (let x = X0; x < X1; x++) {
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, restCh, density);
  }
};
const zonePhotons = () => {
  let mass = 0;
  for (let x = X2; x <= X2 + 3; x++) for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++) {
    if ((x + y + z) & 1) continue;
    mass += wasm._meso3i_phget(x, y, z, chPX);
  }
  return mass;
};
const run = density => {
  resetEngine();
  seedCorridor(density);
  for (let t = 0; t < 20; t++) { wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); }
  let injectedMass = 0;
  for (let dy = -3; dy <= 3; dy++) for (let dz = -3; dz <= 3; dz++) {
    const x = 8, y = centerY + dy, z = centerZ + dz;
    if ((x + y + z) & 1) continue;
    wasm._meso3i_phset(x, y, z, chPX, 64); injectedMass += 64;
  }
  let tArrived = -1;
  for (let t = 0; t < 200; t++) {
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    if (tArrived < 0 && zonePhotons() >= 12) tArrived = t;
    if (tArrived > 0 && t > tArrived + 20) break;
  }
  console.log(`density=${String(density).padStart(2)}  t=${tArrived > 0 ? tArrived : 'no arrival'}  vEff=${tArrived > 0 ? ((X2 - 10) / tArrived).toFixed(2) : '--'}  photons=${wasm._meso3i_photons()}`);
};
console.log('E7 — photon transit through rest corridor (massless control)');
for (const density of [0, 8, 32, 96]) run(density);
