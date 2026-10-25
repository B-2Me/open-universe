// drest-graze-test: can an off-center MASS beam write rotation into
// cold matter? (A photon beam only ablates — collisions write spin.)
// Seed a scalar-rest lump, fire a collimated +x mass beam grazing its
// +y flank, and measure Lz_park inside the lump region.
// Predicted sign: +x flux parked at y>CZ ... at y>CY gives Lz = −dy·px < 0.
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

const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
const CV = [];
for (let c = 0; c < NMOV; c++)
  CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);
const cpx = CV.findIndex(v => v[0] === 2 && !v[1] && !v[2]);   // +x axial

const boot = drest => {
  wasm._meso3i_clear();
  wasm._meso3i_collmode(0);
  wasm._meso3i_friction(8);
  wasm._meso3i_fricmode(-4);
  wasm._meso3i_lat(1);
  wasm._meso3i_drest(drest);
};
const lump = () => {
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x + y + z) & 1) continue;
    if ((x - CX) ** 2 + (y - CY) ** 2 + (z - CZ) ** 2 <= 25)
      wasm._meso3i_set(x, y, z, REST, 64);
  }
};
// mass beam: +x quanta on a small disc at x=5, centered y=CY+off, z=CZ
const beam = off => {
  for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
    const x = 5, y = CY + off + dy, z = CZ + dz;
    wasm._meso3i_set(x, y, z, cpx, wasm._meso3i_get(x, y, z, cpx) + 24);
  }
};
// Lz_park within the lump neighborhood (r<=8) — parked only, moving excluded
const lzPark = () => {
  let Lr = 0, pk = 0;
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x - CX) ** 2 + (y - CY) ** 2 + (z - CZ) ** 2 > 64) continue;
    let rx = 0, ry = 0;
    for (let c = 0; c < NMOV; c++) {
      const n = wasm._meso3i_rget(x, y, z, c);
      rx += n * CV[c][0]; ry += n * CV[c][1]; pk += n;
    }
    Lr += (x - CX) * ry - (y - CY) * rx;
  }
  return [Lr, pk];
};

for (const [drest, off] of [[0, 3], [1, 3], [1, 0], [1, -3]]) {
  boot(drest);
  lump();
  for (let t = 0; t < 150; t++) {
    beam(off);
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    if (t % 50 === 49) {
      const [L, pk] = lzPark();
      console.log(`drest=${drest} off=${String(off).padStart(3)} t${t + 1}: Lz_park=${L} (parked ${pk} in lump)`);
    }
  }
}
