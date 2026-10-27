// clock-field (E16): the E4 cavity inside a uniform IFLD field.
// IFLD boosts field-aligned collision outputs — a standing +
// acceleration analog. If it pushes carriers, the bounce clock's
// +x and -x legs should go ASYMMETRIC: T_down vs T_up — the
// gravity-vs-uniform-acceleration equivalence probe.
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
const NMOV = wasm._meso3i_nch() - 1, REST = NMOV;
const CV = []; let XPX = -1, XMX = -1;
for (let c = 0; c < NMOV; c++) {
  const v = [wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)];
  CV.push(v);
  if (v[0] > 0 && v[1] === 0 && v[2] === 0) XPX = c;
  if (v[0] < 0 && v[1] === 0 && v[2] === 0) XMX = c;
}
const momX = () => {
  let m = 0;
  for (let x = MX0 + 4; x < MX1; x++) for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) {
    if ((x + y + z) & 1) continue;
    for (let c = 0; c < NMOV; c++) if (CV[c][0] !== 0)
      m += CV[c][0] * wasm._meso3i_get(x, y, z, c);
  }
  return m;
};
const run = f => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_fricp(128); wasm._meso3i_drest(0); wasm._meso3i_reflect(16);
  wasm._meso3i_field(1, 0, 0, f);          // uniform +x field
  for (const xw of [MX0, MX1]) for (let x = xw; x < xw + 3; x++)
    for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) {
      if ((x + y + z) & 1) continue;
      wasm._meso3i_set(x, y, z, REST, 64);
    }
  for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
    const x = MX0 + 8, y = CY + dy, z = CZ + dz;
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, XPX, 64);
  }
  const flips = []; let last = 0;
  for (let t = 0; t < 400; t++) {
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    const m = momX();
    if (Math.abs(m) < 40) continue;
    const s = Math.sign(m);
    if (last !== 0 && s !== last) flips.push(t);
    last = s;
  }
  const gaps = flips.map((t, i) => i ? t - flips[i - 1] : null).filter(Boolean);
  console.log(`IFLD=${String(f).padStart(3)}  flips=[${flips.slice(0, 10).join(',')}]  gaps=[${gaps.slice(0, 9).join(',')}]`);
};
console.log('E16 — cavity clock in uniform +x field (asymmetry test)');
for (const f of [0, 16, 64, 128]) run(f);
