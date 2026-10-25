// drift-replicate: mass-matched replication of M49's drift reversal.
// M49 grew lumps under each flag combo, so the IREFL=32 remnant was ~2x
// heavier than baseline — mass-confounded. Here every run starts from the
// IDENTICAL seeded sphere (R5 scalar rest=48, same seeding as M45's
// woundLump): flag-dependent evolution is the measurement, not a
// covariate. Settle 60t -> beam 800t (canonical spoke geometry from
// test_replay.c / fric-sweep C). +x beam = source at -x, quanta +x.
// Drift = rest-centroid cm_x relative to seeded center.
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
const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
const CV = [];
for (let c = 0; c < NMOV; c++)
  CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);

const boot = refl => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0);
  wasm._meso3i_friction(8);
  wasm._meso3i_fricmode(-4);
  wasm._meso3i_drest(0);
  wasm._meso3i_fricp(128);
  wasm._meso3i_friccurve(0);
  wasm._meso3i_reflect(refl);
};

const seedLump = (R = 5, Q = 48) => {
  let m0 = 0;
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x + y + z) & 1) continue;
    const dx = x - CX, dy = y - CY, dz = z - CZ;
    if (dx * dx + dy * dy + dz * dz > R * R) continue;
    wasm._meso3i_set(x, y, z, REST, Q);
    m0 += Q;
  }
  return m0;
};

// canonical replay beam: channels with vx*sign > 0, +4 quanta at C-3*v
const beam = sign => {
  for (let c = 0; c < NMOV; c++) {
    const [vx, vy, vz] = CV[c];
    if (vx * sign <= 0) continue;
    const sx = CX - 3 * vx, sy = CY - 3 * vy, sz = CZ - 3 * vz;
    for (let u = 0; u < 4; u++)
      wasm._meso3i_set(sx, sy, sz, c, wasm._meso3i_get(sx, sy, sz, c) + 1);
  }
};

const SETTLE = 60, BEAM_T = 800;
// st_cx/st_rest only refresh inside rg_refresh; cm is fixed-point x256;
// ev counters persist across init — reset per config
const snap = () => { wasm._meso3i_rg_refresh();
  return [wasm._meso3i_cm(0) / 256, wasm._meso3i_rest_mass()]; };
const run = (refl, sign, tag) => {
  boot(refl);
  wasm._meso3i_ev_reset();
  const m0 = seedLump();
  const rows = [];
  let cS = CX;
  for (let t = 0; t <= SETTLE + BEAM_T; t++) {
    if (t > SETTLE) beam(sign);
    wasm._meso3i_drain_edge(3);
    wasm._meso3i_tick();
    if (t % 100 === 0 || t === SETTLE) {
      const [cxr, rst] = snap();
      cS = cxr;
      rows.push(`t${String(t).padStart(4)}: cm_x=${cxr.toFixed(3)}` +
        ` rest=${rst} park=${wasm._meso3i_ev(0)} refl=${wasm._meso3i_ev(6)}`);
    }
  }
  console.log(`\n=== ${tag} (seeded mass ${m0}) ===`);
  rows.forEach(r => console.log('  ' + r));
  console.log(`  >> net drift ${(cS - CX).toFixed(3)} cells ` +
    `(${sign === 0 ? 'no beam' : (cS - CX) * sign < 0 ? 'TOWARD source' : 'AWAY from source'})`);
};

run(0, +1, 'IREFL=0  +x beam');
run(0, -1, 'IREFL=0  -x beam');
run(32, +1, 'IREFL=32 +x beam');
run(32, -1, 'IREFL=32 -x beam');
run(64, +1, 'IREFL=64 +x beam');
run(0, 0, 'IREFL=0  no-beam control');
run(32, 0, 'IREFL=32 no-beam control');
