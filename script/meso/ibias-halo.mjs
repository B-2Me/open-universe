// ibias-halo (E15): IBIAS inside a sustained-source halo — the real
// pull test. A central injector builds the radial 1..8 fringe that
// atti() needs (E3 halo). If IBIAS channels flux toward high-iR
// neighbors, the halo steepens: near-source shells gain occupancy
// vs control. Single-knob isolation — ignores ICOND/IFLD coupling.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso3i.js'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'require', '__dirname', '__filename', src)
  (mod, mod.exports, require, join(here, '../../docs/public/wasm/ember'), 'meso3i.js');
const wasm = await mod.exports();
const W = 48, H = 48, D = 48, CX = 24, CY = 24, CZ = 24;
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NMOV = wasm._meso3i_nch() - 1;
const RATE = 4;
const run = ibias => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_fricp(128); wasm._meso3i_drest(0); wasm._meso3i_reflect(0);
  wasm._meso3i_bias(ibias);
  const inject = () => {
    for (let c = 0; c < NMOV; c++) {
      const v = wasm._meso3i_get(CX, CY, CZ, c);
      if (v < 240) wasm._meso3i_set(CX, CY, CZ, c, v + RATE);
    }
  };
  for (let t = 0; t < 600; t++) { inject(); wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); }
  const RMAX = 20;
  const sum = new Float64Array(RMAX), cnt = new Float64Array(RMAX);
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x + y + z) & 1) continue;
    const dx = x - CX, dy = y - CY, dz = z - CZ;
    const sh = Math.floor(Math.sqrt(dx * dx + dy * dy + dz * dz));
    if (sh < 1 || sh >= RMAX) continue;
    let m = 0;
    for (let c = 0; c < NMOV; c++) m += wasm._meso3i_get(x, y, z, c);
    sum[sh] += m; cnt[sh]++;
  }
  console.log(`IBIAS=${String(ibias).padStart(2)}  ` +
    [3, 5, 7, 9, 11, 14, 17].map(r => `r${r}:${cnt[r] ? (sum[r] / cnt[r]).toFixed(1) : '--'}`).join(' '));
};
console.log('E15 — IBIAS in sustained-source halo (RATE=4, 600t)');
run(0); run(8); run(32); run(64);
