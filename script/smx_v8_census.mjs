#!/usr/bin/env node
/*
 * script/smx_v8_census.mjs — time-series census over a pulled job's dumps.
 * Per batch x dump: live, mass, freeEnds, nCycles, maxCycle, painted-A
 * survival. Same spin-cycle digraph as smatrix_classify.mjs.
 *   node script/smx_v8_census.mjs --job-dir=logs/smx-job-XX --meta=logs/foo.smx.meta.json
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { step } from './lib/p3.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : null;
}).filter(Boolean));
const jobDir = resolve(args['job-dir'] ?? 'logs/smx-job-22-v8-bath');
const meta = JSON.parse(readFileSync(args.meta ?? 'logs/smx-v8-bath.smx.meta.json', 'utf8'));
const [W, H, D] = meta.dims, N = W * H * D;

const cycVisit = new Uint8Array(N), cycSeen = new Int32Array(N);
const cycleCensus = (q, s) => {
  cycVisit.fill(0); cycSeen.fill(-1);
  let freeEnds = 0, maxCycle = 0, nCycles = 0;
  for (let i = 0; i < N; i++) {
    if (!q[i] || cycVisit[i]) continue;
    let cur = i; const path = [];
    while (cur >= 0 && !cycVisit[cur] && cycSeen[cur] < 0) {
      cycSeen[cur] = path.length; path.push(cur);
      const x = cur % W, y = ((cur % (H * W)) / W) | 0, z = (cur / (H * W)) | 0;
      const sp = s[cur];
      cur = -1;
      if (sp) {
        const [nx, ny, nz] = step(x, y, z, sp);
        if (nx >= 0 && nx < W && ny >= 0 && ny < H && nz >= 0 && nz < D) {
          const ni = (nz * H + ny) * W + nx;
          if (q[ni]) cur = ni;
        }
      }
    }
    let isFree = false;
    if (cur >= 0 && cycSeen[cur] >= 0) {
      const len = path.length - cycSeen[cur];
      nCycles++; if (len > maxCycle) maxCycle = len;
    } else if (cur < 0) isFree = true;
    for (const j of path) { cycVisit[j] = 1; cycSeen[j] = -1; }
    if (isFree) freeEnds++;
  }
  return { freeEnds, maxCycle, nCycles };
};

for (const b of meta.batches) {
  const maskA = new Uint8Array(N);
  for (const i of b.maskA) maskA[i] = 1;
  const origA = b.maskA.length;
  const files = readdirSync(jobDir)
    .filter(f => f.startsWith(`batch_${String(b.batch).padStart(2, '0')}_t`) && f.endsWith('.smxst'))
    .sort();
  console.log(`\n== ${b.name} (batch ${b.batch}, painted ${origA}) ==`);
  for (const f of files) {
    const buf = readFileSync(resolve(jobDir, f));
    const q = buf.subarray(0, N), s = buf.subarray(N, 2 * N);
    let live = 0, mass = 0, pA = 0;
    for (let i = 0; i < N; i++) {
      if (!q[i]) continue;
      live++; mass += q[i];
      if (maskA[i]) pA++;
    }
    const cc = cycleCensus(q, s);
    const t = f.match(/t(\d+)\.smxst/)[1];
    console.log(`t${t} live=${live} mass=${mass} pA=${pA}/${origA}` +
      ` freeEnds=${cc.freeEnds} cycles=${cc.nCycles} maxCyc=${cc.maxCycle}`);
  }
}
