// lump-ablate: thick lump vs photon laser — catalyst vs stimulated.
// Question: does the coupling mode change HOW a lump ablates?
//   catalyst   -> isotropic re-emission: scatter, re-park, lump heats
//   stimulated -> coherent kick into the beam channel: a drilled tunnel
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
wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);

const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
const CV = [];
for (let c = 0; c < NMOV; c++)
  CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);
const CX = W >> 1, CY = H >> 1, CZ = D >> 1;
const cBeam = CV.findIndex(v => v[0] === 2 && v[1] === 0 && v[2] === 0);
const BX = ((4 + CY + CZ) & 1) === 0 ? 4 : 5;

// thick lump: radius-5 ball, 96 quanta/node
const seedLump = () => {
  for (let dz = -5; dz <= 5; dz++)
  for (let dy = -5; dy <= 5; dy++)
  for (let dx = -5; dx <= 5; dx++) {
    if (dx*dx + dy*dy + dz*dz > 25) continue;
    const x = CX+dx, y = CY+dy, z = CZ+dz;
    if (((x+y+z)&1) !== 0 || x<0||x>=W||y<0||y>=H||z<0||z>=D) continue;
    wasm._meso3i_set(x, y, z, REST, 96);
  }
};
const led = () => { wasm._meso3i_rg_refresh();
  return `rest=${wasm._meso3i_rest_mass()} flux=${wasm._meso3i_mov_mass()} γ=${wasm._meso3i_photons()}`; };

// cross-section of the lump along the beam line: rest per x at (y=CY, z=CZ)
const beamrow = () => {
  const row = [];
  for (let x = 28; x <= 44; x += 2)
    row.push(`${x}:${wasm._meso3i_get(x, CY, CZ, REST)}`);
  return row.join(' ');
};
// where emitted mass ends up: quanta in flight on the +x axial channel
const inflight = () => {
  let bx = 0, all = 0;
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    for (let c = 0; c < NMOV; c++) {
      const v = wasm._meso3i_get(x, y, z, c);
      all += v; if (c === cBeam) bx += v;
    }
  return { bx, all };
};
const shine = n => {
  for (let i = 0; i < n; i++) {
    wasm._meso3i_phset(BX, CY, CZ, cBeam, 16);
    wasm._meso3i_drain_edge(3);
    wasm._meso3i_tick();
  }
};

seedLump();
wasm._meso3i_save();
wasm._meso3i_rg_refresh();
console.log(`t0 lump seeded: ${led()}`);
console.log(`  beam row before: ${beamrow()}`);

for (const mode of [1, 2]) {
  wasm._meso3i_restore();
  wasm._meso3i_phot(mode);
  wasm._meso3i_rg_refresh();
  const m0 = wasm._meso3i_rest_mass();
  shine(300);
  wasm._meso3i_rg_refresh();
  const m1 = wasm._meso3i_rest_mass();
  const f = inflight();
  const names = ['', 'catalyst', 'stimulated'];
  console.log(`\nIPHOT=${mode} (${names[mode]}), 300 ticks:`);
  console.log(`  rest ${m0} -> ${m1}  (−${((1 - m1/m0) * 100).toFixed(1)}%) · ${led()}`);
  console.log(`  in-flight moving mass: ${f.all} total, ${f.bx} on the +x axial beam channel`);
  console.log(`  beam row after:  ${beamrow()}`);
  console.log(`  rest centroid x=${(wasm._meso3i_cm(0)/256).toFixed(2)} (center ${CX})`);
}
