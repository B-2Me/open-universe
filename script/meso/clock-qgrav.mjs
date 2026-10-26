// clock-qgrav (E5): the cavity clock inside a Q-mass's self-focusing
// field — IQMODE 7's mass-attracts-mass term (capture p ~ (1+Q)/16).
// A Q blob sits ON the bounce path at cavity center: the packet must
// transit the "gravitational" well each leg. T_half vs Q density.
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
const MX0 = 10, MX1 = 60, QX = 35;           // Q well at cavity center
if (wasm._meso3i_init(gridW, gridH, gridD, 1) !== 0) throw new Error('init failed');
const nChannels = wasm._meso3i_nch(), nMoving = nChannels - 1, restCh = nChannels - 1;
const chanVec = []; let chPX = -1;
for (let ch = 0; ch < nMoving; ch++) {
  const dir = [wasm._meso3i_cvc(ch, 0), wasm._meso3i_cvc(ch, 1), wasm._meso3i_cvc(ch, 2)];
  chanVec.push(dir);
  if (dir[0] > 0 && dir[1] === 0 && dir[2] === 0) chPX = ch;
}
const resetEngine = qmode => {
  wasm._meso3i_init(gridW, gridH, gridD, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_fricp(128); wasm._meso3i_friccurve(0);
  wasm._meso3i_drest(0); wasm._meso3i_reflect(16);
  wasm._meso3i_qmode(qmode);
};
const signedMomX = () => {
  let mass = 0;
  for (let x = MX0 + 4; x < MX1; x++) for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++) {
    if ((x + y + z) & 1) continue;
    for (let ch = 0; ch < nMoving; ch++) if (chanVec[ch][0] !== 0)
      mass += chanVec[ch][0] * wasm._meso3i_get(x, y, z, ch);
  }
  return mass;
};
const run = (qmode, qv) => {
  resetEngine(qmode);
  for (const xw of [MX0, MX1]) for (let x = xw; x < xw + 3; x++)
    for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++) {
      if ((x + y + z) & 1) continue;
      wasm._meso3i_set(x, y, z, restCh, 64);
    }
  if (qv) for (let dz = -3; dz <= 3; dz++) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    if (dx * dx + dy * dy + dz * dz > 9) continue;
    const x = QX + dx, y = centerY + dy, z = centerZ + dz;
    if ((x + y + z) & 1) continue;
    wasm._meso3i_qset(x, y, z, qv);
  }
  let injectedMass = 0;
  for (let dy = -4; dy <= 4; dy++) for (let dz = -4; dz <= 4; dz++) {
    const x = MX0 + 8, y = centerY + dy, z = centerZ + dz;
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, chPX, 64); injectedMass += 64;
  }
  const bounceTicks = []; let last = 0;
  for (let t = 0; t < 400; t++) {
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    const mass = signedMomX();
    if (Math.abs(mass) < 8) continue;
    const sign = Math.sign(mass);
    if (last !== 0 && sign !== last) bounceTicks.push(t);
    last = sign;
  }
  const gaps = bounceTicks.map((t, i) => i ? t - bounceTicks[i - 1] : null).filter(Boolean);
  const T = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : NaN;
  console.log(`qmode=${qmode} Q=${String(qv).padStart(3)}  bounceTicks=[${bounceTicks.slice(0, 12).join(',')}${bounceTicks.length > 12 ? '...' : ''}]  T_half=${T.toFixed(1)}t`);
};
console.log('E5 — cavity clock through a Q-mass well (IQMODE 7 self-focusing)');
run(0, 0);          // control: no Q mechanics, no well
run(7, 0);          // qmode on, empty well
for (const qv of [1, 2, 4, 8, 16]) run(7, qv);
