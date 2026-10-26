// mirror-sweep: find the best reflector before building the cavity.
// Vary wall rest density Q and refusal threshold IREFL; measure the
// fraction of a +x pulse returned as -x flux in the launch zone.
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

const W = 72, H = 24, D = 24, CY = H >> 1, CZ = D >> 1;
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
const CV = []; let XPX = -1;
for (let c = 0; c < NMOV; c++) {
  const v = [wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)];
  CV.push(v);
  if (v[0] > 0 && v[1] === 0 && v[2] === 0) XPX = c;
}
const boot = refl => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_fricp(128); wasm._meso3i_friccurve(0);
  wasm._meso3i_drest(0); wasm._meso3i_reflect(refl);
};
const negMov = () => {
  let m = 0;
  for (let x = 2; x < 24; x++) for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) {
    if ((x + y + z) & 1) continue;
    for (let c = 0; c < NMOV; c++) if (CV[c][0] < 0) m += wasm._meso3i_get(x, y, z, c);
  }
  return m;
};
const run = (Q, refl) => {
  boot(refl);
  for (let x = 54; x <= 56; x++) for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) {
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, REST, Q);
  }
  let m0 = 0;
  for (let dy = -3; dy <= 3; dy++) for (let dz = -3; dz <= 3; dz++) {
    const x = 8, y = CY + dy, z = CZ + dz;
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, XPX, 64); m0 += 64;
  }
  let peak = 0;
  for (let t = 0; t < 110; t++) {
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    const r = negMov(); if (r > peak) peak = r;
  }
  return peak / m0;
};
console.log('mirror reflectance: returned fraction (peak)');
process.stdout.write('wallQ\IREFL  ');
for (const refl of [16, 32, 64, 96, 255]) process.stdout.write(String(refl).padStart(6));
console.log();
for (const Q of [32, 64, 96, 160, 255]) {
  process.stdout.write(String(Q).padStart(9) + '  ');
  for (const refl of [16, 32, 64, 96, 255])
    process.stdout.write(run(Q, refl).toFixed(2).padStart(6));
  console.log();
}
