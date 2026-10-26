// clock-vault (E1 v3): does a DRIFTING clock run slower?
// The clock: a wound vault (drest directional rest = real internal
// structure; its winding radiates at an internal cadence).
// Drift: IREFL=32 + +x beam = lit-face accretion (the regime where
// lumps genuinely translate — morphology-drift).
// Confound control: scalar lump under the same beam measures the
// pure accretion input, subtracted from the vault's dM/dt.
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

const W = 72, H = 36, D = 36, CX = 24, CY = H >> 1, CZ = D >> 1;
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
const CV = [];
for (let c = 0; c < NMOV; c++)
  CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);

const boot = drest => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_fricp(128); wasm._meso3i_friccurve(0);
  wasm._meso3i_drest(drest); wasm._meso3i_reflect(32);
};
const seedWound = (R, Q, s = 1) => {
  for (let dz = -R; dz <= R; dz++) for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    if (dx * dx + dy * dy + dz * dz > R * R) continue;
    const x = CX + dx, y = CY + dy, z = CZ + dz;
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, REST, Q);
    const vx = -s * dy, vy = s * dx;
    for (let c = 0; c < NMOV; c++) {
      const d = vx * CV[c][0] + vy * CV[c][1];
      if (d > 0) wasm._meso3i_rset(x, y, z, c, Math.min(255, Math.round(d * 8)));
    }
  }
};
const seedScalar = (R, Q) => {
  for (let dz = -R; dz <= R; dz++) for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    if (dx * dx + dy * dy + dz * dz > R * R) continue;
    const x = CX + dx, y = CY + dy, z = CZ + dz;
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, REST, Q);
  }
};
const beam = () => {
  for (let c = 0; c < NMOV; c++) {
    const [vx, vy, vz] = CV[c];
    if (vx <= 0) continue;
    const sx = CX - 3 * vx, sy = CY - 3 * vy, sz = CZ - 3 * vz;
    for (let u = 0; u < 4; u++)
      wasm._meso3i_set(sx, sy, sz, c, wasm._meso3i_get(sx, sy, sz, c) + 1);
  }
};
const run = (tag, seedFn, drest, beamT) => {
  boot(drest); seedFn();
  const T = 800, out = [];
  for (let t = 0; t <= T; t++) {
    if (t <= beamT) beam();
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    if (t % 100 === 0) {
      wasm._meso3i_rg_refresh();
      out.push(`t${t}: rest=${wasm._meso3i_rest_mass()} cm=${(wasm._meso3i_cm(0) / 256).toFixed(2)}`);
    }
  }
  console.log(`\n${tag}`); out.forEach(s => console.log('  ' + s));
};
console.log('E1 v3 — wound vault drift clock (IREFL=32, +x beam 800t)');
run('static vault', () => seedWound(5, 48), 1, -1);
run('drifting vault', () => seedWound(5, 48), 1, 800);
run('scalar control (+x beam)', () => seedScalar(5, 48), 0, 800);
