#!/usr/bin/env node
/*
 * script/smatrix_classify.mjs — classify pulled smatrix job states.
 *
 * The GPU runner knows no provenance — knot allegiance lives in the
 * packer's .meta.json sidecar (painted masks), and the .smxst dumps are
 * raw 6B/node planes (q,s,heat16,buf,tn — runner order). This performs
 * collide.mjs's dual-BFS census + verdict logic offline:
 *
 *   fusion          — one live component contains painted A AND B cells
 *   annihilation    — no surviving painted component
 *   asymmetric      — only one side's painted component survives
 *   elastic_bounce  — both components survive, each retaining ≥90%
 *   degraded        — both survive but retention < 90%
 *   survival        — single-seed batches (no maskB): retainA alone
 *
 *   node script/smatrix_classify.mjs --job-dir=logs/smx-job-3 --meta=logs/smx-matrix.smx.meta.json
 *   (defaults: latest smx-job-* dir + newest *.smx.meta.json in logs/)
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { step } from './lib/p3.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : null;
}).filter(Boolean));

const logsDir = resolve('logs');
const jobDir = args['job-dir']
  ? resolve(args['job-dir'])
  : readdirSync(logsDir).filter(d => /^smx-job-\d+$/.test(d))
      .sort((a, b) => +b.slice(8) - +a.slice(8)).map(d => resolve(logsDir, d))[0];
// Default: newest .smx.meta.json by mtime (the most recently packed job).
const metaPath = args.meta ? resolve(args.meta)
  : readdirSync(logsDir).filter(f => f.endsWith('.smx.meta.json'))
      .map(f => resolve(logsDir, f))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
const [W, H, D] = meta.dims, N = W * H * D;

// collide.mjs uses 26-connectivity for component census.
const NB = [];
for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) for (const dz of [-1, 0, 1])
  if (dx || dy || dz) NB.push([dx, dy, dz]);

const visit = new Uint8Array(N), queue = new Int32Array(N);
const compFrom = (liveArr, maskA, maskB, seedIdx) => {
  if (seedIdx < 0) return null;
  visit.fill(0);
  let head = 0, tail = 0, live = 0, q = 0, pA = 0, pB = 0;
  let lx = 0, ly = 0, lz = 0;
  queue[tail++] = seedIdx; visit[seedIdx] = 1;
  while (head < tail) {
    const i = queue[head++];
    const x = i % W, y = ((i % (H * W)) / W) | 0, z = (i / (H * W)) | 0;
    live++; q += liveArr.q[i]; lx += x; ly += y; lz += z;
    if (maskA[i]) pA++; if (maskB[i]) pB++;
    for (const [dx, dy, dz] of NB) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H || nz < 0 || nz >= D) continue;
      const ni = (nz * H + ny) * W + nx;
      if (!visit[ni] && liveArr.q[ni] !== 0) { visit[ni] = 1; queue[tail++] = ni; }
    }
  }
  return { live, q, paintedA: pA, paintedB: pB,
           lcent: live ? [lx / live, ly / live, lz / live].map(v => +v.toFixed(2)) : null };
};

// Spin-cycle digraph on the live state — same logic as extractCycles but
// over the dumped planes: a live cell's successor is the cell its spin
// port points at (if that target is also live). Tells a re-tied remnant
// (closed cycles survive) from dead debris (free ends everywhere).
const cycVisit = new Uint8Array(N), cycSeen = new Int32Array(N);
const cycleCensus = (q, s) => {
  cycVisit.fill(0); cycSeen.fill(-1);
  let freeEnds = 0, maxCycle = 0, nCycles = 0;
  for (let i = 0; i < N; i++) {
    if (!q[i] || cycVisit[i]) continue;
    // walk the chain from i; record path positions for cycle recovery
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
    } else if (cur < 0) isFree = true;   // chain ended off-lattice/dead
    for (const j of path) { cycVisit[j] = 1; cycSeen[j] = -1; }
    if (isFree) freeEnds++;
  }
  return { freeEnds, maxCycle, nCycles };
};

const results = [];
for (const b of meta.batches) {
  const p = resolve(jobDir, `batch_${String(b.batch).padStart(2, '0')}.smxst`);
  if (!existsSync(p)) { console.log(`batch ${b.batch} ${b.name}: state not pulled yet`); continue; }
  const buf = readFileSync(p);
  const q = buf.subarray(0, N), s = buf.subarray(N, 2 * N);
  const liveArr = { q };
  const maskA = new Uint8Array(N), maskB = new Uint8Array(N);
  for (const i of b.maskA) maskA[i] = 1;
  for (const i of b.maskB ?? []) maskB[i] = 1;
  const origA = b.maskA.length, origB = (b.maskB ?? []).length;

  let live = 0, mass = 0, seedAi = -1, seedBi = -1;
  for (let i = 0; i < N; i++) {
    if (q[i] === 0) continue;
    live++; mass += q[i];
    if (seedAi < 0 && maskA[i]) seedAi = i;
    if (seedBi < 0 && maskB[i]) seedBi = i;
  }
  const compA = compFrom(liveArr, maskA, maskB, seedAi);
  const merged = compA && compA.paintedB > 0;
  const compB = (!merged && seedBi >= 0) ? compFrom(liveArr, maskA, maskB, seedBi) : null;
  const retA = compA ? compA.paintedA / origA : 0;
  const retB = origB === 0 ? null
    : merged ? compA.paintedB / origB : compB ? compB.paintedB / origB : 0;

  let verdict;
  if (origB === 0) verdict = 'survival';
  else if (merged) verdict = 'fusion';
  else if (!compA && !compB) verdict = 'annihilation';
  else if (!compA || !compB) verdict = 'asymmetric';
  else if (retA >= 0.9 && retB >= 0.9) verdict = 'elastic_bounce';
  else verdict = 'degraded';

  const cyc = cycleCensus(q, s);
  console.log(`${String(b.batch).padStart(2)} ${b.name.padEnd(14)} ${verdict.padEnd(13)}` +
    ` live=${live} mass=${mass} retainA=${retA.toFixed(4)}` +
    (retB === null ? '' : ` retainB=${retB.toFixed(4)}`) +
    ` cycles=${cyc.nCycles}/${cyc.maxCycle} freeEnds=${cyc.freeEnds}`);
  results.push({ batch: b.batch, name: b.name, seeds: b.seeds, axis: b.axis,
                 verdict, retainA: +retA.toFixed(4), retainB: retB === null ? null : +retB.toFixed(4),
                 live, mass, paintedA: origA, paintedB: origB,
                 spec: b.spec ?? null, cycles: cyc });
}
writeFileSync(jobDir + '-results.json', JSON.stringify({ jobDir, meta: metaPath, results }, null, 2));
console.log(`\n→ ${jobDir}-results.json (${results.length} classified)`);
