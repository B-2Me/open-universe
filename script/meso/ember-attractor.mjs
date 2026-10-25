// ember-attractor: is the ember an accumulator or an attractor?
// Same drive the viewer runs (18 spokes, RAY=3, RATE=4, IFRIC=8,
// fricmode=-4). Three seeds: vacuum, thin lump, thick lump. If all
// converge to the same rest mass, the feed has a ceiling — the user's
// observation that a dense seed can't be out-grown is the signature.
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
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
const CV = [];
const CX = W >> 1, CY = H >> 1, CZ = D >> 1;
const RAY = 3, RATE = 4;

const boot = () => {
  wasm._meso3i_clear();
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
};
for (let c = 0; c < NMOV; c++)
  CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);

const seedLump = (R, Q) => {
  for (let dz = -R; dz <= R; dz++)
  for (let dy = -R; dy <= R; dy++)
  for (let dx = -R; dx <= R; dx++) {
    if (dx*dx + dy*dy + dz*dz > R*R) continue;
    const x = CX+dx, y = CY+dy, z = CZ+dz;
    if (((x+y+z)&1) !== 0 || x<0||x>=W||y<0||y>=H||z<0||z>=D) continue;
    wasm._meso3i_set(x, y, z, REST, Q);
  }
};
const drive = () => {
  for (let c = 0; c < NMOV; c++) {
    const [vx, vy, vz] = CV[c];
    const sx = CX - RAY*vx, sy = CY - RAY*vy, sz = CZ - RAY*vz;
    for (let u = 0; u < RATE; u++)
      wasm._meso3i_set(sx, sy, sz, c, wasm._meso3i_get(sx, sy, sz, c) + 1);
  }
};
const run = ticks => {
  for (let t = 0; t < ticks; t++) {
    drive(); wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
  }
  wasm._meso3i_rg_refresh();
  return { rest: wasm._meso3i_rest_mass(), mov: wasm._meso3i_mov_mass() };
};

boot();
const seeds = [
  ['vacuum (no seed)', null],
  ['thin lump R3/Q32', () => seedLump(3, 32)],
  ['thick lump R5/Q96', () => seedLump(5, 96)],
];
for (const [name, seed] of seeds) {
  boot(); if (seed) seed();
  wasm._meso3i_rg_refresh();
  const r0 = wasm._meso3i_rest_mass();
  const series = [];
  for (const win of [200, 200, 200]) {
    const { rest, mov } = run(win);
    series.push(`${rest}`);
  }
  const { rest, mov } = run(200);
  series.push(rest);
  console.log(`${name.padEnd(22)} start=${r0} -> windows: ${series.join(' -> ')}  (flux=${mov})`);
}
