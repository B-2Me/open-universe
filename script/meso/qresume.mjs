// qresume (E13): directed-resume delay line for mass carriers.
// IQMODE=4 capture eats +x flux into Q; mode>=3 + IDIR=chPX re-emits
// onto the forward channel on the beat — detention WITHOUT losing
// direction. The "clear glass" analog for the mass field (photons
// can't capture; quanta can). Corridor of Q nodes vs forward coherence.
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
const W = 96, H = 24, D = 24, CY = H >> 1, CZ = D >> 1;
const X0 = 20, X2 = 64;
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NMOV = wasm._meso3i_nch() - 1, REST = NMOV;
const CV = []; let XPX = -1;
for (let c = 0; c < NMOV; c++) {
  const v = [wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)];
  CV.push(v);
  if (v[0] > 0 && v[1] === 0 && v[2] === 0) XPX = c;
}
// flux in detector zone, split forward vs lateral
const zone = dir => {
  let m = 0;
  for (let x = X2; x < W - 1; x++) for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) {
    if ((x + y + z) & 1) continue;
    if (dir === 'fwd') m += wasm._meso3i_get(x, y, z, XPX);
    else for (let c = 0; c < NMOV; c++) if (CV[c][0] <= 0 || CV[c][1] || CV[c][2]) m += wasm._meso3i_get(x, y, z, c);
  }
  return m;
};
const run = (qmode, idir, qseed) => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_fricp(128); wasm._meso3i_drest(0); wasm._meso3i_reflect(0);
  wasm._meso3i_qmode(qmode); wasm._meso3i_qdir(idir);
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = X0; x < X0 + 8; x++) {
    if ((x + y + z) & 1) continue;
    wasm._meso3i_qset(x, y, z, qseed);
  }
  for (let t = 0; t < 10; t++) { wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); }
  for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
    const x = 8, y = CY + dy, z = CZ + dz;
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, XPX, 64);
  }
  let fwd0 = -1, lat0 = -1, series = [];
  for (let t = 0; t < 200; t++) {
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    const f = zone('fwd'), l = zone('lat');
    if (fwd0 < 0 && f >= 8) fwd0 = t;
    if (lat0 < 0 && l >= 8) lat0 = t;
    if (t % 10 === 0) series.push(`t${t}:f${f}/l${l}`);
  }
  console.log(`qmode=${qmode} idir=${idir >= 0 ? idir : 'off'} Q=${qseed}  fwd_t=${fwd0} lat_t=${lat0}  [${series.join(' ')}]`);
};
console.log('E13 — directed resume: +x pulse through Q-capture corridor (Q=8, X0=20..40)');
run(0, -1, 0);       // no Q mechanics: baseline
run(4, -1, 1);       // capture, momentum-neutral pair emit (control)
run(4, XPX, 1);      // capture + forward resume onto +x (Q=1: capture-gate only)
run(7, XPX, 1);      // self-focusing capture + forward resume
