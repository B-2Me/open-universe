// yorp-test: can LIGHT write spin? Grazing +x photon beam, IPHOT=3
// (absorbed) + drest — photons consumed on contact, momentum
// transferred as ejecta on the beam channel, which re-park via drag
// into rest_+x on the grazed flank.
// Sign prediction identical to the mass-beam graze: +x at y>CY → Lz<0.
// Also audits momentum: totals() now counts photon p under mode 3.
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
const cpx = CV.findIndex(v => v[0] === 2 && !v[1] && !v[2]);

const lump = () => {
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x + y + z) & 1) continue;
    if ((x - CX) ** 2 + (y - CY) ** 2 + (z - CZ) ** 2 <= 25)
      wasm._meso3i_set(x, y, z, REST, 64);
  }
};
const beam = off => {
  // photon disc at x=4, centered y=CY+off — mirrors the plane-wave UI
  for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
    if (dy * dy + dz * dz > 4) continue;
    wasm._meso3i_phset(4, CY + off + dy, CZ + dz, cpx, 8);
  }
};
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

for (const off of [3, 0, -3]) {
  wasm._meso3i_clear();
  wasm._meso3i_collmode(0);
  wasm._meso3i_friction(8);
  wasm._meso3i_fricmode(-4);
  wasm._meso3i_lat(1);
  wasm._meso3i_drest(1);
  wasm._meso3i_phot(3);
  lump();
  for (let t = 0; t < 150; t++) {
    beam(off);
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    if (t % 50 === 49) {
      const [L, pk] = lzPark();
      console.log(`off=${String(off).padStart(3)} t${t + 1}: Lz_park=${L} (parked ${pk} in lump) γ=${wasm._meso3i_photons()}`);
    }
  }
}
