// clock-halo (E4c): the honest corridor — a cavity clock inside a SUSTAINED
// flux flow, not static fill. A mass's halo is transaction traffic, and
// congestion is the dominant dilation term (gravity >> velocity).
// Transverse +y wind through the cavity can't contaminate the ±x momentum
// readout. Cases: wind off / low / high — does the round trip dilate?
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
const MX0 = 10, MX1 = 60;
if (wasm._meso3i_init(gridW, gridH, gridD, 1) !== 0) throw new Error('init failed');
const nChannels = wasm._meso3i_nch(), nMoving = nChannels - 1, restCh = nChannels - 1;
const chanVec = []; let chPX = -1, chPY = -1;
for (let ch = 0; ch < nMoving; ch++) {
  const dir = [wasm._meso3i_cvc(ch, 0), wasm._meso3i_cvc(ch, 1), wasm._meso3i_cvc(ch, 2)];
  chanVec.push(dir);
  if (dir[0] > 0 && dir[1] === 0 && dir[2] === 0) chPX = ch;
  if (dir[0] === 0 && dir[1] > 0 && dir[2] === 0) chPY = ch;   // pure +y axial
}
const resetEngine = () => {
  wasm._meso3i_init(gridW, gridH, gridD, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_fricp(128); wasm._meso3i_friccurve(0);
  wasm._meso3i_drest(0); wasm._meso3i_reflect(16);
};
// sustained isotropic bath: inject every channel on a mid-cavity sheet —
// the honest halo: transaction traffic in all directions, not one wind
const feedWind = rate => {
  for (let x = MX0 + 6; x < MX1 - 2; x += 2) for (let z = 0; z < gridD; z += 2) {
    const y = centerY;
    if ((x + y + z) & 1) continue;
    for (let ch = 0; ch < nMoving; ch++) {
      const vEff = wasm._meso3i_get(x, y, z, ch);
      if (vEff < rate) wasm._meso3i_set(x, y, z, ch, vEff + rate);
    }
  }
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
const run = rate => {
  resetEngine();
  for (const xw of [MX0, MX1]) for (let x = xw; x < xw + 3; x++)
    for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++) {
      if ((x + y + z) & 1) continue;
      wasm._meso3i_set(x, y, z, restCh, 64);
    }
  let injectedMass = 0;
  for (let dy = -4; dy <= 4; dy++) for (let dz = -4; dz <= 4; dz++) {
    const x = MX0 + 8, y = centerY + dy, z = centerZ + dz;
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, chPX, 64); injectedMass += 64;
  }
  const bounceTicks = []; let last = 0;
  for (let t = 0; t < 400; t++) {
    if (rate) feedWind(rate);
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    const mass = signedMomX();
    if (Math.abs(mass) < 8) continue;
    const sign = Math.sign(mass);
    if (last !== 0 && sign !== last) bounceTicks.push(t);
    last = sign;
  }
  const gaps = intervals(bounceTicks), T = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : NaN;
  console.log(`wind=${String(rate).padStart(2)}  bounceTicks=[${bounceTicks.join(',')}]  T_half=${T.toFixed(1)}t`);
  function intervals(fillFrac) { return fillFrac.map((t, i) => i ? t - fillFrac[i - 1] : null).filter(Boolean); }
};
console.log('E4c — cavity clock inside a sustained +y flux corridor');
for (const rate of [0, 1, 4, 8]) run(rate);
