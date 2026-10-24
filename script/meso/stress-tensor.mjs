// stress-tensor: extract the momentum-flux tensor Pi_ij = sum_c c_i c_j n_c
// in radial shells around a driven ember. If the moving population is
// isotropic, Pi ~ P*delta_ij: diagonals equal, off-diagonals ~0.
// P(r) vs rho(r) is the emergent equation of state.
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
wasm._meso3i_friction(8);
wasm._meso3i_fricmode(-4);
wasm._meso3i_lat(1);

const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
const CV = [];
for (let c = 0; c < NMOV; c++)
  CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);

const drive = () => {
  for (let c = 0; c < NMOV; c++) {
    const [vx, vy, vz] = CV[c];
    wasm._meso3i_set(CX - 3 * vx, CY - 3 * vy, CZ - 3 * vz, c,
      wasm._meso3i_get(CX - 3 * vx, CY - 3 * vy, CZ - 3 * vz, c) + 4);
  }
};

// settle into the breathing-core attractor
for (let t = 0; t < 300; t++) { drive(); wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); }
wasm._meso3i_rg_refresh();
console.log(`settled: rest=${wasm._meso3i_rest_mass()} flux=${wasm._meso3i_mov_mass()}`);

// shell-wise Pi_ij and rho
const RBINS = [0, 2, 4, 6, 9, 12, 16, 24];
for (let s = 0; s < RBINS.length - 1; s++) {
  const r0 = RBINS[s], r1 = RBINS[s + 1];
  let Pxx = 0, Pyy = 0, Pzz = 0, Pxy = 0, Pxz = 0, Pyz = 0;
  let rho = 0, rest = 0, nsites = 0;
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const r = Math.hypot(x - CX, y - CY, z - CZ);
    if (r < r0 || r >= r1) continue;
    if ((x + y + z) & 1) continue;
    nsites++;
    rest += wasm._meso3i_get(x, y, z, REST);
    for (let c = 0; c < NMOV; c++) {
      const n = wasm._meso3i_get(x, y, z, c);
      if (!n) continue;
      rho += n;
      Pxx += n * CV[c][0] * CV[c][0];
      Pyy += n * CV[c][1] * CV[c][1];
      Pzz += n * CV[c][2] * CV[c][2];
      Pxy += n * CV[c][0] * CV[c][1];
      Pxz += n * CV[c][0] * CV[c][2];
      Pyz += n * CV[c][1] * CV[c][2];
    }
  }
  const P = (Pxx + Pyy + Pzz) / 3;
  const ani = P ? Math.max(Math.abs(Pxy), Math.abs(Pxz), Math.abs(Pyz)) / P : 0;
  console.log(`r∈[${String(r0).padStart(2)},${String(r1).padStart(2)}): sites=${nsites} ρ_mov=${rho} ρ_rest=${rest} | ` +
    `Pxx=${(Pxx / nsites).toFixed(2)} Pyy=${(Pyy / nsites).toFixed(2)} Pzz=${(Pzz / nsites).toFixed(2)} | ` +
    `off/P=${ani.toFixed(3)} | P/ρ=${rho ? (P / rho).toFixed(3) : '—'}`);
}
