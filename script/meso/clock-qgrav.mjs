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

const W = 72, H = 20, D = 20, CY = H >> 1, CZ = D >> 1;
const MX0 = 10, MX1 = 60, QX = 35;           // Q well at cavity center
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
const CV = []; let XPX = -1;
for (let c = 0; c < NMOV; c++) {
  const v = [wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)];
  CV.push(v);
  if (v[0] > 0 && v[1] === 0 && v[2] === 0) XPX = c;
}
const boot = qmode => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_fricp(128); wasm._meso3i_friccurve(0);
  wasm._meso3i_drest(0); wasm._meso3i_reflect(16);
  wasm._meso3i_qmode(qmode);
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
const run = (qmode, qv) => {
  boot(qmode);
  for (const xw of [MX0, MX1]) for (let x = xw; x < xw + 3; x++)
    for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) {
      if ((x + y + z) & 1) continue;
      wasm._meso3i_set(x, y, z, REST, 64);
    }
  if (qv) for (let dz = -3; dz <= 3; dz++) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    if (dx * dx + dy * dy + dz * dz > 9) continue;
    const x = QX + dx, y = CY + dy, z = CZ + dz;
    if ((x + y + z) & 1) continue;
    wasm._meso3i_qset(x, y, z, qv);
  }
  let m0 = 0;
  for (let dy = -4; dy <= 4; dy++) for (let dz = -4; dz <= 4; dz++) {
    const x = MX0 + 8, y = CY + dy, z = CZ + dz;
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, XPX, 64); m0 += 64;
  }
  const flips = []; let last = 0;
  for (let t = 0; t < 400; t++) {
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    const m = momX();
    if (Math.abs(m) < 8) continue;
    const s = Math.sign(m);
    if (last !== 0 && s !== last) flips.push(t);
    last = s;
  }
  const d = flips.map((t, i) => i ? t - flips[i - 1] : null).filter(Boolean);
  const T = d.length ? d.reduce((a, b) => a + b, 0) / d.length : NaN;
  console.log(`qmode=${qmode} Q=${String(qv).padStart(3)}  flips=[${flips.slice(0, 12).join(',')}${flips.length > 12 ? '...' : ''}]  T_half=${T.toFixed(1)}t`);
};
console.log('E5 — cavity clock through a Q-mass well (IQMODE 7 self-focusing)');
run(0, 0);          // control: no Q mechanics, no well
run(7, 0);          // qmode on, empty well
for (const qv of [1, 2, 4, 8, 16]) run(7, qv);
