// photon-refract: does IPHOT=4 delay light? Pulse through density=96 corridor;
// photon arrivals at x>=58 vs tick â€” resume-as-photon should show a late tail.
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
const X0 = 14, X2 = 58;
if (wasm._meso3i_init(gridW, gridH, gridD, 1) !== 0) throw new Error('init failed');
const nChannels = wasm._meso3i_nch(), nMoving = nChannels - 1, restCh = nChannels - 1;
let chPX = -1;
for (let ch = 0; ch < nMoving; ch++) {
  const dir = [wasm._meso3i_cvc(ch, 0), wasm._meso3i_cvc(ch, 1), wasm._meso3i_cvc(ch, 2)];
  if (dir[0] > 0 && dir[1] === 0 && dir[2] === 0) chPX = ch;
}
const run = (phot, density, L) => { const X1 = X0 + L;
  wasm._meso3i_init(gridW, gridH, gridD, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_fricp(128); wasm._meso3i_drest(0); wasm._meso3i_reflect(0);
  wasm._meso3i_phot(phot);
  for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++) for (let x = X0; x < X1; x++) {
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, restCh, density);
  }
  for (let t = 0; t < 10; t++) { wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); }
  let injectedMass = 0;
  for (let dy = -3; dy <= 3; dy++) for (let dz = -3; dz <= 3; dz++) {
    const x = 8, y = centerY + dy, z = centerZ + dz;
    if ((x + y + z) & 1) continue;
    wasm._meso3i_phset(x, y, z, chPX, 64); injectedMass += 64;
  }
  // mean arrival delay: cumulative photon arrivals, mass-weighted t
  let cum = 0, wt = 0, peak = 0, tPeak = -1;
  for (let t = 0; t < 200; t++) {
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    let a = 0;
    for (let x = X2; x < gridW - 1; x++) for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++)
      if (!((x + y + z) & 1)) a += wasm._meso3i_phget(x, y, z, chPX);
    if (a > peak) { peak = a; tPeak = t; }
    cum += a; wt += a * t;
  }
  const meanT = cum > 0 ? wt / cum : -1;
  console.log(`IPHOT=${phot} density=${density} L=${String(L).padStart(2)}  peak_t=${tPeak}  mean_t=${meanT.toFixed(1)}  total=${cum}`);
};
console.log('L-sweep: photon delay vs corridor length at density=32 (bulk-vs-boundary test)');
run(0, 0, 38);            // vacuum, same flight distance
for (const L of [8, 16, 24, 32, 38]) run(4, 32, L);
