// photon-heat (E19): is photon-mediated conduction already in the engine?
// Hot lump emits photons (IPHOT=4 + IFRICM unconditional); cold lump 16
// cells away. Does the cold lump respond — rest loss (ablation) or
// mass/energy gain? Control: IPHOT=0 isolates the photon channel.
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
const W = 64, H = 24, D = 24;
const HX = 16, KX = 40, CY = 12, CZ = 12;      // hot lump at x=16, cold at x=40
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NMOV = wasm._meso3i_nch() - 1, REST = NMOV;
const lump = (cx, q) => {
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x + y + z) & 1) continue;
    const dx = x - cx, dy = y - CY, dz = z - CZ;
    if (dx * dx + dy * dy + dz * dz <= 16) wasm._meso3i_set(x, y, z, REST, q);
  }
};
const zoneMass = (cx, rad) => {
  let rest = 0, mov = 0, nExc = 0;
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x + y + z) & 1) continue;
    const dx = x - cx, dy = y - CY, dz = z - CZ;
    if (dx * dx + dy * dy + dz * dz > rad * rad) continue;
    rest += wasm._meso3i_get(x, y, z, REST);
    if (wasm._meso3i_eget) nExc += wasm._meso3i_eget(x, y, z);
    for (let c = 0; c < NMOV; c++) mov += wasm._meso3i_get(x, y, z, c);
  }
  return [rest, mov, nExc];
};
const run = phot => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(16);
  wasm._meso3i_fricp(128); wasm._meso3i_drest(0); wasm._meso3i_reflect(0);
  wasm._meso3i_phot(phot);
  lump(HX, 128); lump(KX, 32);
  const series = [];
  for (let t = 0; t < 400; t++) {
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    if (t % 80 === 0) {
      const [kr, km, kn] = zoneMass(KX, 8);
      series.push(`t${t}:r${kr}m${km}n${kn}`);
    }
  }
  const [kr, km, kn] = zoneMass(KX, 8);
  console.log(`IPHOT=${phot}  cold-lump rest=${kr} mov=${km} n=${kn}  [${series.join(' ')}]`);
};
console.log('E19b — quantum number: does absorbed energy raise n in the cold lump?');
run(4); run(5);
