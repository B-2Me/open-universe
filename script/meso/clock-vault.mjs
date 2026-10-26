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

const gridW = 72, gridH = 36, gridD = 36, centerX = 24, centerY = gridH >> 1, centerZ = gridD >> 1;
if (wasm._meso3i_init(gridW, gridH, gridD, 1) !== 0) throw new Error('init failed');
const nChannels = wasm._meso3i_nch(), nMoving = nChannels - 1, restCh = nChannels - 1;
const chanVec = [];
for (let ch = 0; ch < nMoving; ch++)
  chanVec.push([wasm._meso3i_cvc(ch, 0), wasm._meso3i_cvc(ch, 1), wasm._meso3i_cvc(ch, 2)]);

const resetEngine = drest => {
  wasm._meso3i_init(gridW, gridH, gridD, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_fricp(128); wasm._meso3i_friccurve(0);
  wasm._meso3i_drest(drest); wasm._meso3i_reflect(32);
};
const seedWound = (R, Q, sign = 1) => {
  for (let dz = -R; dz <= R; dz++) for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    if (dx * dx + dy * dy + dz * dz > R * R) continue;
    const x = centerX + dx, y = centerY + dy, z = centerZ + dz;
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, restCh, Q);
    const vx = -sign * dy, vy = sign * dx;
    for (let ch = 0; ch < nMoving; ch++) {
      const winding = vx * chanVec[ch][0] + vy * chanVec[ch][1];
      if (winding > 0) wasm._meso3i_rset(x, y, z, ch, Math.min(255, Math.round(winding * 8)));
    }
  }
};
const seedScalar = (R, Q) => {
  for (let dz = -R; dz <= R; dz++) for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    if (dx * dx + dy * dy + dz * dz > R * R) continue;
    const x = centerX + dx, y = centerY + dy, z = centerZ + dz;
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, restCh, Q);
  }
};
const beam = () => {
  for (let ch = 0; ch < nMoving; ch++) {
    const [vx, vy, vz] = chanVec[ch];
    if (vx <= 0) continue;
    const sumX = centerX - 3 * vx, sumY = centerY - 3 * vy, sz = centerZ - 3 * vz;
    for (let reps = 0; reps < 4; reps++)
      wasm._meso3i_set(sumX, sumY, sz, ch, wasm._meso3i_get(sumX, sumY, sz, ch) + 1);
  }
};
const run = (tag, seedFn, drest, beamT) => {
  resetEngine(drest); seedFn();
  const T = 800, out = [];
  for (let t = 0; t <= T; t++) {
    if (t <= beamT) beam();
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    if (t % 100 === 0) {
      wasm._meso3i_rg_refresh();
      out.push(`t${t}: rest=${wasm._meso3i_rest_mass()} cm=${(wasm._meso3i_cm(0) / 256).toFixed(2)}`);
    }
  }
  console.log(`\n${tag}`); out.forEach(sign => console.log('  ' + sign));
};
console.log('E1 v3 — wound vault drift clock (IREFL=32, +x beam 800t)');
run('static vault', () => seedWound(5, 48), 1, -1);
run('drifting vault', () => seedWound(5, 48), 1, 800);
run('scalar control (+x beam)', () => seedScalar(5, 48), 0, 800);
