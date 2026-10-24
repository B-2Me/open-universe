// m37-drift2: FAITHFUL M37 replication — no drive, self-radiating
// lumps (fricmode>0 unconditional boil-off). Each lump's own radiation
// is the other's ablation source: the far side loses more than the
// near side -> net approach. Solo control must show ~zero drift
// (isotropic radiation, no partner to shadow against).
//
// Original (5a7f8b2): 44^3, sep=4/8/16, mpn=30, r^2<=8, fric=8,
// fricm=8, 1400t -> sep=4 drift -0.6 cells; sep=8/16 flat.
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

const W = 44, H = 44, D = 44;
const CX = W >> 1, CY = H >> 1, CZ = D >> 1;
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NCH = wasm._meso3i_nch(), REST = NCH - 1;

const boot = () => {
  wasm._meso3i_clear();
  wasm._meso3i_collmode(0);
  wasm._meso3i_friction(8);
  wasm._meso3i_fricmode(8);      // unconditional radiation — M37's regime
  wasm._meso3i_lat(1);
  wasm._meso3i_drest(0);
};
const lump = lx => {
  for (let dz = -3; dz <= 3; dz++) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    if (dx * dx + dy * dy + dz * dz > 8) continue;
    const x = lx + dx, y = CY + dy, z = CZ + dz;
    if ((x + y + z) & 1 || x < 0 || x >= W || y < 0 || y >= H || z < 0 || z >= D) continue;
    wasm._meso3i_set(x, y, z, REST, 30);
  }
};
// per-half rest centroid (faithful to test_two.c)
const cmx = sgn => {
  let m = 0, sx = 0;
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x + y + z) & 1) continue;
    if (sgn > 0 && x <= CX) continue;
    if (sgn < 0 && x >= CX) continue;
    const r = wasm._meso3i_get(x, y, z, REST);
    m += r; sx += r * x;
  }
  return m > 5 ? sx / m : NaN;
};

const T = 700, STEP = 25;
const run = (seedL, seedR) => {
  boot();
  if (seedL != null) lump(seedL);
  if (seedR != null) lump(seedR);
  const track = [];
  for (let t = 0; t <= T; t++) {
    if (t % STEP === 0) track.push([t, cmx(-1), cmx(+1)]);
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
  }
  return track;
};

const slope = (track, i) => {
  const pts = track.filter(([t, a, b]) => !isNaN(i === 1 ? a : b));
  const ys = pts.map(p => [p[0], i === 1 ? p[1] : p[2]]);
  const n = ys.length; if (n < 3) return NaN;
  const mt = ys.reduce((a, p) => a + p[0], 0) / n, my = ys.reduce((a, p) => a + p[1], 0) / n;
  let num = 0, den = 0;
  for (const [t, y] of ys) { num += (t - mt) * (y - my); den += (t - mt) ** 2; }
  return num / den;
};

for (const sep of [4, 8, 12, 16]) {
  const h = sep >> 1;
  const pair = run(CX - h, CX + h);
  const loneL = run(CX - h, null);
  const loneR = run(null, CX + h);
  const alive = pair.filter(([t, a, b]) => !isNaN(a) && !isNaN(b));
  const sep0 = alive[0], sepT = alive[alive.length - 1];
  const close = sepT[2] - sepT[1] - (sep0[2] - sep0[1]);   // sep(t) - sep(0), <0 = approach
  if (sep === 4) console.log('  sep4 track: ' + alive.map(([t, a, b]) => `${t}:${(b - a).toFixed(2)}`).join(' '));
  const vPair = slope(pair, 1) - slope(pair, 2);
  const vBase = slope(loneL, 1) - slope(loneR, 2);
  console.log(`sep=${String(sep).padStart(2)}: Δsep=${close.toFixed(3)} cells over ${sepT[0]}t | ` +
    `v_close pair=${vPair.toFixed(6)} base=${vBase.toFixed(6)} mutual=${(vPair - vBase).toFixed(6)} | ` +
    `end L=${sepT[1].toFixed(2)} R=${sepT[2].toFixed(2)}`);
}
