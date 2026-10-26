// dwell-probe (E11): the edge delay-line register — DWELL=k parks a
// streamed quantum in stage k-1, delivering it after k ticks:
// effective channel velocity 1/k. Sweep k on a vacuum pulse transit.
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
const W = 96, H = 24, D = 24, CY = H >> 1, CZ = D >> 1, X2 = 60;
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NMOV = wasm._meso3i_nch() - 1;
let XPX = -1;
for (let c = 0; c < NMOV; c++) {
  const v = [wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)];
  if (v[0] > 0 && v[1] === 0 && v[2] === 0) XPX = c;
}
const run = k => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(0); wasm._meso3i_drest(0);
  wasm._meso3i_reflect(0); wasm._meso3i_dwell(k);
  let m0 = 0;
  for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
    const x = 8, y = CY + dy, z = CZ + dz;
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, XPX, 64); m0 += 64;
  }
  let tHit = -1;
  for (let t = 0; t < 300; t++) {
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    let a = 0;
    for (let x = X2; x <= X2 + 3; x++) for (let z = 0; z < D; z++) for (let y = 0; y < H; y++)
      if (!((x + y + z) & 1)) a += wasm._meso3i_get(x, y, z, XPX) + wasm._meso3i_edge(x, y, z, XPX);
    if (tHit < 0 && a >= 16) tHit = t;
    if (tHit > 0) break;
  }
  console.log(`DWELL=${k}  t=${tHit}  v_eff=${tHit > 0 ? ((X2 - 10) / tHit).toFixed(3) : '--'}  (1/k = ${(1 / k).toFixed(3)})`);
};
console.log('E11 — edge delay-line: v_eff vs DWELL (vacuum, no congestion)');
for (const k of [1, 2, 3, 4]) run(k);
// diagnostic: does the DWELL=2 pulse sit in the delay line near launch?
wasm._meso3i_init(W, H, D, 1);
wasm._meso3i_collmode(0); wasm._meso3i_friction(0); wasm._meso3i_drest(0);
wasm._meso3i_reflect(0); wasm._meso3i_dwell(2);
for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
  const x = 8, y = CY + dy, z = CZ + dz;
  if (!((x + y + z) & 1)) wasm._meso3i_set(x, y, z, XPX, 64);
}
for (let t = 0; t < 30; t++) {
  wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
  let tot = 0, cx = 0;
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) for (let z = 0; z < D; z++) {
    if ((x + y + z) & 1) continue;
    const mass = wasm._meso3i_edge(x, y, z, XPX) + wasm._meso3i_get(x, y, z, XPX);
    tot += mass; cx += mass * x;
  }
  console.log(`diag t${t}  total=${tot}  cx=${tot ? (cx / tot).toFixed(1) : '--'}`);
}
