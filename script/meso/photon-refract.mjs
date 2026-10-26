// photon-refract: does IPHOT=4 delay light? Pulse through q=96 corridor;
// photon arrivals at x>=58 vs tick — resume-as-photon should show a late tail.
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
let XPX = -1;
for (let c = 0; c < NMOV; c++) {
  const v = [wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)];
  if (v[0] > 0 && v[1] === 0 && v[2] === 0) XPX = c;
}
const run = (phot, q) => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_fricp(128); wasm._meso3i_drest(0); wasm._meso3i_reflect(0);
  wasm._meso3i_phot(phot);
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = X0; x < X1; x++) {
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, REST, q);
  }
  for (let t = 0; t < 10; t++) { wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); }
  let m0 = 0;
  for (let dy = -3; dy <= 3; dy++) for (let dz = -3; dz <= 3; dz++) {
    const x = 8, y = CY + dy, z = CZ + dz;
    if ((x + y + z) & 1) continue;
    wasm._meso3i_phset(x, y, z, XPX, 64); m0 += 64;
  }
  // mean arrival delay: cumulative photon arrivals, mass-weighted t
  let cum = 0, wt = 0, peak = 0, tPeak = -1;
  for (let t = 0; t < 200; t++) {
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    let a = 0;
    for (let x = X2; x < W - 1; x++) for (let z = 0; z < D; z++) for (let y = 0; y < H; y++)
      if (!((x + y + z) & 1)) a += wasm._meso3i_phget(x, y, z, XPX);
    if (a > peak) { peak = a; tPeak = t; }
    cum += a; wt += a * t;
  }
  const meanT = cum > 0 ? wt / cum : -1;
  console.log(`IPHOT=${phot} q=${String(q).padStart(3)}  peak_t=${tPeak}  mean_t=${meanT.toFixed(1)}  total=${cum}`);
};
console.log('n(rho): photon pulse mean-arrival delay vs corridor density (IPHOT=4)');
run(0, 0);    // vacuum control
for (const q of [16, 32, 48, 64, 96]) run(4, q);
