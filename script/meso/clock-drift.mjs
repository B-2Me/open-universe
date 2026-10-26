// clock-drift v2 (E1): does translation change a lump's internal cadence?
// The cycle we can measure headless: radiative turnover — mov quanta
// emitted per tick into the downstream wake of a self-radiating lump.
// A = static lump. B = same lump under sustained +x beam (morphology-
// drift regime — it actually translates). Beam confound is bounded by
// sampling only the wake emission, not the lit face.
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

const W = 72, H = 36, D = 36, CX = 20, CY = H >> 1, CZ = D >> 1;
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
const CV = [];
for (let c = 0; c < NMOV; c++)
  CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);

const boot = () => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_drest(0); wasm._meso3i_fricp(128); wasm._meso3i_friccurve(0);
  wasm._meso3i_reflect(0);
};
const lump = () => {
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x + y + z) & 1) continue;
    const dx = x - CX, dy = y - CY, dz = z - CZ;
    if (dx * dx + dy * dy + dz * dz <= 25) wasm._meso3i_set(x, y, z, REST, 96);
  }
};
const beam = () => {   // +x beam aimed at the lump (morphology-drift spoke(1))
  for (let c = 0; c < NMOV; c++) {
    const [vx, vy, vz] = CV[c];
    if (vx <= 0) continue;
    const sx = CX - 3 * vx, sy = CY - 3 * vy, sz = CZ - 3 * vz;
    for (let u = 0; u < 4; u++)
      wasm._meso3i_set(sx, sy, sz, c, wasm._meso3i_get(sx, sy, sz, c) + 1);
  }
};
// mov mass in the downstream wake slab (x in [cx+7, cx+11])
const wake = cx => {
  let m = 0;
  for (let x = cx + 7; x <= cx + 11; x++) for (let z = CZ - 8; z <= CZ + 8; z++)
    for (let y = CY - 8; y <= CY + 8; y++) {
      if ((x + y + z) & 1) continue;
      for (let c = 0; c < NMOV; c++) m += wasm._meso3i_get(x, y, z, c);
    }
  return m;
};
const T = 400;
for (const useBeam of [false, true]) {
  boot();
  lump();
  const series = [];
  for (let t = 0; t < T; t++) {
    if (useBeam) beam();
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    if (t >= 150 && t % 25 === 0) {
      wasm._meso3i_rg_refresh();
      series.push(`t${t}:wake=${wake(Math.round(wasm._meso3i_cm(0) / 256))},cm=${(wasm._meso3i_cm(0) / 256).toFixed(1)},rest=${wasm._meso3i_rest_mass()}`);
    }
  }
  console.log(`\n${useBeam ? 'drifting (+x beam)' : 'static (no beam)'}`);
  for (const s of series) console.log('  ' + s);
}
