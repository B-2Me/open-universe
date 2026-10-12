#!/usr/bin/env node
/*
 * export-zoo.mjs — publishes the particle dictionary to the website.
 *
 * For every stable entry in knot_dictionary.json: load its seed into
 * planck3.wasm, tick a few times to let ambient mass settle past the
 * painted skeleton, then write TWO artifacts:
 *
 *   logs/vtk/zoo/<name>.vtk        ParaView/provenance (gitignored)
 *   docs/public/zoo/<name>.bin     compact web frame (COMMITTED — see
 *                                  below)
 *   docs/public/zoo/index.json     manifest the Zoo page fetches
 *
 * The .bin is generated data we commit on purpose: it cannot be built
 * in CI (needs gitignored seeds256/ + knot_dictionary.json), and it IS
 * the published scientific record — the first stable-knot edition of
 * the dictionary. Format (little-endian):
 *
 *   magic "ZOO3" (4)  w h d (u32×3)  n (u32)
 *   per cell ×7 bytes: x,y,z u8, quanta u8, spin u8, tension u8,
 *   painted u8 (1 = original skeleton, 0 = settled/accreted mass)
 *
 * ~6B/cell vs ~40B/cell ASCII — parses straight into typed arrays.
 *
 *   node script/export-zoo.mjs [--settle=8] [--dict=knot_dictionary.json]
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeVtkFrame } from './vtk.mjs';

const require = createRequire(import.meta.url);
const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const arg = (k, d) => {
  const m = process.argv.find(a => a === `--${k}` || a.startsWith(`--${k}=`));
  return m ? (m.includes('=') ? m.split('=')[1] : true) : d;
};

const DICT = resolve(ROOT, String(arg('dict', 'knot_dictionary.json')));
const SETTLE = parseInt(arg('settle', '8'));
const OUT_WEB = resolve(ROOT, 'docs/public/zoo');
const OUT_VTK = resolve(ROOT, 'logs/vtk/zoo');
const WASM_JS = resolve(ROOT, 'docs/public/wasm/loom/planck3.js');

if (!existsSync(DICT)) { console.error(`no dictionary at ${DICT}`); process.exit(1); }
if (!existsSync(WASM_JS)) { console.error('wasm glue not found — run src/build.sh'); process.exit(1); }
const dict = JSON.parse(readFileSync(DICT, 'utf8'));
const ONLY = arg('only', null) ? String(arg('only')).split(',') : null;
const stable = (dict.entries ?? []).filter(e => e.verdict === 'stable' && (!ONLY || ONLY.includes(e.name)));
if (!stable.length) { console.error('no stable entries'); process.exit(1); }

const glueSrc = readFileSync(WASM_JS, 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'require', '__dirname', '__filename',
  glueSrc)(mod, mod.exports, createRequire(WASM_JS), resolve(WASM_JS, '..'), WASM_JS);
const wasm = await mod.exports();
const heap8 = () => new Uint8Array(wasm.wasmMemory.buffer);

mkdirSync(OUT_WEB, { recursive: true });
mkdirSync(OUT_VTK, { recursive: true });

const manifest = [];
for (const e of stable) {
  const seedPath = [`seeds256/${e.name}.json`, `seeds/${e.name}.json`]
    .map(p => resolve(ROOT, p)).find(existsSync);
  if (!seedPath) { console.error(`${e.name}: seed missing — skipped`); continue; }
  const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
  const [w, h, d] = seed.dims, n = w * h * d;

  if (wasm._planck3_init_dims(w, h, d) !== 0) { console.error(`${e.name}: init rejected`); continue; }
  wasm._planck3_set_dissipation(dict.diss ?? 15);
  wasm._planck3_set_thermal_limit(dict.limit ?? 50000);
  wasm._planck3_set_mode(dict.mode ?? 0);
  wasm._planck3_reset_stats();

  const buf = new Uint8Array(16 + n * 6);
  const dv = new DataView(buf.buffer);
  buf.set([0x50, 0x33, 0x53, 0x54]);
  dv.setUint32(4, w, true); dv.setUint32(8, h, true); dv.setUint32(12, d, true);
  const qp = buf.subarray(16, 16 + n), sp = buf.subarray(16 + n, 16 + 2 * n);
  const hp = new DataView(buf.buffer, 16 + 4 * n, 2 * n);
  for (const [x, y, z, s] of seed.cells) {
    const i = (z * h + y) * w + x;
    qp[i] = seed.q; sp[i] = s; hp.setUint16(2 * i, seed.heat, true);
  }
  const loadPtr = wasm._planck3_load_pointer();
  heap8().set(buf, loadPtr);
  if (wasm._planck3_load_commit() !== 0) { console.error(`${e.name}: load rejected`); continue; }
  wasm._planck3_prepare();
  for (let t = 0; t < SETTLE; t++) wasm._planck3_tick();

  const statePtr = wasm._planck3_state_pointer();
  const painted = new Uint8Array(n);
  for (const [x, y, z] of seed.cells) painted[(z * h + y) * w + x] = 1;
  const mem = heap8();
  // Compact frame: only live cells, 7 bytes each.
  const cells = [];
  for (let i = 0; i < n; i++) {
    const p = statePtr + i * 6;
    if (mem[p] === 0) continue;
    cells.push([i % w, ((i % (h * w)) / w) | 0, (i / (h * w)) | 0, mem[p], mem[p + 1], mem[p + 5], painted[i]]);
  }
  const bin = new Uint8Array(20 + cells.length * 7);
  bin.set([0x5a, 0x4f, 0x4f, 0x33]); // "ZOO3"
  const bdv = new DataView(bin.buffer);
  bdv.setUint32(4, w, true); bdv.setUint32(8, h, true); bdv.setUint32(12, d, true);
  bdv.setUint32(16, cells.length, true);
  cells.forEach(([x, y, z, q, s, tn, pt], k) => {
    const o = 20 + k * 7;
    bin[o] = x; bin[o + 1] = y; bin[o + 2] = z; bin[o + 3] = q; bin[o + 4] = s; bin[o + 5] = tn; bin[o + 6] = pt;
  });
  writeFileSync(join(OUT_WEB, `${e.name}.bin`), bin);

  writeVtkFrame({
    file: join(OUT_VTK, `${e.name}.vtk`), w, h, d, statePtr, heap8,
    masks: { a: painted }, tick: SETTLE, title: `zoo ${e.name}`,
  });

  manifest.push({
    name: e.name, file: `${e.name}.bin`, cells: cells.length,
    mass: e.massEnd, R0: e.R0, R1: e.R1, loops: e.loops,
    radiusXY: e.radiusXY, radiusZ: e.radiusZ,
    dims: [w, h, d],
  });
  console.log(`  ${e.name}: ${cells.length} cells → ${(bin.length / 1024).toFixed(0)}KB .bin + .vtk`);
}
// Merge with any prior manifest so --only runs patch, not clobber.
const idxPath = join(OUT_WEB, 'index.json');
let all = manifest;
if (existsSync(idxPath)) {
  try {
    const prior = JSON.parse(readFileSync(idxPath, 'utf8')).knots ?? [];
    const fresh = new Set(manifest.map(m => m.name));
    all = [...prior.filter(m => !fresh.has(m.name)), ...manifest];
  } catch {}
}
all.sort((a, b) => a.mass - b.mass);
writeFileSync(idxPath, JSON.stringify({
  generated: new Date().toISOString(), settle: SETTLE,
  diss: dict.diss, limit: dict.limit, knots: all,
}, null, 2));
console.log(`\n${manifest.length} exported · ${all.length} in manifest → docs/public/zoo/`);
