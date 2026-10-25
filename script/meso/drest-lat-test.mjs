// drest-lat-test: does the latency gate make a wound state robust?
// Park a vortex under drest, then probe with sparse pulses vs a
// sustained drive, at Lat 1 vs Lat 16. Prediction: sparse probes
// can't open the gate at high latency -> Lz_park survives.
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

const W = 72, H = 72, D = 36;
const CX = W >> 1, CY = H >> 1, CZ = D >> 1;
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');

const NCH = wasm._meso3i_nch(), NMOV = NCH - 1;
const CV = [];
for (let c = 0; c < NMOV; c++)
  CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);

const tang = (dx, dy) => {
  const l = Math.hypot(dx, dy) || 1, tx = -dy / l, ty = dx / l;
  let best = -1, bd = -Infinity;
  for (let c = 0; c < NMOV; c++) {
    if (CV[c][2] !== 0) continue;
    const dot = CV[c][0] * tx + CV[c][1] * ty;
    if (dot > bd) { bd = dot; best = c; }
  }
  return best;
};
const ring = () => {
  for (const r of [5, 4]) {
    const steps = Math.ceil(2 * Math.PI * r) + 1;
    for (let i = 0; i < steps; i++) {
      const a = i / steps * 2 * Math.PI;
      const x = Math.round(CX + r * Math.cos(a)), y = Math.round(CY + r * Math.sin(a));
      if (((x + y + CZ) & 1) !== 0) continue;
      const c = tang(x - CX, y - CY);
      if (c < 0) continue;
      wasm._meso3i_set(x, y, CZ, c, Math.min(255, wasm._meso3i_get(x, y, CZ, c) + 48));
    }
  }
};
const lzPark = () => {
  let Lr = 0, pk = 0;
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let rx = 0, ry = 0;
    for (let c = 0; c < NMOV; c++) {
      const n = wasm._meso3i_rget(x, y, z, c);
      rx += n * CV[c][0]; ry += n * CV[c][1]; pk += n;
    }
    Lr += (x - CX) * ry - (y - CY) * rx;
  }
  return [Lr, pk];
};
const drive = () => {
  for (let c = 0; c < NMOV; c++) {
    const [vx, vy, vz] = CV[c];
    wasm._meso3i_set(CX - 3 * vx, CY - 3 * vy, CZ - 3 * vz, c,
      wasm._meso3i_get(CX - 3 * vx, CY - 3 * vy, CZ - 3 * vz, c) + 4);
  }
};
const parkRing = lat => {
  wasm._meso3i_clear();
  wasm._meso3i_collmode(0);
  wasm._meso3i_friction(8);
  wasm._meso3i_fricmode(-4);
  wasm._meso3i_lat(lat);
  wasm._meso3i_drest(1);
  ring();
  for (let t = 0; t < 60; t++) { wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); }
};

for (const lat of [1, 16]) {
  // --- sparse probe: 1 tick of drive every 10 ticks ---
  parkRing(lat);
  let [L0] = lzPark();
  for (let t = 0; t < 120; t++) {
    if (t % 10 === 0) drive();
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
  }
  let [Ls, ps] = lzPark();
  console.log(`Lat ${String(lat).padStart(2)} · SPARSE probe 120t: Lz_park ${L0} -> ${Ls} (parked ${ps})`);
  // --- sustained probe ---
  parkRing(lat);
  for (let t = 0; t < 120; t++) {
    drive();
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
  }
  let [Ld, pd] = lzPark();
  console.log(`Lat ${String(lat).padStart(2)} · SUSTAINED drive 120t: Lz_park ${L0} -> ${Ld} (parked ${pd})`);
}
