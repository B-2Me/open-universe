// cavity-mirror (E4 stage 1): can a dense parked wall reflect a pulse?
// Required foundation for a flux resonator clock. Wall = full yz slab of
// rest density=96 under IREFL=32 (refusal). Pulse +x at x=8; measure how much
// flux returns as -x moving mass past x<18.
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
const chanVec = [];
let chPX = -1, chNX = -1;
for (let ch = 0; ch < nMoving; ch++) {
  const dir = [wasm._meso3i_cvc(ch, 0), wasm._meso3i_cvc(ch, 1), wasm._meso3i_cvc(ch, 2)];
  chanVec.push(dir);
  if (dir[0] > 0 && dir[1] === 0 && dir[2] === 0) chPX = ch;
  if (dir[0] < 0 && dir[1] === 0 && dir[2] === 0) chNX = ch;
}

wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
wasm._meso3i_fricp(128); wasm._meso3i_friccurve(0);
wasm._meso3i_drest(0); wasm._meso3i_reflect(32);

// wall: yz slab at x=54..56
for (let x = 54; x <= 56; x++) for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++) {
  if ((x + y + z) & 1) continue;
  wasm._meso3i_set(x, y, z, restCh, 96);
}

// pulse: +x flux at x=8, small disc
let injectedMass = 0;
for (let dy = -3; dy <= 3; dy++) for (let dz = -3; dz <= 3; dz++) {
  const x = 8, y = centerY + dy, z = centerZ + dz;
  if ((x + y + z) & 1) continue;
  wasm._meso3i_set(x, y, z, chPX, 64); injectedMass += 64;
}
console.log(`injected ${injectedMass} quanta on +x channel, wall density=96 at x=54-56`);

const backFlux = () => {  // -x flux anywhere in the return zone x<24
  let mass = 0;
  for (let x = 2; x < 24; x++) for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++) {
    if ((x + y + z) & 1) continue;
    for (let ch = 0; ch < nMoving; ch++) if (chanVec[ch][0] < 0) mass += wasm._meso3i_get(x, y, z, ch);
  }
  return mass;
};
const corridorFlux = () => {  // total moving in x>24 (beyond launch, before wall)
  let mass = 0;
  for (let x = 24; x < 54; x++) for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++) {
    if ((x + y + z) & 1) continue;
    for (let ch = 0; ch < nMoving; ch++) mass += wasm._meso3i_get(x, y, z, ch);
  }
  return mass;
};
for (let t = 0; t <= 120; t++) {
  wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
  if (t % 10 === 0) console.log(`t${String(t).padStart(3)}  ret=${backFlux()}  fwd=${corridorFlux()}  rest=${wasm._meso3i_rest_mass()}`);
}
