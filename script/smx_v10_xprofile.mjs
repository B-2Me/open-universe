#!/usr/bin/env node
/* x-profile of live/mass at t1000 for beam0/beamA/beamB/beam2 —
   localizes the +419k excess in beamB and its absence in beam2. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const jobDir = resolve('logs/smx-job-24-v10-shadow');
const meta = JSON.parse(readFileSync('logs/smx-v10-shadow.smx.meta.json', 'utf8'));
const [W, H, D] = meta.dims, N = W * H * D;

for (const [b, name] of [[0, 'beam2'], [1, 'beamA'], [2, 'beamB'], [3, 'beam0']]) {
  const f = `batch_0${b}_t01000.smxst`;
  const buf = readFileSync(resolve(jobDir, f));
  const q = buf.subarray(0, N);
  const xl = new Array(8).fill(0), xm = new Array(8).fill(0);
  for (let i = 0; i < N; i++) {
    if (!q[i]) continue;
    const x = i % W, bin = Math.min(7, x >> 5);
    xl[bin]++; xm[bin] += q[i];
  }
  console.log(`${name}: live=[${xl.join(',')}]`);
  console.log(`${name}: mass=[${xm.join(',')}]`);
}
// Painted-mask positions for reference
const b2 = meta.batches[0];
let ax = 0, bx = 0;
for (const i of b2.maskA) ax += i % W;
for (const i of b2.maskB) bx += i % W;
console.log(`knot A centroid x=${(ax / b2.maskA.length).toFixed(1)}, knot B centroid x=${(bx / b2.maskB.length).toFixed(1)}`);
