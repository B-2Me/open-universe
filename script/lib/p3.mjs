/*
 * p3.mjs — shared plumbing for the planck3 headless harness suite.
 *
 * One canonical copy of the pieces every experiment script was
 * duplicating: wasm glue loading, --flag/--key=val + config merge,
 * the FCC neighbor table (verbatim from planck3.c HOFF/POFF), the
 * fixed-point port vectors (V3), P3ST bulk-load packing, per-run
 * heartbeat writers, and the live/freeEnds/maxCycle census.
 *
 * Import from script/*.mjs:
 *   import { ROOT, arg, opts, loadPlanck3, HOFF, step, V3, nearestPort,
 *            packLoad, heartbeat, makeCensus } from './lib/p3.mjs';
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
export const LOGDIR = resolve(ROOT, 'logs');
mkdirSync(LOGDIR, { recursive: true });

// ---------- CLI: --flag (bool) / --key=val, merged over a config file ----
export const arg = (k) => {
  const m = process.argv.find(a => a === `--${k}` || a.startsWith(`--${k}=`));
  return m ? (m.includes('=') ? m.split('=')[1] : true) : undefined;
};
export const loadConfig = (defPath = null) => {
  const p = arg('config') ?? defPath;
  return p ? JSON.parse(readFileSync(resolve(ROOT, String(p)), 'utf8')) : {};
};
export const opts = (CFG) => {
  const opt = (k, d) => { const v = arg(k); return v !== undefined ? v : (CFG[k] !== undefined ? CFG[k] : d); };
  const num = (k, d) => parseFloat(opt(k, d));
  return { opt, num };
};

// ---------- wasm glue (MODULARIZE build → exports createPlanck3) ----------
export async function loadPlanck3(wasmJs) {
  const path = resolve(ROOT, wasmJs);
  if (!existsSync(path)) { console.error(`wasm glue not found: ${path}`); process.exit(1); }
  const glueSrc = readFileSync(path, 'utf8');
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', '__dirname', '__filename',
    glueSrc)(mod, mod.exports, createRequire(path), dirname(path), path);
  const createPlanck3 = mod.exports;
  if (typeof createPlanck3 !== 'function') { console.error('glue did not export createPlanck3'); process.exit(1); }
  const wasm = await createPlanck3();
  wasm.heap8 = () => new Uint8Array(wasm.wasmMemory.buffer);
  return wasm;
}

// Standard init sequence shared by every harness.
export function initEngine(wasm, { w, h, d, diss = 15, limit = 50000, mode = 0, sync = 0 }) {
  if (wasm._planck3_init_dims(w, h, d) !== 0) { console.error('init_dims rejected'); return false; }
  wasm._planck3_set_dissipation(diss);
  wasm._planck3_set_thermal_limit(limit);
  wasm._planck3_set_mode(mode);
  if (wasm._planck3_set_sync) wasm._planck3_set_sync(sync);
  wasm._planck3_reset_stats();
  return true;
}

// ---------- FCC lattice geometry (verbatim from planck3.c HOFF/POFF) ----
// Index 0 is padding; equatorial ports 1-6 planar, zenith 7-9 lift via
// odd hex dirs, nadir 10-12 drop via even hex dirs.
export const HOFF = [
  [[0,0],[1,0],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1]],   // y even
  [[0,0],[1,0],[1,1],[0,1],[-1,0],[0,-1],[1,-1]],     // y odd
];
export const ZU = [1, 3, 5], ZD = [2, 4, 6];
export const step = (x, y, z, p) => {
  const par = y & 1;
  if (p <= 6) { const o = HOFF[par][p]; return [x + o[0], y + o[1], z]; }
  const j = (p - 7) % 3, up = p <= 9;
  const o = HOFF[par][(up ? ZU : ZD)[j]];
  return [x + o[0], y + o[1], z + (up ? 1 : -1)];
};

// Port direction vectors in the engine's fixed-point embedding:
// planar ports length-256, axial ports FP-planar + FZ.
export const HEX_MX = [0, 256, 128, -128, -256, -128, 128];
export const HEX_MY = [0, 0, 222, 222, 0, -222, -222];
export const FZ = 209, FP = 148;
export const V3 = [null];
for (let s = 1; s <= 6; s++) V3.push([HEX_MX[s], HEX_MY[s], 0]);
for (const d of [1, 3, 5]) V3.push([Math.round(HEX_MX[d] * FP / 256), Math.round(HEX_MY[d] * FP / 256), FZ]);
for (const d of [2, 4, 6]) V3.push([Math.round(HEX_MX[d] * FP / 256), Math.round(HEX_MY[d] * FP / 256), -FZ]);

export const nearestPort = (dx, dy, dz) => {
  let best = 1, bd = -Infinity;
  for (let p = 1; p <= 12; p++) {
    const dd = dx * V3[p][0] + dy * V3[p][1] + dz * V3[p][2];
    if (dd > bd) { bd = dd; best = p; }
  }
  return best;
};

// ---------- absorbing boundary (sponge) --------------------------------
// makeDrain(w,h,d,margin) → precomputed boundary-shell index list plus an
// apply(mem,statePtr) that zeroes quanta+buffer and halves heat on those
// cells, returning the absorbed mass. Apply in the same pre-tick slot as
// the pinch (writes to the published state the next tick reads).
//
// Why drain instead of wall: x/y wrap and z already is a wall — mass at
// a dead port deadlocks→shunts→sprays back inward, so a hard boundary
// reflects diffusely. Draining approximates free space: radiation that
// leaves the arena never returns. The absorbed count is the missing-
// transverse-energy channel — report it, don't drop it.
export const makeDrain = (w, h, d, margin = 0) => {
  if (!margin) return null;
  const idx = [];
  for (let z = 0; z < d; z++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x < margin || x >= w - margin || y < margin || y >= h - margin ||
        z < margin || z >= d - margin)
      idx.push((z * h + y) * w + x);
  }
  const apply = (mem, statePtr) => {
    let absorbed = 0;
    for (const i of idx) {
      const p = statePtr + i * 6;
      absorbed += mem[p] + mem[p + 4];             // quanta + buffer
      mem[p] = 0; mem[p + 4] = 0;
      const hv = mem[p + 2] | (mem[p + 3] << 8);   // damp thermal glare
      const nh = hv >> 1;
      mem[p + 2] = nh & 255; mem[p + 3] = nh >> 8;
    }
    return absorbed;
  };
  return { idx, apply, count: idx.length };
};

// ---------- P3ST bulk-load packing ------------------------------------
// Blob: magic 'P3ST' + w/h/d u32le + n×u8 quanta + n×u8 spin +
// n×u16le heat (+ n×u8 buffer + n×u8 tension when 6-channel).
export const packLoad = (w, h, d) => {
  const n = w * h * d;
  const buf = new Uint8Array(16 + n * 6);
  const dv = new DataView(buf.buffer);
  buf.set([0x50, 0x33, 0x53, 0x54]);
  dv.setUint32(4, w, true); dv.setUint32(8, h, true); dv.setUint32(12, d, true);
  return {
    buf, n,
    q: buf.subarray(16, 16 + n),
    s: buf.subarray(16 + n, 16 + 2 * n),
    heat: new DataView(buf.buffer, 16 + 4 * n, 2 * n),
    buffer: buf.subarray(16 + 2 * n, 16 + 3 * n),
    tension: buf.subarray(16 + 3 * n, 16 + 4 * n),
  };
};
// Bulk-load through the P3ST channel: pointer → copy → commit → prepare.
// Returns false on reject (callers skip the candidate or exit as they
// choose — the wasm heap view is wrapped AFTER the pointer call since
// malloc may grow memory and detach earlier views).
export const commitLoad = (wasm, buf) => {
  const ptr = wasm._planck3_load_pointer();   // may malloc → grow → detach
  wasm.heap8().set(buf, ptr);                 // wrap the view AFTER
  if (wasm._planck3_load_commit() !== 0) { console.error('load_commit rejected'); return false; }
  wasm._planck3_prepare();
  return true;
};

// ---------- heartbeat --------------------------------------------------
export const heartbeat = (filename, base = {}) =>
  (extra) => writeFileSync(join(LOGDIR, filename), JSON.stringify({ ts: Date.now(), ...base, ...extra }, null, 2));

// ---------- census: live / provenance / freeEnds / longest live cycle --
// statePtr must be re-read after every tick (the wasm heap view itself
// must be re-wrapped after any pointer call — memory can grow).
export const makeCensus = (wasm, { w, h, d, getPtr, provenance = null }) => {
  const n = w * h * d;
  const idx = (x, y, z) => (z * h + y) * w + x;
  const dec = (i) => [i % w, ((i % (h * w)) / w) | 0, (i / (h * w)) | 0];
  return () => {
    const mem = wasm.heap8();
    const statePtr = getPtr();
    let live = 0, freeEnds = 0, arcLive = 0;
    const liveSet = new Set();
    for (let i = 0; i < n; i++) {
      if (mem[statePtr + i * 6] === 0) continue;
      live++; liveSet.add(i);
      if (provenance?.[i]) arcLive++;
    }
    for (const i of liveSet) {
      const s = mem[statePtr + i * 6 + 1];
      if (!s) { freeEnds++; continue; }
      const [x, y, z] = dec(i);
      const c = step(x, y, z, s);
      if (c[2] < 0 || c[2] >= d) { freeEnds++; continue; }
      const k = idx(((c[0] % w) + w) % w, ((c[1] % h) + h) % h, c[2]);
      if (!liveSet.has(k)) freeEnds++;
    }
    const seen2 = new Set(); let maxCycle = 0, nCycles = 0;
    for (const i of liveSet) {
      if (seen2.has(i)) continue;
      const path = [], seen = new Map();
      let cur = i, hops = 0;
      while (cur >= 0 && !seen.has(cur) && !seen2.has(cur) && hops < 5000) {
        seen.set(cur, path.length); path.push(cur); seen2.add(cur); hops++;
        const s = mem[statePtr + cur * 6 + 1];
        if (!s) { cur = -1; break; }
        const [x, y, z] = dec(cur);
        const c = step(x, y, z, s);
        if (c[2] < 0 || c[2] >= d) { cur = -1; break; }
        const k = idx(((c[0] % w) + w) % w, ((c[1] % h) + h) % h, c[2]);
        cur = liveSet.has(k) ? k : -1;
      }
      if (cur >= 0 && seen.has(cur)) {
        const len = path.length - seen.get(cur);
        if (len > maxCycle) maxCycle = len;
        if (len > 2) nCycles++;
      }
    }
    return { live, arcLive, freeEnds, maxCycle, nCycles };
  };
};

// Reconstruct the spin-cycle digraph of a seed (each painted cell's
// successor = the cell at its spin port). Returns { cellSet, cycles }
// sorted longest-first. Shared by anneal.mjs and fountain.mjs tail mode.
export const extractCycles = (cells, w, h, d) => {
  const idx = (x, y, z) => (z * h + y) * w + x;
  const cellSet = new Map();
  for (const [x, y, z, s] of cells) cellSet.set(idx(x, y, z), [x, y, z, s]);
  const succ = (i) => {
    const [x, y, z, s] = cellSet.get(i);
    if (!s) return -1;
    const c = step(x, y, z, s);
    const k = idx(c[0], c[1], c[2]);
    return cellSet.has(k) ? k : -1;
  };
  const visited = new Set(), cycles = [];
  for (const i of cellSet.keys()) {
    if (visited.has(i)) continue;
    const path = [], seen = new Map();
    let cur = i;
    while (cur >= 0 && !seen.has(cur) && !visited.has(cur)) { seen.set(cur, path.length); path.push(cur); cur = succ(cur); }
    for (const j of path) visited.add(j);
    if (cur >= 0 && seen.has(cur)) cycles.push(path.slice(seen.get(cur)));
  }
  cycles.sort((a, b) => b.length - a.length);
  return { cellSet, cycles };
};
