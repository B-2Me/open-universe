#!/usr/bin/env node
/* Spatial check on bath_knot: painted centroid + x-histogram over time,
   plus bath front propagation in bath_only. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const jobDir = resolve('logs/smx-job-22-v8-bath');
const meta = JSON.parse(readFileSync('logs/smx-v8-bath.smx.meta.json', 'utf8'));
const [W, H, D] = meta.dims, N = W * H * D;

const b = meta.batches[1]; // bath_knot
const maskA = new Uint8Array(N);
for (const i of b.maskA) maskA[i] = 1;
// original knot x-range
let x0 = 1e9, x1 = -1e9, cy = 0, cz = 0, cx = 0;
for (const i of b.maskA) {
  const x = i % W; if (x < x0) x0 = x; if (x > x1) x1 = x;
  cx += x; cy += ((i % (H * W)) / W) | 0; cz += (i / (H * W)) | 0;
}
console.log(`knot painted: n=${b.maskA.length} x=[${x0}..${x1}] centroid=(${(cx / b.maskA.length).toFixed(1)},${(cy / b.maskA.length).toFixed(1)},${(cz / b.maskA.length).toFixed(1)})`);

for (const t of [50, 100, 150, 200, 250, 400, 700, 1000]) {
  const f = `batch_01_t${String(t).padStart(5, '0')}.smxst`;
  const buf = readFileSync(resolve(jobDir, f));
  const q = buf.subarray(0, N);
  let n = 0, sx = 0, sy = 0, sz = 0;
  const xbins = new Array(8).fill(0); // x in 32-wide bins
  for (let i = 0; i < N; i++) {
    if (!q[i] || !maskA[i]) continue;
    const x = i % W; n++;
    sx += x; sy += ((i % (H * W)) / W) | 0; sz += (i / (H * W)) | 0;
    xbins[Math.min(7, x >> 5)]++;
  }
  console.log(`t${t} pA=${n} centroid=(${n ? (sx / n).toFixed(1) : '-'},${n ? (sy / n).toFixed(1) : '-'},${n ? (sz / n).toFixed(1) : '-'}) xbins=[${xbins.join(',')}]`);
}

// bath_only front: live-cell x-histogram at early times
const b0 = meta.batches[0];
for (const t of [50, 100, 150, 200, 250]) {
  const f = `batch_00_t${String(t).padStart(5, '0')}.smxst`;
  const buf = readFileSync(resolve(jobDir, f));
  const q = buf.subarray(0, N);
  const xbins = new Array(8).fill(0);
  for (let i = 0; i < N; i++) if (q[i]) xbins[Math.min(7, (i % W) >> 5)]++;
  console.log(`bath t${t} live xbins=[${xbins.join(',')}]`);
}
