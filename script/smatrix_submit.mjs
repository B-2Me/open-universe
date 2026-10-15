#!/usr/bin/env node
/*
 * smatrix_submit.mjs — push jobs from this machine to the GPU box's
 * smatrix listener over LAN.
 *
 *   # pack + push in one step
 *   node script/smatrix_submit.mjs --config=config/smatrix-smoke.json --host=192.168.1.50
 *
 *   # push an existing job file
 *   node script/smatrix_submit.mjs --job=logs/smx-validate.smx --host=192.168.1.50
 *
 *   --port=9898   --watch[=15]   poll GET /status during the run
 *   --pull        when done, download every batch's final state into
 *                 logs/smx-job-<id>/ for local classification
 *
 * The meta sidecar (<job>.meta.json) travels as a sibling file — pull
 * fetches it back too so provenance survives the round trip.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, createReadStream, createWriteStream, openSync, readSync, writeSync, closeSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import { gzipSync } from 'node:zlib';
import { ROOT, LOGDIR, arg, loadConfig, opts } from './lib/p3.mjs';

const CFG = loadConfig();
const { opt, num } = opts(CFG);

const HOST = String(opt('host', 'localhost'));
const PORT = num('port', 9898);
const WATCH = (() => { const v = opt('watch', 0); return v === true ? 15 : parseFloat(v); })();
const PULL = !!opt('pull', false);
const RAW = !!opt('raw', false);      // --raw: upload the .smx verbatim (old listener, no smxz)
const BASE = `http://${HOST}:${PORT}`;

// ---- pack if needed ----
let jobPath = opt('job', null) ? resolve(ROOT, String(opt('job'))) : null;
const cfgPath = arg('config');
if (!jobPath && cfgPath) {
  jobPath = join(LOGDIR, `smx-submit-${Date.now()}.smx`);
  console.log(`packing ${cfgPath} → ${jobPath}`);
  execFileSync('node', [join(ROOT, 'script', 'smatrix_pack.mjs'), `--config=${cfgPath}`, `--out=${jobPath}`], { stdio: 'inherit' });
}
if (!jobPath || !existsSync(jobPath)) { console.error('need --config=… or --job=…smx'); process.exit(1); }
const metaPath = jobPath + '.meta.json';
const STEM = basename(jobPath).replace(/\.smx$/, '');

// ---- SMXZ block-gzip container ----
// "SMXZ" u32 nblocks; per block: u32 ulen, u32 clen, gzip-member[clen].
// Job planes are mostly zeros → ~200x smaller on the wire. The listener
// sniffs the magic and inflates block-wise (puff.c) before queueing.
const CHUNK = 64 << 20;
const packSmxz = (src, dst) => {
  const size = statSync(src).size;
  const nb = Math.ceil(size / CHUNK);
  const inFd = openSync(src, 'r'), outFd = openSync(dst, 'w');
  const hdr = Buffer.alloc(8); hdr.write('SMXZ'); hdr.writeUInt32LE(nb, 4);
  writeSync(outFd, hdr);
  for (let b = 0; b < nb; b++) {
    const len = Math.min(CHUNK, size - b * CHUNK);
    const buf = Buffer.alloc(len);
    readSync(inFd, buf, 0, len, b * CHUNK);
    const gz = gzipSync(buf, { level: 6 });
    const bh = Buffer.alloc(8); bh.writeUInt32LE(len, 0); bh.writeUInt32LE(gz.length, 4);
    writeSync(outFd, bh); writeSync(outFd, gz);
  }
  closeSync(inFd); closeSync(outFd);
  return statSync(dst).size;
};

let uploadPath = jobPath;
if (!RAW) {
  const smxz = jobPath + '.smxz';
  if (!existsSync(smxz) || statSync(smxz).mtimeMs < statSync(jobPath).mtimeMs) {
    const t = Date.now();
    const zsize = packSmxz(jobPath, smxz);
    console.log(`smxz: ${(statSync(jobPath).size / 1e6).toFixed(1)} MB → ${(zsize / 1e6).toFixed(1)} MB (${((Date.now() - t) / 1000).toFixed(0)}s)`);
  }
  uploadPath = smxz;
}

// ---- tiny HTTP helpers (streaming upload — job files run GB-scale) ----
const get = (p) => new Promise((res, rej) => {
  http.get(BASE + p, (r) => {
    const chunks = [];
    r.on('data', c => chunks.push(c));
    r.on('end', () => res({ code: r.statusCode, body: Buffer.concat(chunks) }));
  }).on('error', rej);
});
const getFile = (p, dest) => new Promise((res, rej) => {
  http.get(BASE + p, (r) => {
    if (r.statusCode !== 200) { r.resume(); return res(false); }
    const ws = createWriteStream(dest);
    r.pipe(ws); ws.on('finish', () => res(true));
  }).on('error', rej);
});
const postFile = (p, file) => new Promise((res, rej) => {
  const size = statSync(file).size;
  const req = http.request(BASE + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': size },
  }, (r) => {
    const chunks = [];
    r.on('data', c => chunks.push(c));
    r.on('end', () => res({ code: r.statusCode, body: Buffer.concat(chunks).toString() }));
  });
  req.on('error', rej);
  createReadStream(file).pipe(req);
});

// ---- submit ----
const size = statSync(uploadPath).size;
console.log(`POST ${BASE}/job  ${basename(uploadPath)} (${(size / 1e6).toFixed(1)} MB)`);
const t0 = Date.now();
const resp = await postFile('/job', uploadPath);
if (resp.code !== 200) { console.error(`submit failed: HTTP ${resp.code} ${resp.body}`); process.exit(1); }
const { id } = JSON.parse(resp.body);
console.log(`→ queued as job ${id} (${((Date.now() - t0) / 1000).toFixed(1)}s upload)`);

// ship the sidecar too (small JSON — reuse the same channel)
if (existsSync(metaPath)) {
  // The listener stores only the .smx; keep the meta locally associated
  // by job id (+ stem: remote ids reset on listener restart — the stem
  // stops a reused id from clobbering another job's pulled states).
  const localMeta = join(LOGDIR, `smx-job-${id}-${STEM}.meta.json`);
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  meta.remoteJobId = id; meta.remoteHost = BASE; meta.jobFile = jobPath;
  writeFileSync(localMeta, JSON.stringify(meta));
}

// ---- watch ----
if (WATCH) {
  console.log(`watching every ${WATCH}s (Ctrl+C to detach — job keeps running)`);
  let done = false;
  while (!done) {
    await new Promise(r => setTimeout(r, WATCH * 1000));
    try {
      const { code, body } = await get('/status');
      if (code !== 200) { console.log('  status: unreachable'); continue; }
      const st = JSON.parse(body.toString());
      const phase = st.phase ?? 'idle';
      console.log(`  ${phase}${st.t != null ? ' t' + st.t : ''}` +
        (st.sprayEvents != null ? ` spray=${st.sprayEvents}` : ''));
      if (phase === 'done' || phase === 'idle') done = true;
    } catch (e) { console.log(`  poll failed: ${e.message}`); }
  }
}

// ---- pull results ----
if (PULL) {
  const dir = join(LOGDIR, `smx-job-${id}-${STEM}`);
  mkdirSync(dir, { recursive: true });
  // Only pull status.json + latest per-batch state — intermediate dump
  // frames stay remote (a dumpEvery run can produce GB-scale frames).
  const metaPathId = join(LOGDIR, `smx-job-${id}-${STEM}.meta.json`);
  const meta = existsSync(metaPathId)
    ? JSON.parse(readFileSync(metaPathId, 'utf8')) : null;
  if (await getFile(`/file/${id}/status.json`, join(dir, 'status.json')))
    console.log('  status.json');
  const nb = meta?.batch ?? 0;
  for (let b = 0; b < nb; b++) {
    const dest = join(dir, `batch_${String(b).padStart(2, '0')}.smxst`);
    if (await getFile(`/state/${id}/${b}`, dest)) console.log(`  batch ${b} → ${dest}`);
  }
  if (meta) writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta));
}
console.log('done');
