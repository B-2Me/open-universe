// clock-ensemble-ac (E8b): the population clock's dilation curve.
// E8 showed the ensemble survives; now measure its MEAN period vs
// interior density via autocorrelation of the signed-momentum series —
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

const W = 72, H = 20, D = 20;
const MX0 = 10, MX1 = 60;
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
const CV = []; let XPX = -1;
for (let c = 0; c < NMOV; c++) {
  const v = [wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)];
  CV.push(v);
  if (v[0] > 0 && v[1] === 0 && v[2] === 0) XPX = c;
}
const momX = () => {
  let m = 0;
  for (let x = MX0 + 4; x < MX1; x++) for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) {
    if ((x + y + z) & 1) continue;
    for (let c = 0; c < NMOV; c++) if (CV[c][0] !== 0)
      m += CV[c][0] * wasm._meso3i_get(x, y, z, c);
  }
  return m;
};
const acfPeak = (series, maxLag) => {
  const n = series.length, mean = series.reduce((a, b) => a + b) / n;
  let denom = 0; for (const v of series) denom += (v - mean) * (v - mean);
  if (!denom) return NaN;
  let best = -1, bestR = 0;
  for (let lag = 6; lag <= maxLag; lag++) {
    let s = 0;
    for (let t = 0; t + lag < n; t++) s += (series[t] - mean) * (series[t + lag] - mean);
    const r = s / denom;
    if (r > bestR) { bestR = r; best = lag; }
    if (best >= 0 && lag > 25 && r < bestR * 0.5) break; // past first peak
  }
  return { lag: best, r: bestR };
};
const run = q => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_fricp(128); wasm._meso3i_drest(0); wasm._meso3i_reflect(16);
  for (const xw of [MX0, MX1]) for (let x = xw; x < xw + 3; x++)
    for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) {
      if ((x + y + z) & 1) continue;
      wasm._meso3i_set(x, y, z, REST, 64);
    }
  if (q) for (let x = MX0 + 4; x < MX1; x++) for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) {
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, REST, q);
  }
  let m0 = 0;
  for (let x = MX0 + 6; x <= MX0 + 16; x++) for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) {
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, XPX, 32); m0 += 32;
  }
  const series = [];
  for (let t = 0; t < 1200; t++) {
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    series.push(momX());
  }
  // half-period = first strong ACF dip->peak of |m|; use sign-flip counting too
  const { lag, r } = acfPeak(series, 120);
  const flips = []; let last = 0;
  for (let t = 0; t < series.length; t++) {
    const s = Math.sign(series[t]);
    if (Math.abs(series[t]) < 40) continue;
    if (last !== 0 && s !== last) flips.push(t);
    last = s;
  }
  const d = flips.map((t, i) => i ? t - flips[i - 1] : null).filter(Boolean);
  const T = d.length ? d.reduce((a, b) => a + b, 0) / d.length : NaN;
  const sd = d.length > 1 ? Math.sqrt(d.reduce((a, b) => a + (b - T) ** 2, 0) / (d.length - 1)) : NaN;
  console.log(`q=${String(q).padStart(2)}  half=${T.toFixed(1)}±${sd.toFixed(1)}t  flips=${flips.length}  ACF lag=${lag} r=${r.toFixed(2)}`);
};
console.log('E8b — ensemble dilation: mean half-period vs interior density (1200t)');
for (const q of [0, 2, 4, 6, 8]) run(q);
