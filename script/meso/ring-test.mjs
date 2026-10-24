// loom-meso vortex-ring probe — does tangential circulation survive on
// meso3i at loom scale? Node-only experiment harness (not shipped).
import { readFileSync } from 'node:fs';
import { createRequire } from 'module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const path = join(here, '../../docs/public/wasm/ember/meso3i.js');
const mod = { exports: {} };
new Function('module', 'exports', 'require', '__dirname', '__filename',
  readFileSync(path, 'utf8'))(mod, mod.exports, createRequire(path), dirname(path), path);
const createEmber = mod.exports;
const wasm = await createEmber();

const W = 72, H = 72, D = 36;
console.log('init:', wasm._meso3i_init(W, H, D, 1));
const nch = wasm._meso3i_nch(), REST = nch - 1;
console.log('nch:', nch);
wasm._meso3i_collmode(0);
wasm._meso3i_friction(8);
wasm._meso3i_fricmode(-4);

const CV = [];
for (let c = 0; c < nch - 1; c++)
  CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);
const CX = W >> 1, CY = H >> 1, CZ = D >> 1;

const tang = (dx, dy) => {
  const l = Math.hypot(dx, dy) || 1, tx = -dy / l, ty = dx / l;
  let b = -1, bd = -Infinity;
  for (let c = 0; c < nch - 1; c++) {
    if (CV[c][2] !== 0) continue;
    const dt = CV[c][0] * tx + CV[c][1] * ty;
    if (dt > bd) { bd = dt; b = c; }
  }
  return b;
};

let n = 0;
for (const r of [5, 4]) {
  const steps = Math.ceil(2 * Math.PI * r) + 1;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    const x = Math.round(CX + r * Math.cos(a)), y = Math.round(CY + r * Math.sin(a));
    if (((x + y + CZ) & 1) !== 0) continue;
    const c = tang(x - CX, y - CY);
    if (c < 0) continue;
    wasm._meso3i_set(x, y, CZ, c, Math.min(255, wasm._meso3i_get(x, y, CZ, c) + 48));
    n++;
  }
}
console.log('ring cells:', n);

const report = (t) => {
  wasm._meso3i_rg_refresh();
  console.log(`t=${t} rest=${wasm._meso3i_rest_mass()} flux=${wasm._meso3i_mov_mass()}`);
};
report(0);
for (let t = 1; t <= 200; t++) {
  wasm._meso3i_drain_edge(3);
  wasm._meso3i_tick();
  if (t % 25 === 0 || t === 5 || t === 10) report(t);
}
