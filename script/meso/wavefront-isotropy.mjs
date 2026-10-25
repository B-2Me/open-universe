// wavefront-isotropy: drop a point pulse, measure the expanding front's
// facetness. D3Q19 is a two-speed lattice (axials v=2, face-diagonals
// v=1), so the honest expectation is a two-shell front — the question
// is whether the arrival surface is round within each speed class.
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

const W = 72, H = 72, D = 36;
const CX = W >> 1, CY = H >> 1, CZ = D >> 1;
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
wasm._meso3i_clear();
wasm._meso3i_collmode(0);
wasm._meso3i_friction(0);          // ballistic — measure transport, not parking
wasm._meso3i_fricmode(0);          // rest collides; nothing parks anyway
wasm._meso3i_drest(0);

const NCH = wasm._meso3i_nch(), NMOV = NCH - 1;
const CV = [];
for (let c = 0; c < NMOV; c++)
  CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);

// isotropic sparse pulse: 2 quanta per channel at center
for (let c = 0; c < NMOV; c++)
  wasm._meso3i_set(CX, CY, CZ, c, wasm._meso3i_get(CX, CY, CZ, c) + 2);

// probe along each channel direction: farthest site with flux>0 at hop k
const probe = () => {
  const out = [];
  for (let c = 0; c < NMOV; c++) {
    const [vx, vy, vz] = CV[c];
    const step = Math.max(Math.abs(vx), Math.abs(vy), Math.abs(vz)) || 1;
    let r = 0;
    for (let k = 1; k <= 16; k++) {
      const x = CX + vx * k / step * Math.ceil(step),  // march in channel-vector units
            y = CY + vy * k / step * Math.ceil(step),
            z = CZ + vz * k / step * Math.ceil(step);
      // march by the channel vector each hop
      const px = CX + vx * k, py = CY + vy * k, pz = CZ + vz * k;
      if (px < 0 || px >= W || py < 0 || py >= H || pz < 0 || pz >= D) break;
      let f = 0;
      for (let c2 = 0; c2 < NMOV; c2++) f += wasm._meso3i_get(px, py, pz, c2);
      if (f > 0) r = Math.hypot(vx * k, vy * k, vz * k);
    }
    out.push([`(${vx},${vy},${vz})`, r]);
  }
  return out;
};

for (let t = 0; t <= 12; t += 4) {
  if (t > 0) for (let i = 0; i < 4; i++) { wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); }
  wasm._meso3i_rg_refresh();
  const p = probe();
  const axial = p.filter((_, c) => Math.abs(CV[c][0]) + Math.abs(CV[c][1]) + Math.abs(CV[c][2]) === 2 && CV[c].some(v => Math.abs(v) === 2));
  console.log(`t${t}: flux=${wasm._meso3i_mov_mass()}`);
  console.log('  reach per channel: ' + p.map(([d, r]) => `${d}:${r}`).join(' '));
}

// radial population profile at t=12
const prof = new Map();
for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  let f = 0;
  for (let c = 0; c < NMOV; c++) f += wasm._meso3i_get(x, y, z, c);
  if (!f) continue;
  const r = Math.round(Math.hypot(x - CX, y - CY, z - CZ));
  prof.set(r, (prof.get(r) || 0) + f);
}
console.log('radial profile: ' + [...prof.entries()].sort((a, b) => a[0] - b[0]).map(([r, v]) => `r${r}:${v}`).join(' '));
