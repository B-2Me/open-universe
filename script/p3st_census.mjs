// p3st_census.mjs — census a P3ST state file (as dumped by planck3_test
// P3_DUMP): live cells, freeEnds, cycle count, longest cycle, plus a
// spatial profile of where live cells sit. Usage:
//   node script/p3st_census.mjs <file.bin> [file2.bin ...]
import { readFileSync } from 'node:fs';
import { step } from './lib/p3.mjs';

for (const f of process.argv.slice(2)) {
  const buf = readFileSync(f);
  if (buf.toString('ascii', 0, 4) !== 'P3ST') { console.log(`${f}: not P3ST`); continue; }
  const w = buf.readInt32LE(4), h = buf.readInt32LE(8), d = buf.readInt32LE(12);
  const n = w * h * d;
  const q  = buf.subarray(16, 16 + n);
  const s  = buf.subarray(16 + n, 16 + 2 * n);
  const idx = (x, y, z) => (z * h + y) * w + x;
  const dec = (i) => [i % w, ((i % (h * w)) / w) | 0, (i / (h * w)) | 0];

  let live = 0, mass = 0, spunDead = 0; // spunDead: s>0 but q=0 (induced aura)
  const liveSet = new Set();
  for (let i = 0; i < n; i++) {
    if (q[i]) { live++; mass += q[i]; liveSet.add(i); }
    else if (s[i]) spunDead++;
  }
  let freeEnds = 0;
  for (const i of liveSet) {
    const sp = s[i];
    if (!sp) { freeEnds++; continue; }
    const [x, y, z] = dec(i);
    const c = step(x, y, z, sp);
    if (c[2] < 0 || c[2] >= d) { freeEnds++; continue; }
    const k = idx(((c[0] % w) + w) % w, ((c[1] % h) + h) % h, c[2]);
    if (!liveSet.has(k)) freeEnds++;
  }
  const seen2 = new Set(); let maxCycle = 0, nCycles = 0, cycCells = 0;
  for (const i of liveSet) {
    if (seen2.has(i)) continue;
    const path = [], seen = new Map();
    let cur = i, hops = 0;
    while (cur >= 0 && !seen.has(cur) && !seen2.has(cur) && hops < 5000) {
      seen.set(cur, path.length); path.push(cur); seen2.add(cur); hops++;
      const sp = s[cur];
      if (!sp) { cur = -1; break; }
      const [x, y, z] = dec(cur);
      const c = step(x, y, z, sp);
      if (c[2] < 0 || c[2] >= d) { cur = -1; break; }
      const k = idx(((c[0] % w) + w) % w, ((c[1] % h) + h) % h, c[2]);
      cur = liveSet.has(k) ? k : -1;
    }
    if (cur >= 0 && seen.has(cur)) {
      const len = path.length - seen.get(cur);
      if (len > maxCycle) maxCycle = len;
      if (len > 2) { nCycles++; cycCells += len; }
    }
  }
  // live-cell bounding box
  let x0 = w, x1 = -1, y0 = h, y1 = -1, z0 = d, z1 = -1;
  for (const i of liveSet) {
    const [x, y, z] = dec(i);
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  console.log(`${f}`);
  console.log(`  live=${live} mass=${mass} freeEnds=${freeEnds} cycles=${nCycles} maxCyc=${maxCycle} cycCells=${cycCells}`);
  console.log(`  aura(s>0,q=0)=${spunDead} bbox x[${x0}..${x1}] y[${y0}..${y1}] z[${z0}..${z1}]`);
}
