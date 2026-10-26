// clock-ensemble (E8): a population clock, not a single packet.
// E4 showed a lone packet decoheres at density>=2 â€” but an atomic clock is
// ~10^30 ensemble events. Inject a broad slab of +x flux (thousands of
// quanta) between the mirrors: does the ENSEMBLE's signed-momentum
// oscillation survive densities that kill a single particle?
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

const gridW = 72, gridH = 20, gridD = 20, centerY = gridH >> 1, centerZ = gridD >> 1;
const MX0 = 10, MX1 = 60;
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
  wasm._meso3i_fricp(128); wasm._meso3i_friccurve(0);
  wasm._meso3i_drest(0); wasm._meso3i_reflect(16);
};
const signedMomX = () => {
  let mass = 0;
  for (let x = MX0 + 4; x < MX1; x++) for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++) {
    if ((x + y + z) & 1) continue;
    for (let ch = 0; ch < nMoving; ch++) if (chanVec[ch][0] !== 0)
      mass += chanVec[ch][0] * wasm._meso3i_get(x, y, z, ch);
  }
  return mass;
};
const run = density => {
  resetEngine();
  for (const xw of [MX0, MX1]) for (let x = xw; x < xw + 3; x++)
    for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++) {
      if ((x + y + z) & 1) continue;
      wasm._meso3i_set(x, y, z, restCh, 64);
    }
  if (density) for (let x = MX0 + 4; x < MX1; x++) for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++) {
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, restCh, density);
  }
  // population: a broad +x slab â€” every parity site x in [16,26] gets flux
  let injectedMass = 0;
  for (let x = MX0 + 6; x <= MX0 + 16; x++) for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++) {
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, chPX, 32); injectedMass += 32;
  }
  const bounceTicks = []; let last = 0;
  for (let t = 0; t < 400; t++) {
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    const mass = signedMomX();
    if (Math.abs(mass) < 40) continue;        // scaled dead zone for the population
    const sign = Math.sign(mass);
    if (last !== 0 && sign !== last) bounceTicks.push(t);
    last = sign;
  }
  const gaps = bounceTicks.map((t, i) => i ? t - bounceTicks[i - 1] : null).filter(Boolean);
  const T = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : NaN;
  console.log(`density=${String(density).padStart(2)}  bounceTicks=[${bounceTicks.slice(0, 14).join(',')}${bounceTicks.length > 14 ? '...' : ''}]  T_half=${T.toFixed(1)}t  siteCount=${bounceTicks.length}`);
};
console.log('E8 â€” ensemble cavity: population oscillation vs density');
for (const density of [0, 2, 4, 6]) run(density);
