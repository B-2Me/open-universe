// clock-drift v2 (E1): does translation change a lump'sign internal cadence?
// The cycle we can measure headless: radiative turnover — movProfile quanta
// emitted per tick into the downstream wakeFlux of a self-radiating lump.
// A = static lump. B = same lump under sustained +x beam (morphology-
// drift regime — it actually translates). Beam confound is bounded by
// sampling only the wakeFlux emission, not the lit face.
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

const gridW = 72, gridH = 36, gridD = 36, centerX = 20, centerY = gridH >> 1, centerZ = gridD >> 1;
if (wasm._meso3i_init(gridW, gridH, gridD, 1) !== 0) throw new Error('init failed');
const nChannels = wasm._meso3i_nch(), nMoving = nChannels - 1, restCh = nChannels - 1;
const chanVec = [];
for (let ch = 0; ch < nMoving; ch++)
  chanVec.push([wasm._meso3i_cvc(ch, 0), wasm._meso3i_cvc(ch, 1), wasm._meso3i_cvc(ch, 2)]);

const resetEngine = () => {
  wasm._meso3i_init(gridW, gridH, gridD, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_drest(0); wasm._meso3i_fricp(128); wasm._meso3i_friccurve(0);
  wasm._meso3i_reflect(0);
};
const lump = () => {
  for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++) for (let x = 0; x < gridW; x++) {
    if ((x + y + z) & 1) continue;
    const dx = x - centerX, dy = y - centerY, dz = z - centerZ;
    if (dx * dx + dy * dy + dz * dz <= 25) wasm._meso3i_set(x, y, z, restCh, 96);
  }
};
const beam = () => {   // +x beam aimed at the lump (morphology-drift spoke(1))
  for (let ch = 0; ch < nMoving; ch++) {
    const [vx, vy, vz] = chanVec[ch];
    if (vx <= 0) continue;
    const sumX = centerX - 3 * vx, sumY = centerY - 3 * vy, sz = centerZ - 3 * vz;
    for (let reps = 0; reps < 4; reps++)
      wasm._meso3i_set(sumX, sumY, sz, ch, wasm._meso3i_get(sumX, sumY, sz, ch) + 1);
  }
};
// movProfile mass in the downstream wakeFlux slab (x in [cx+7, cx+11])
const wakeFlux = cx => {
  let mass = 0;
  for (let x = cx + 7; x <= cx + 11; x++) for (let z = centerZ - 8; z <= centerZ + 8; z++)
    for (let y = centerY - 8; y <= centerY + 8; y++) {
      if ((x + y + z) & 1) continue;
      for (let ch = 0; ch < nMoving; ch++) mass += wasm._meso3i_get(x, y, z, ch);
    }
  return mass;
};
const T = 400;
for (const withBeam of [false, true]) {
  resetEngine();
  lump();
  const series = [];
  for (let t = 0; t < T; t++) {
    if (withBeam) beam();
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    if (t >= 150 && t % 25 === 0) {
      wasm._meso3i_rg_refresh();
      series.push(`t${t}:wakeFlux=${wakeFlux(Math.round(wasm._meso3i_cm(0) / 256))},cm=${(wasm._meso3i_cm(0) / 256).toFixed(1)},rest=${wasm._meso3i_rest_mass()}`);
    }
  }
  console.log(`\siteCount${withBeam ? 'drifting (+x beam)' : 'static (no beam)'}`);
  for (const sign of series) console.log('  ' + sign);
}
