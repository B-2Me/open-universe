#!/usr/bin/env node
/**
 * smatrix_spectro.mjs — passive spectrum of a knot's breathing.
 *
 * Reads a run's dense .smxst dump series (pack with a small
 * dump_every — config/smatrix-spectro.json uses 5) and computes the
 * aggregate temporal power spectrum of the quanta and heat fields
 * over the painted cells: per-cell series -> |FFT|^2 -> summed over
 * the mask, so oscillations in arbitrary spatial phase still pile
 * into the same frequency bins. Peaks = natural mode periods.
 *
 *   node script/smatrix_spectro.mjs --dir=logs/smx-job-N --meta=<meta.json>
 *   (defaults: newest dir + newest *.meta.json under logs/)
 *
 * Also reports a "halo" spectrum: live UNPAINTED cells adjacent to the
 * mask — where driven-capture mass would live if a feed works.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const opt = (k, d) => {
  const m = process.argv.find(a => a === `--${k}` || a.startsWith(`--${k}=`));
  return m ? (m.includes('=') ? m.split('=')[1] : true) : d;
};
const LOGS = resolve('logs');
const dir = opt('dir') ? resolve(String(opt('dir')))
  : join(LOGS, readdirSync(LOGS).filter(d => /^smx-job-\d+/.test(d))
      .sort((a, b) => (+b.match(/\d+/)[0]) - (+a.match(/\d+/)[0]))[0]);
const metaPath = opt('meta') ? resolve(String(opt('meta')))
  : join(LOGS, readdirSync(LOGS).filter(f => f.endsWith('.smx.meta.json') || f.endsWith('.meta.json'))
      .sort().pop());
const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
const [W, H, D] = meta.dims, N = W * H * D, PLANE = N * 6;

// ---- frame series per batch ----
const frames = readdirSync(dir).filter(f => /^batch_\d+_t\d+\.smxst$/.test(f));
const ts = [...new Set(frames.map(f => +f.match(/t(\d+)\.smxst$/)[1]))].sort((a, b) => a - b);
const dt = ts.length > 1 ? ts[1] - ts[0] : 1;
const T = ts.length;
if (T < 8) { console.error(`need >=8 frames for a spectrum, have ${T} in ${dir}`); process.exit(1); }
console.log(`${dir}: ${T} frames, Δt=${dt} (Nyquist period ${2 * dt}) — ${meta.batches.length} batches`);

// ---- radix-2 FFT (iterative, real input -> power spectrum) ----
const fftPow = (re) => {
  const n = re.length, im = new Float64Array(n);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j |= bit;
    if (i < j) { const t = re[i]; re[i] = re[j]; re[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cwr = 1, cwi = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = i + k + len / 2;
        const tr = re[b] * cwr - im[b] * cwi, ti = re[b] * cwi + im[b] * cwr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const nw = cwr * wr - cwi * wi; cwi = cwr * wi + cwi * wr; cwr = nw;
      }
    }
  }
  const pw = new Float64Array(n / 2);
  for (let k = 0; k < n / 2; k++) pw[k] = re[k] * re[k] + im[k] * im[k];
  return pw;
};
const NFFT = 1 << Math.ceil(Math.log2(T));

// ---- neighbor offsets for halo detection (6-connected is plenty) ----
const NB = [1, -1, W, -W, W * H, -W * H];

for (const bmeta of meta.batches) {
  const b = bmeta.batch;
  const mask = new Uint8Array(N);
  for (const idx of bmeta.maskA ?? []) mask[idx] = 1;
  // frames for this batch, in t order
  const paths = ts.map(t => join(dir, `batch_${String(b).padStart(2, '0')}_t${String(t).padStart(5, '0')}.smxst`));
  if (!paths.every(existsSync)) { console.log(`batch ${b} ${bmeta.name}: incomplete series — skipped`); continue; }

  // power accumulators over painted cells; plus halo set built from frame0
  const specQ = new Float64Array(NFFT / 2), specH = new Float64Array(NFFT / 2);
  const specQh = new Float64Array(NFFT / 2);
  let nLive = 0, nHalo = 0;

  // First pass: halo = unpainted live cells 6-adjacent to mask (frame 0).
  const f0 = readFileSync(paths[0]);
  const q0 = f0.subarray(0, N);
  const halo = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (mask[i] || !q0[i]) continue;
    for (const o of NB) if (mask[i + o]) { halo[i] = 1; nHalo++; break; }
  }

  const reQ = new Float64Array(NFFT), reH = new Float64Array(NFFT), reQh = new Float64Array(NFFT);
  const seriesQ = new Uint8Array(T), seriesH = new Float64Array(T), seriesQh = new Uint8Array(T);
  const bufs = paths.map(p => readFileSync(p));
  for (let i = 0; i < N; i++) {
    if (!mask[i] && !halo[i]) continue;
    let mean = 0;
    for (let t = 0; t < T; t++) { seriesQ[t] = bufs[t][i]; seriesH[t] = bufs[t].readUInt16LE(2 * N + 2 * i); }
    for (let t = 0; t < T; t++) mean += seriesQ[t];
    mean /= T; if (mean === 0 && !mask[i]) continue; // never-live halo cell: skip
    if (mean > 0) nLive++;
    reQ.fill(0); reH.fill(0);
    for (let t = 0; t < T; t++) { reQ[t] = seriesQ[t] - mean; reH[t] = seriesH[t]; }
    // Hann window kills the ramp edge on non-integral periods
    for (let t = 0; t < T; t++) { const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * t / T); reQ[t] *= w; reH[t] *= w; }
    const pq = fftPow(reQ), ph = fftPow(reH);
    const dst = mask[i] ? [specQ, specH] : [specQh, null];
    for (let k = 0; k < pq.length; k++) { dst[0][k] += pq[k]; if (dst[1]) dst[1][k] += ph[k]; }
  }

  const top = (spec, label) => {
    const idx = [...spec.keys()].filter(k => k >= 2).sort((a, b) => spec[b] - spec[a]).slice(0, 5);
    console.log(`  ${label}: top periods ${idx.map(k => (NFFT / k * dt).toFixed(1)).join(', ')} (ticks)`);
  };
  console.log(`batch ${b} ${bmeta.name}: ${nLive} painted-live cells, ${nHalo} halo cells`);
  top(specQ, 'quanta (mask)');
  top(specH, 'heat   (mask)');
  if (nHalo) top(specQh, 'quanta (halo)');
}
