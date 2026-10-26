// mirror-sweep: find the best reflector before building the cavity.
// Vary wall rest density wallQ and refusal threshold IREFL; measure the
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

const gridW = 72, gridH = 24, gridD = 24, centerY = gridH >> 1, centerZ = gridD >> 1;
if (wasm._meso3i_init(gridW, gridH, gridD, 1) !== 0) throw new Error('init failed');
const nChannels = wasm._meso3i_nch(), nMoving = nChannels - 1, restCh = nChannels - 1;
const chanVec = []; let chPX = -1;
for (let ch = 0; ch < nMoving; ch++) {
  const dir = [wasm._meso3i_cvc(ch, 0), wasm._meso3i_cvc(ch, 1), wasm._meso3i_cvc(ch, 2)];
  chanVec.push(dir);
  if (dir[0] > 0 && dir[1] === 0 && dir[2] === 0) chPX = ch;
}
const resetEngine = irefl => {
  wasm._meso3i_init(gridW, gridH, gridD, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_fricp(128); wasm._meso3i_friccurve(0);
  wasm._meso3i_drest(0); wasm._meso3i_reflect(irefl);
};
const backFlux = () => {
  let mass = 0;
  for (let x = 2; x < 24; x++) for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++) {
    if ((x + y + z) & 1) continue;
    for (let ch = 0; ch < nMoving; ch++) if (chanVec[ch][0] < 0) mass += wasm._meso3i_get(x, y, z, ch);
  }
  return mass;
};
const run = (wallQ, irefl) => {
  resetEngine(irefl);
  for (let x = 54; x <= 56; x++) for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++) {
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, restCh, wallQ);
  }
  let injectedMass = 0;
  for (let dy = -3; dy <= 3; dy++) for (let dz = -3; dz <= 3; dz++) {
    const x = 8, y = centerY + dy, z = centerZ + dz;
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, chPX, 64); injectedMass += 64;
  }
  let peak = 0;
  for (let t = 0; t < 110; t++) {
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    const r = backFlux(); if (r > peak) peak = r;
  }
  return peak / injectedMass;
};
console.log('mirror reflectance: returned fraction (peak)');
process.stdout.write('wallQ\IREFL  ');
for (const irefl of [16, 32, 64, 96, 255]) process.stdout.write(String(irefl).padStart(6));
console.log();
for (const wallQ of [32, 64, 96, 160, 255]) {
  process.stdout.write(String(wallQ).padStart(9) + '  ');
  for (const irefl of [16, 32, 64, 96, 255])
    process.stdout.write(run(wallQ, irefl).toFixed(2).padStart(6));
  console.log();
}
