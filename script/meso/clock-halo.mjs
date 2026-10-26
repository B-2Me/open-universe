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

const W = 72, H = 20, D = 20, CY = H >> 1, CZ = D >> 1;
const MX0 = 10, MX1 = 60;
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
const CV = []; let XPX = -1, YPX = -1;
for (let c = 0; c < NMOV; c++) {
  const v = [wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)];
  CV.push(v);
  if (v[0] > 0 && v[1] === 0 && v[2] === 0) XPX = c;
  if (v[0] === 0 && v[1] > 0 && v[2] === 0) YPX = c;   // pure +y axial
}
const boot = () => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_fricp(128); wasm._meso3i_friccurve(0);
  wasm._meso3i_drest(0); wasm._meso3i_reflect(16);
};
// sustained isotropic bath: inject every channel on a mid-cavity sheet —
// the honest halo: transaction traffic in all directions, not one wind
const feedWind = rate => {
  for (let x = MX0 + 6; x < MX1 - 2; x += 2) for (let z = 0; z < D; z += 2) {
    const y = CY;
    if ((x + y + z) & 1) continue;
    for (let c = 0; c < NMOV; c++) {
      const v = wasm._meso3i_get(x, y, z, c);
      if (v < rate) wasm._meso3i_set(x, y, z, c, v + rate);
    }
  }
};
const momX = () => {
  let m = 0;
  for (let x = MX0 + 4; x < MX1; x++) for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) {
    if ((x + y + z) & 1) continue;
    for (let c = 0; c < NMOV; c++) if (CV[c][0] !== 0)
      m += CV[c][0] * wasm._meso3i_get(x, y, z, c);
  }
  return m;
};
const run = rate => {
  boot();
  for (const xw of [MX0, MX1]) for (let x = xw; x < xw + 3; x++)
    for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) {
      if ((x + y + z) & 1) continue;
      wasm._meso3i_set(x, y, z, REST, 64);
    }
  let m0 = 0;
  for (let dy = -4; dy <= 4; dy++) for (let dz = -4; dz <= 4; dz++) {
    const x = MX0 + 8, y = CY + dy, z = CZ + dz;
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, XPX, 64); m0 += 64;
  }
  const flips = []; let last = 0;
  for (let t = 0; t < 400; t++) {
    if (rate) feedWind(rate);
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    const m = momX();
    if (Math.abs(m) < 8) continue;
    const s = Math.sign(m);
    if (last !== 0 && s !== last) flips.push(t);
    last = s;
  }
  const d = r_(flips), T = d.length ? d.reduce((a, b) => a + b, 0) / d.length : NaN;
  console.log(`wind=${String(rate).padStart(2)}  flips=[${flips.join(',')}]  T_half=${T.toFixed(1)}t`);
  function r_(f) { return f.map((t, i) => i ? t - f[i - 1] : null).filter(Boolean); }
};
console.log('E4c — cavity clock inside a sustained +y flux corridor');
for (const rate of [0, 1, 4, 8]) run(rate);
