#!/usr/bin/env node
/**
 * smatrix_resume.mjs — resume a dead run from pulled .smxst snapshots.
 *
 * The .smxst dump is exactly the job file's per-batch state plane
 * (n×6-byte node blob), so a continuation job is a header splice:
 * copy the original header (with ticks patched to the REMAINING
 * count) + scenario table + force list, then append the pulled dumps
 * as the state section. Emitters/force schedules keep firing — true
 * continuation semantics.
 *
 *   node script/smatrix_resume.mjs --job=logs/smx-v2.smx \
 *     --dir=logs/smx-job-7-t250 --ticks=750 --out=logs/smx-v2-r250.smx
 *
 * Dumps are auto-picked at the greatest common t across all batches.
 * --batches=28,30  resumes only those batch indices (subset job).
 * --forces=0     strips the force table (emitter-off continuation).
 * --dumpevery=N  overrides the header dump interval.
 * Then submit with:  node script/smatrix_submit.mjs --job=<out>.smx …
 * (the .meta.json sidecar is copied too — painted masks still classify,
 *  with .batch reindexed for subset jobs).
 */
import { readFileSync, writeFileSync, openSync, readSync, writeSync, closeSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';

const arg = (k, d) => {
  const m = process.argv.find(a => a === `--${k}` || a.startsWith(`--${k}=`));
  return m ? (m.includes('=') ? m.split('=')[1] : true) : d;
};
const JOB = resolve(String(arg('job', '')));
const DIR = resolve(String(arg('dir', '')));
const TICKS = parseInt(arg('ticks', '0'), 10);
const OUT = resolve(String(arg('out', '')));
const SEL = arg('batches', null);
const KEEP_FORCES = arg('forces', '1') !== '0' && arg('forces', '1') !== 0;
const DUMPEVERY = arg('dumpevery', null) ? parseInt(arg('dumpevery'), 10) : null;
if (!JOB || !DIR || !TICKS || !OUT) {
  console.error('need --job=<orig.smx> --dir=<pulled dumps> --ticks=<remaining> --out=<new.smx>');
  process.exit(1);
}

// ---- parse original header (48B) + tables ----
const hdr = Buffer.alloc(48);
{ const f = openSync(JOB, 'r'); readSync(f, hdr, 0, 48, 0); closeSync(f); }
if (hdr.readUInt32LE(0) !== 0x31584d53) { console.error('bad SMX1 magic'); process.exit(1); }
const BATCH = hdr.readUInt32LE(8);
const W = hdr.readUInt32LE(12), H = hdr.readUInt32LE(16), D = hdr.readUInt32LE(20);
const OLD_TICKS = hdr.readUInt32LE(24);
const N_FORCE = hdr.readUInt32LE(32);
const N = W * H * D, PLANE = N * 6;
const sel = SEL ? String(SEL).split(',').map(Number) : [...Array(BATCH).keys()];
for (const b of sel) if (b < 0 || b >= BATCH) { console.error(`batch ${b} out of range`); process.exit(1); }
const NF_OUT = KEEP_FORCES ? N_FORCE : 0;
const SCEN = 48, FORCE_TAB = SCEN + BATCH * 40;
console.log(`${basename(JOB)}: ${BATCH}×${W}×${H}×${D}, ${OLD_TICKS} ticks, ${N_FORCE} force pts` +
            ` → ${sel.length} batches, ${NF_OUT} forces`);

// ---- locate dumps at the greatest common t ----
const byT = new Map(); // t -> Map(batch -> path)
for (const f of readdirSync(DIR)) {
  const m = f.match(/^batch_(\d+)_t(\d+)\.smxst$/);
  if (!m) continue;
  const [, b, t] = m.map(Number);
  if (!byT.has(t)) byT.set(t, new Map());
  byT.get(t).set(b, resolve(DIR, f));
}
const common = [...byT.entries()].filter(([, m]) => sel.every(b => m.has(b))).sort((a, b) => b[0] - a[0]);
if (!common.length) { console.error(`no t covering selected batches in ${DIR}`); process.exit(1); }
const [t, files] = common[0];
console.log(`using t=${t} snapshots`);

// ---- splice ----
hdr.writeUInt32LE(TICKS, 24);
hdr.writeUInt32LE(sel.length, 8);
if (DUMPEVERY) hdr.writeUInt32LE(DUMPEVERY, 28);
hdr.writeUInt32LE(NF_OUT, 32);
const fd = openSync(OUT, 'w');
writeSync(fd, hdr);
{ const f = openSync(JOB, 'r');
  for (const b of sel) {                       // selected 40B scenario records
    const rec = Buffer.alloc(40);
    readSync(f, rec, 0, 40, SCEN + b * 40);
    writeSync(fd, rec);
  }
  if (NF_OUT) {                                // force table verbatim
    const tab = Buffer.alloc(NF_OUT * 8);
    let off = 0; while (off < tab.length) off += readSync(f, tab, off, tab.length - off, FORCE_TAB + off);
    writeSync(fd, tab);
  }
  closeSync(f); }
for (const b of sel) {
  const p = files.get(b);
  const sz = statSync(p).size;
  if (sz !== PLANE) { console.error(`${basename(p)}: ${sz} B ≠ ${PLANE} — wrong dims?`); process.exit(1); }
  writeSync(fd, readFileSync(p));
}
closeSync(fd);

// meta sidecar — same provenance, reindexed for subset jobs
const metaSrc = JOB + '.meta.json';
try {
  const meta = JSON.parse(readFileSync(metaSrc, 'utf8'));
  meta.ticks = TICKS; meta.resumedFrom = { job: basename(JOB), t };
  meta.batches = sel.map((b, i) => ({ ...meta.batches[b], batch: i, resumedBatch: b }));
  writeFileSync(OUT + '.meta.json', JSON.stringify(meta));
} catch { try { copyFileSync(metaSrc, OUT + '.meta.json'); } catch {} }
console.log(`→ ${OUT}  (${(statSync(OUT).size / 1e9).toFixed(2)} GB, ${TICKS} remaining ticks, resumes at t=${t})`);
console.log(`→ ${OUT}.meta.json`);
