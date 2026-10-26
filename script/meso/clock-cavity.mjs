// clock-cavity (E4): the honest light-clock. A +x packet bounces between
// two parked mirrors (Q64/IREFL16 = 0.80 reflectance); signed x-momentum
// M(t) flips sign at each bounce -> period T. Then rest density q is
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

const W = 72, H = 20, D = 20, CY = H >> 1, CZ = D >> 1;
const MX0 = 10, MX1 = 60;                    // mirror slab positions
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
const CV = []; let XPX = -1;
for (let c = 0; c < NMOV; c++) {
  const v = [wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)];
  CV.push(v);
  if (v[0] > 0 && v[1] === 0 && v[2] === 0) XPX = c;
}
const boot = () => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_fricp(128); wasm._meso3i_friccurve(0);
  wasm._meso3i_drest(0); wasm._meso3i_reflect(16);
};

// signed x-momentum inside the cavity
const momX = () => {
  let m = 0;
  for (let x = MX0 + 4; x < MX1; x++) for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) {
    if ((x + y + z) & 1) continue;
    for (let c = 0; c < NMOV; c++) if (CV[c][0] !== 0)
      m += CV[c][0] * wasm._meso3i_get(x, y, z, c);
  }
  return m;
};

const run = (q, f = 1) => {
  boot();
  for (const xw of [MX0, MX1]) for (let x = xw; x < xw + 3; x++)
    for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) {
      if ((x + y + z) & 1) continue;
      wasm._meso3i_set(x, y, z, REST, 64);
    }
  // interior fill: deterministic sparse fraction f of sites at rest q
  if (q) for (let x = MX0 + 4; x < MX1; x++) for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) {
    if ((x + y + z) & 1) continue;
    if (f < 1 && (((x * 7 + y * 3 + z * 11) % 8) / 8) >= f) continue;
    wasm._meso3i_set(x, y, z, REST, q);
  }
  // packet: +x flux just right of the left mirror
  let m0 = 0;
  for (let dy = -4; dy <= 4; dy++) for (let dz = -4; dz <= 4; dz++) {
    const x = MX0 + 8, y = CY + dy, z = CZ + dz;
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, XPX, 64); m0 += 64;
  }
  // bounce times = M(t) sign flips
  const flips = []; let last = 0, mEnd = 0;
  for (let t = 0; t < 400; t++) {
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    const m = momX();
    if (t === 399) mEnd = Math.abs(m);
    if (Math.abs(m) < 8) continue;                 // dead zone: skip noise
    const s = Math.sign(m);
    if (last !== 0 && s !== last) flips.push(t);
    last = s;
  }
  return { flips, m0, mEnd };
};

console.log('E4 — cavity period vs interior rest density (mirrors x=10..60)');
const cases = [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1],
               [8, 0.5], [8, 0.75], [8, 1]];
for (const [q, f] of cases) {
  const r = run(q, f);
  const d = r.flips.map((t, i) => i ? t - r.flips[i - 1] : null).filter(Boolean);
  const T = d.length ? d.reduce((a, b) => a + b, 0) / d.length : NaN;
  console.log(`q=${q}x${f}  flips=[${r.flips.join(',')}]  half-period=${T.toFixed(1)}t  survivor=${r.mEnd}`);
}
