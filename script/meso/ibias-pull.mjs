// ibias-pull (E14): does IBIAS produce attraction toward mass?
// A lump in a dilute ambient bath: IBIAS weights collision outputs
// toward the higher-iR neighbor — if real, bath flux piles into the
// 1..8 halo fringe (where atti is nonzero). Measure the radial
// occupancy enhancement vs IBIAS=0 control. Sharp q=64 lump:
// contact shell reads atti(64)=0, so pull lives in the fringe only.
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
const NMOV = wasm._meso3i_nch() - 1, REST = NMOV;
const run = ibias => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_fricp(128); wasm._meso3i_drest(0); wasm._meso3i_reflect(0);
  wasm._meso3i_gate ? 0 : 0;
  wasm._meso3i_drest(1);           // so iR sees wound mass (0946f9c)
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x + y + z) & 1) continue;
    const dx = x - CX, dy = y - CY, dz = z - CZ;
    if (dx * dx + dy * dy + dz * dz <= 16) wasm._meso3i_rset(x, y, z, 0, 64);
  }
  wasm._meso3i_bias(ibias);
  // sustained dilute bath: reseed sparse flux every tick (drain eats edges)
  const reseed = () => {
    for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if ((x + y + z) & 1) continue;
      const dx = x - CX, dy = y - CY, dz = z - CZ;
      if (dx * dx + dy * dy + dz * dz <= 16) continue;
      if ((x * 3 + y * 5 + z * 7) % 11 === 0) {
        const ch = (x + 2 * y + 3 * z) % NMOV;
        const v = wasm._meso3i_get(x, y, z, ch);
        if (v < 4) wasm._meso3i_set(x, y, z, ch, 4);
      }
    }
  };
  for (let t = 0; t < 300; t++) { reseed(); wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); }
  // shell-averaged MOVING occupancy around lump
  const RMAX = 18;
  const sum = new Float64Array(RMAX), cnt = new Float64Array(RMAX);
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x + y + z) & 1) continue;
    const dx = x - CX, dy = y - CY, dz = z - CZ;
    const r = Math.sqrt(dx * dx + dy * dy + dz * dz), sh = Math.floor(r);
    if (sh < 1 || sh >= RMAX) continue;
    let m = 0;
    for (let c = 0; c < NMOV; c++) m += wasm._meso3i_get(x, y, z, c);
    sum[sh] += m; cnt[sh]++;
  }
  console.log(`IBIAS=${String(ibias).padStart(2)}  shell flux: ` +
    [5, 7, 9, 11, 14, 17].map(r => `r${r}:${cnt[r] ? (sum[r] / cnt[r]).toFixed(2) : '--'}`).join(' '));
};
console.log('E14 — IBIAS pull: bath occupancy vs radius around q=64 lump');
run(0); run(8); run(32);
