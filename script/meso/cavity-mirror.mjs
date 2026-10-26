// cavity-mirror (E4 stage 1): can a dense parked wall reflect a pulse?
// Required foundation for a flux resonator clock. Wall = full yz slab of
// rest q=96 under IREFL=32 (refusal). Pulse +x at x=8; measure how much
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

const W = 72, H = 24, D = 24, CY = H >> 1, CZ = D >> 1;
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
const CV = [];
let XPX = -1, XMX = -1;
for (let c = 0; c < NMOV; c++) {
  const v = [wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)];
  CV.push(v);
  if (v[0] > 0 && v[1] === 0 && v[2] === 0) XPX = c;
  if (v[0] < 0 && v[1] === 0 && v[2] === 0) XMX = c;
}

wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
wasm._meso3i_fricp(128); wasm._meso3i_friccurve(0);
wasm._meso3i_drest(0); wasm._meso3i_reflect(32);

// wall: yz slab at x=54..56
for (let x = 54; x <= 56; x++) for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) {
  if ((x + y + z) & 1) continue;
  wasm._meso3i_set(x, y, z, REST, 96);
}

// pulse: +x flux at x=8, small disc
let m0 = 0;
for (let dy = -3; dy <= 3; dy++) for (let dz = -3; dz <= 3; dz++) {
  const x = 8, y = CY + dy, z = CZ + dz;
  if ((x + y + z) & 1) continue;
  wasm._meso3i_set(x, y, z, XPX, 64); m0 += 64;
}
console.log(`injected ${m0} quanta on +x channel, wall q=96 at x=54-56`);

const negMov = () => {  // -x flux anywhere in the return zone x<24
  let m = 0;
  for (let x = 2; x < 24; x++) for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) {
    if ((x + y + z) & 1) continue;
    for (let c = 0; c < NMOV; c++) if (CV[c][0] < 0) m += wasm._meso3i_get(x, y, z, c);
  }
  return m;
};
const fwdMov = () => {  // total mov in x>24 (beyond launch, before wall)
  let m = 0;
  for (let x = 24; x < 54; x++) for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) {
    if ((x + y + z) & 1) continue;
    for (let c = 0; c < NMOV; c++) m += wasm._meso3i_get(x, y, z, c);
  }
  return m;
};
for (let t = 0; t <= 120; t++) {
  wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
  if (t % 10 === 0) console.log(`t${String(t).padStart(3)}  ret=${negMov()}  fwd=${fwdMov()}  rest=${wasm._meso3i_rest_mass()}`);
}
