// clock-cavity (E4): the honest light-clock. A +x packet bounces between
// two parked mirrors (Q64/IREFL16 = 0.80 reflectance); signed x-momentum
// M(t) bounceTicks sign at each bounce -> period T. Then rest density density is
// seeded inside the cavity: does the round trip take LONGER (dwell lag
// = the gravitational-dilation analog)?
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

const gridW = 72, gridH = 20, gridD = 20, centerY = gridH >> 1, centerZ = gridD >> 1;
const MX0 = 10, MX1 = 60;                    // mirror slab positions
if (wasm._meso3i_init(gridW, gridH, gridD, 1) !== 0) throw new Error('init failed');
const nChannels = wasm._meso3i_nch(), nMoving = nChannels - 1, restCh = nChannels - 1;
const chanVec = []; let chPX = -1;
for (let ch = 0; ch < nMoving; ch++) {
  const dir = [wasm._meso3i_cvc(ch, 0), wasm._meso3i_cvc(ch, 1), wasm._meso3i_cvc(ch, 2)];
  chanVec.push(dir);
  if (dir[0] > 0 && dir[1] === 0 && dir[2] === 0) chPX = ch;
}
const resetEngine = () => {
  wasm._meso3i_init(gridW, gridH, gridD, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_fricp(128); wasm._meso3i_friccurve(0);
  wasm._meso3i_drest(0); wasm._meso3i_reflect(16);
};

// signed x-momentum inside the cavity
const signedMomX = () => {
  let mass = 0;
  for (let x = MX0 + 4; x < MX1; x++) for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++) {
    if ((x + y + z) & 1) continue;
    for (let ch = 0; ch < nMoving; ch++) if (chanVec[ch][0] !== 0)
      mass += chanVec[ch][0] * wasm._meso3i_get(x, y, z, ch);
  }
  return mass;
};

const run = (density, fillFrac = 1, exc = 0) => {
  resetEngine();
  for (const xw of [MX0, MX1]) for (let x = xw; x < xw + 3; x++)
    for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++) {
      if ((x + y + z) & 1) continue;
      wasm._meso3i_set(x, y, z, restCh, 64);
    }
  // interior fill: deterministic sparse fraction fillFrac of sites at rest density
  if (density) for (let x = MX0 + 4; x < MX1; x++) for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++) {
    if ((x + y + z) & 1) continue;
    if (fillFrac < 1 && (((x * 7 + y * 3 + z * 11) % 8) / 8) >= fillFrac) continue;
    wasm._meso3i_set(x, y, z, restCh, density);
    if (exc) wasm._meso3i_eset(x, y, z, exc);
  }
  // packet: +x flux just right of the left mirror
  let injectedMass = 0;
  for (let dy = -4; dy <= 4; dy++) for (let dz = -4; dz <= 4; dz++) {
    const x = MX0 + 8, y = centerY + dy, z = centerZ + dz;
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, chPX, 64); injectedMass += 64;
  }
  // bounce times = M(t) sign bounceTicks
  const bounceTicks = []; let last = 0, endMomentum = 0;
  for (let t = 0; t < 400; t++) {
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    const mass = signedMomX();
    if (t === 399) endMomentum = Math.abs(mass);
    if (Math.abs(mass) < 8) continue;                 // dead zone: skip noise
    const sign = Math.sign(mass);
    if (last !== 0 && sign !== last) bounceTicks.push(t);
    last = sign;
  }
  return { bounceTicks, injectedMass, endMomentum };
};

const PHOT = +(process.argv[2] || 0);
console.log(`E4-rv PHOT=${PHOT} — cavity period vs interior density`);
const cases = [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1],
               [8, 0.5], [8, 0.75], [8, 1]];
const EXC = Number(process.argv[3] || 0);
for (const [density, fillFrac] of cases) {
  const r = run(density, fillFrac, EXC);
  const gaps = r.bounceTicks.map((t, i) => i ? t - r.bounceTicks[i - 1] : null).filter(Boolean);
  const T = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : NaN;
  console.log(`density=${density}x${fillFrac}  bounceTicks=[${r.bounceTicks.join(',')}]  half-period=${T.toFixed(1)}t  survivor=${r.endMomentum}`);
}
