// clock-ensemble-ac (E8b): the population clock's dilation curve.
// E8 showed the ensemble survives; now measure its MEAN period vs
// interior density via autocorrelation of the signed-momentum series â€”
// the statistical-clock dilation, coarse-grained the way the atomic
// regime demands.
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

const gridW = 72, gridH = 20, gridD = 20;
const MX0 = 10, MX1 = 60;
if (wasm._meso3i_init(gridW, gridH, gridD, 1) !== 0) throw new Error('init failed');
const nChannels = wasm._meso3i_nch(), nMoving = nChannels - 1, restCh = nChannels - 1;
const chanVec = []; let chPX = -1;
for (let ch = 0; ch < nMoving; ch++) {
  const dir = [wasm._meso3i_cvc(ch, 0), wasm._meso3i_cvc(ch, 1), wasm._meso3i_cvc(ch, 2)];
  chanVec.push(dir);
  if (dir[0] > 0 && dir[1] === 0 && dir[2] === 0) chPX = ch;
}
const signedMomX = () => {
  let mass = 0;
  for (let x = MX0 + 4; x < MX1; x++) for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++) {
    if ((x + y + z) & 1) continue;
    for (let ch = 0; ch < nMoving; ch++) if (chanVec[ch][0] !== 0)
      mass += chanVec[ch][0] * wasm._meso3i_get(x, y, z, ch);
  }
  return mass;
};
const acfPeak = (series, maxLag) => {
  const siteCount = series.length, mean = series.reduce((a, b) => a + b) / siteCount;
  let denom = 0; for (const vEff of series) denom += (vEff - mean) * (vEff - mean);
  if (!denom) return NaN;
  let best = -1, bestR = 0;
  for (let lag = 6; lag <= maxLag; lag++) {
    let sign = 0;
    for (let t = 0; t + lag < siteCount; t++) sign += (series[t] - mean) * (series[t + lag] - mean);
    const r = sign / denom;
    if (r > bestR) { bestR = r; best = lag; }
    if (best >= 0 && lag > 25 && r < bestR * 0.5) break; // past first peak
  }
  return { lag: best, r: bestR };
};
const run = density => {
  wasm._meso3i_init(gridW, gridH, gridD, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_fricp(128); wasm._meso3i_drest(0); wasm._meso3i_reflect(16);
  for (const xw of [MX0, MX1]) for (let x = xw; x < xw + 3; x++)
    for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++) {
      if ((x + y + z) & 1) continue;
      wasm._meso3i_set(x, y, z, restCh, 64);
    }
  if (density) for (let x = MX0 + 4; x < MX1; x++) for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++) {
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, restCh, density);
  }
  let injectedMass = 0;
  for (let x = MX0 + 6; x <= MX0 + 16; x++) for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++) {
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, chPX, 32); injectedMass += 32;
  }
  const series = [];
  for (let t = 0; t < 1200; t++) {
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    series.push(signedMomX());
  }
  // half-period = first strong ACF dip->peak of |mass|; use sign-flip counting too
  const { lag, r } = acfPeak(series, 120);
  const bounceTicks = []; let last = 0;
  for (let t = 0; t < series.length; t++) {
    const sign = Math.sign(series[t]);
    if (Math.abs(series[t]) < 40) continue;
    if (last !== 0 && sign !== last) bounceTicks.push(t);
    last = sign;
  }
  const gaps = bounceTicks.map((t, i) => i ? t - bounceTicks[i - 1] : null).filter(Boolean);
  const T = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : NaN;
  const sd = gaps.length > 1 ? Math.sqrt(gaps.reduce((a, b) => a + (b - T) ** 2, 0) / (gaps.length - 1)) : NaN;
  console.log(`density=${String(density).padStart(2)}  half=${T.toFixed(1)}Â±${sd.toFixed(1)}t  bounceTicks=${bounceTicks.length}  ACF lag=${lag} r=${r.toFixed(2)}`);
};
console.log('E8b â€” ensemble dilation: mean half-period vs interior density (1200t)');
for (const density of [0, 2, 4, 6, 8]) run(density);
