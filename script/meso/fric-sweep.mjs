// fric-sweep: capture-rule parameter space — the constants M33 froze.
//   A. Universality: flat p_park {25,50,75%} vs graded ramps — does the
//      driven-ember attractor (accretion + post-cutoff survival) survive
//      the capture constant, or was p=1/2 a lucky pick?
//   B. Core-and-skin: IFRIC=8 with IREFL in series {0,16,32,64} — does a
//      lump grow a zero-porosity saturated core inside a porous skin?
//      Evidence: ev[6] reflect events + flattened radial rest profile.
//   C. Drift attenuation: one-sided beam + IREFL {0,32,64} — the wall
//      absorbs the momentum flip, so the honest prediction is the M36
//      ablation-pull dies at saturation rather than reversing to push.
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
const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
const CV = [];
for (let c = 0; c < NMOV; c++)
  CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);
const cBeam = CV.findIndex(v => v[0] === 2 && v[1] === 0 && v[2] === 0);
const BX = ((4 + CY + CZ) & 1) === 0 ? 4 : 5;
const EVN = ['park', 'bind', 'emit', 'qcap', 'drain', 'peject', 'reflect'];
const ev = () => EVN.map((_, k) => wasm._meso3i_ev(k));
const totals = () => { wasm._meso3i_rg_refresh();
  return `rest=${wasm._meso3i_rest_mass()} flux=${wasm._meso3i_mov_mass()}`; };

const seedLump = () => {
  for (let dz = -5; dz <= 5; dz++)
  for (let dy = -5; dy <= 5; dy++)
  for (let dx = -5; dx <= 5; dx++) {
    if (dx*dx + dy*dy + dz*dz > 25) continue;
    const x = CX+dx, y = CY+dy, z = CZ+dz;
    if (((x+y+z)&1) !== 0 || x<0||x>=W||y<0||y>=H||z<0||z>=D) continue;
    wasm._meso3i_set(x, y, z, REST, 96);
  }
};
const drive = () => {
  for (let c = 0; c < NMOV; c++) {
    const [vx, vy, vz] = CV[c];
    wasm._meso3i_set(CX - 3*vx, CY - 3*vy, CZ - 3*vz, c,
      wasm._meso3i_get(CX - 3*vx, CY - 3*vy, CZ - 3*vz, c) + 4);
  }
};
// radial rest-mass profile: shell sums at Chebyshev radius r around (CX,CY,CZ)
const radial = () => {
  const out = [];
  for (let r = 0; r <= 7; r++) {
    let sum = 0;
    for (let dz = -r; dz <= r; dz++)
    for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) !== r) continue;
      const x = CX+dx, y = CY+dy, z = CZ+dz;
      if (((x+y+z)&1) !== 0 || x<0||x>=W||y<0||y>=H||z<0||z>=D) continue;
      sum += wasm._meso3i_get(x, y, z, REST);
    }
    out.push(sum);
  }
  return out.map(v => String(v).padStart(5)).join(' ');
};
const cmx = () => (wasm._meso3i_cm(0) / 256).toFixed(2);
const setFlags = ({ fric = 8, p8, curve, refl }) => {
  wasm._meso3i_friction(fric);
  if (p8 !== undefined) wasm._meso3i_fricp(p8);
  if (curve !== undefined) wasm._meso3i_friccurve(curve);
  wasm._meso3i_reflect(refl ?? 0);
};

// ---------- A. Universality: driven-ember attractor vs capture rule ----------
console.log('=== A. Universality: flat p8 vs graded ramps (IFRIC=8, fricmode=-4, reflect=0) ===');
const aVariants = [
  ['flat p=25%', { p8: 64, curve: 0 }],
  ['flat p=50%', { p8: 128, curve: 0 }],
  ['flat p=75%', { p8: 192, curve: 0 }],
  ['ramp cap->255', { curve: 1 }],
  ['ramp cap->2cap', { curve: 2 }],
];
for (const [name, cfg] of aVariants) {
  seedLump();
  wasm._meso3i_save();
  wasm._meso3i_collmode(0);
  wasm._meso3i_fricmode(-4);
  setFlags({ fric: 8, refl: 0, ...cfg });
  wasm._meso3i_ev_reset();
  wasm._meso3i_rg_refresh();
  const r0 = wasm._meso3i_rest_mass();
  for (let t = 0; t < 300; t++) { drive(); wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); }
  wasm._meso3i_rg_refresh();
  const rDriven = wasm._meso3i_rest_mass();
  const eDriven = ev();
  for (let t = 0; t < 200; t++) { wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); }
  wasm._meso3i_rg_refresh();
  const rEnd = wasm._meso3i_rest_mass();
  const eEnd = ev();
  console.log(`  ${name.padEnd(15)} driven rest ${r0}->${rDriven}  cutoff->${rEnd}` +
    `  | park=${eEnd[0]-eDriven[0]} bind=${eEnd[1]-eDriven[1]} emit=${eEnd[2]-eDriven[2]}` +
    ` qcap=${eEnd[3]-eDriven[3]} drain=${eEnd[4]-eDriven[4]} flux=${wasm._meso3i_mov_mass()}`);
  wasm._meso3i_friction(0); wasm._meso3i_reflect(0); wasm._meso3i_fricp(128); wasm._meso3i_friccurve(0);
}

// ---------- B. Core-and-skin: IREFL series on the same driven lump ----------
console.log('\n=== B. Core-and-skin: IFRIC=8 + IREFL {0,16,32,64}, radial rest profile ===');
console.log('  shell sums r0..r7 (rest quanta per Chebyshev shell):');
for (const refl of [0, 16, 32, 64]) {
  seedLump();
  wasm._meso3i_save();
  wasm._meso3i_collmode(0);
  wasm._meso3i_fricmode(-4);
  setFlags({ fric: 8, p8: 128, curve: 0, refl });
  wasm._meso3i_ev_reset();
  wasm._meso3i_rg_refresh();
  for (let t = 0; t < 300; t++) { drive(); wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); }
  wasm._meso3i_rg_refresh();
  const e = ev();
  console.log(`  IREFL=${String(refl).padStart(3)}: ${radial()}` +
    `  | park=${e[0]} reflect=${e[6]} ${totals()}`);
  wasm._meso3i_friction(0); wasm._meso3i_reflect(0);
}

// ---------- C. Ablation drift vs IREFL (M36 replay protocol) ----------
// Canonical geometry (src/test_replay.c): the 18-spoke drive GROWS the ember
// (t<200), carrier-gated quiet FREEZES it (200-600), then +x-only spoke
// injection is the carrier beam (t>=600). Drift = rest-centroid x; M36's
// baseline is ~-0.33 cells toward the source over 600t on the 44^3 Ember.
console.log('\n=== C. M36 replay: grow(200) -> freeze(400) -> beam(600), IREFL {0,32,64} ===');
{
  const W3 = 44, H3 = 44, D3 = 44, C3X = 22, C3Y = 22, C3Z = 22;
  const spoke = (c, sign) => {
    const [vx, vy, vz] = CV[c];
    if (sign && vx * sign <= 0) return;      // beam phase: +x (or -x) only
    const sx = C3X - 3 * vx, sy = C3Y - 3 * vy, sz = C3Z - 3 * vz;
    for (let u = 0; u < 4; u++)
      wasm._meso3i_set(sx, sy, sz, c, wasm._meso3i_get(sx, sy, sz, c) + 1);
  };
  const cmx3 = () => (wasm._meso3i_cm(0) / 256).toFixed(3);
  for (const [refl, sign] of [[0, 1], [32, 1], [64, 1], [0, -1], [32, -1]]) {
    wasm._meso3i_init(W3, H3, D3, 1);
    wasm._meso3i_collmode(0);
    wasm._meso3i_fricmode(-4);
    setFlags({ fric: 8, p8: 128, curve: 0, refl });
    wasm._meso3i_ev_reset();
    for (let t = 0; t < 1200; t++) {
      for (let c = 0; c < NMOV; c++) {
        if (t < 200) spoke(c, 0);                        // drive: all 18 spokes
        else if (t >= 600) spoke(c, sign);               // beam: one sign only
      }                                                  // 200-600: quiet freeze
      wasm._meso3i_drain_edge(3);
      wasm._meso3i_tick();
      if (t % 200 === 199) {
        wasm._meso3i_rg_refresh();
        console.log(`  IREFL=${String(refl).padStart(3)} ${sign > 0 ? '+x' : '-x'} t=${String(t + 1).padStart(4)}:` +
          ` cm_x=${cmx3()} rest=${wasm._meso3i_rest_mass()} flux=${wasm._meso3i_mov_mass()}` +
          ` reflect=${wasm._meso3i_ev(6)}`);
      }
    }
    wasm._meso3i_friction(0); wasm._meso3i_reflect(0);
  }
}
console.log('\ndone.');
