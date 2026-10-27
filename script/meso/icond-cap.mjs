// icond-cap (E17): the last two field knobs.
// ICOND weights rest-output collisions near dense nodes — a parked-mass
// accretion ratchet. Probe: dilute bath + seed lump, ICOND on/off, does
// the lump gain rest mass? IQCAP: Q-core overflow cap — peak-pump emit.
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
const W = 48, H = 48, D = 48, CX = 24, CY = 24, CZ = 24;
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NMOV = wasm._meso3i_nch() - 1, REST = NMOV;
const boot = () => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_fricp(128); wasm._meso3i_drest(0); wasm._meso3i_reflect(0);
};
const runICOND = ic => {
  boot(); wasm._meso3i_condense(ic);
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x + y + z) & 1) continue;
    const dx = x - CX, dy = y - CY, dz = z - CZ;
    if (dx * dx + dy * dy + dz * dz <= 16) wasm._meso3i_set(x, y, z, REST, 32);
    else if ((x * 3 + y * 5 + z * 7) % 9 === 0)
      wasm._meso3i_set(x, y, z, (x + 2 * y + 3 * z) % NMOV, 6);
  }
  wasm._meso3i_rg_refresh();
  const r0 = wasm._meso3i_rest_mass();
  for (let t = 0; t < 200; t++) { wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); }
  wasm._meso3i_rg_refresh();
  console.log(`ICOND=${String(ic).padStart(3)}  rest ${r0} -> ${wasm._meso3i_rest_mass()}`);
};
console.log('E17a — ICOND: lump accretion in dilute bath');
for (const ic of [0, 8, 64]) runICOND(ic);
const runQCAP = qc => {
  boot(); wasm._meso3i_qmode(4); wasm._meso3i_qdir(12); wasm._meso3i_qcap(qc);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
    const x = CX + 2 * dx, y = CY + 2 * dy, z = CZ + 2 * dz;
    if ((x + y + z) & 1) continue;
    wasm._meso3i_qset(x, y, z, 64);
  }
  const series = [];
  for (let t = 0; t < 60; t++) {
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    if (t % 10 === 0) series.push(wasm._meso3i_qget(CX, CY, CZ));
  }
  console.log(`IQCAP=${String(qc).padStart(3)}  Q_core=[${series.join(',')}]`);
};
console.log('E17b — IQCAP: peak-pump profile (Q=64 seed, mode4+IDIR)');
for (const qc of [0, 4, 16]) runQCAP(qc);
