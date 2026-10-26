// dwell-probe (E11): the edge delay-line register â€” DWELL=k parks a
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
const gridW = 96, gridH = 24, gridD = 24, centerY = gridH >> 1, centerZ = gridD >> 1, X2 = 60;
if (wasm._meso3i_init(gridW, gridH, gridD, 1) !== 0) throw new Error('init failed');
const nMoving = wasm._meso3i_nch() - 1;
let chPX = -1;
for (let ch = 0; ch < nMoving; ch++) {
  const dir = [wasm._meso3i_cvc(ch, 0), wasm._meso3i_cvc(ch, 1), wasm._meso3i_cvc(ch, 2)];
  if (dir[0] > 0 && dir[1] === 0 && dir[2] === 0) chPX = ch;
}
const run = k => {
  wasm._meso3i_init(gridW, gridH, gridD, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(0); wasm._meso3i_drest(0);
  wasm._meso3i_reflect(0); wasm._meso3i_dwell(k);
  let injectedMass = 0;
  for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
    const x = 8, y = centerY + dy, z = centerZ + dz;
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, chPX, 64); injectedMass += 64;
  }
  let tArrived = -1;
  for (let t = 0; t < 300; t++) {
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    let a = 0;
    for (let x = X2; x <= X2 + 3; x++) for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++)
      if (!((x + y + z) & 1)) a += wasm._meso3i_get(x, y, z, chPX) + wasm._meso3i_edge(x, y, z, chPX);
    if (tArrived < 0 && a >= 16) tArrived = t;
    if (tArrived > 0) break;
  }
  console.log(`DWELL=${k}  t=${tArrived}  v_eff=${tArrived > 0 ? ((X2 - 10) / tArrived).toFixed(3) : '--'}  (1/k = ${(1 / k).toFixed(3)})`);
};
console.log('E11 â€” edge delay-line: v_eff vs DWELL (vacuum, no congestion)');
for (const k of [1, 2, 3, 4]) run(k);
// diagnostic: does the DWELL=2 pulse sit in the delay line near launch?
wasm._meso3i_init(gridW, gridH, gridD, 1);
wasm._meso3i_collmode(0); wasm._meso3i_friction(0); wasm._meso3i_drest(0);
wasm._meso3i_reflect(0); wasm._meso3i_dwell(2);
for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
  const x = 8, y = centerY + dy, z = centerZ + dz;
  if (!((x + y + z) & 1)) wasm._meso3i_set(x, y, z, chPX, 64);
}
for (let t = 0; t < 30; t++) {
  wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
  let tot = 0, cx = 0;
  for (let x = 0; x < gridW; x++) for (let y = 0; y < gridH; y++) for (let z = 0; z < gridD; z++) {
    if ((x + y + z) & 1) continue;
    const mass = wasm._meso3i_edge(x, y, z, chPX) + wasm._meso3i_get(x, y, z, chPX);
    tot += mass; cx += mass * x;
  }
  console.log(`diag t${t}  total=${tot}  cx=${tot ? (cx / tot).toFixed(1) : '--'}`);
}
