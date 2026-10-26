// clock-lag (E2): the lag-vs-density transfer function f(rho).
// A corridor of seeded rest density q blocks x in [X0,X1); a +x pulse is
// timed from launch to first-arrival at X2. v_eff(rho) = the drag a
// bound clock's internal carriers feel inside congested space.
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

const W = 72, H = 24, D = 24;
const CY = H >> 1, CZ = D >> 1;
const X0 = 14, X1 = 52, X2 = 60;          // corridor + detector plane
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
let XPX = -1;                             // +x axial channel
for (let c = 0; c < NMOV; c++) {
  const v = [wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)];
  if (v[0] > 0 && v[1] === 0 && v[2] === 0) XPX = c;
}

const boot = () => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0);
  wasm._meso3i_friction(8);
  wasm._meso3i_fricmode(-4);
  wasm._meso3i_drest(0);
  wasm._meso3i_fricp(0);        // no capture — pure transit drag, else
                                // the corridor eats the pulse (q>=8 = NaN)
  wasm._meso3i_friccurve(0);
  wasm._meso3i_reflect(0);
};

const seedCorridor = q => {
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = X0; x < X1; x++) {
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, REST, q);
  }
};

// bulk-mass arrival: mov in the 4-plane detector zone — a statistical
// threshold, not a single-particle trigger (coarse-grained observable)
const movZone = () => {
  let m = 0;
  for (let x = X2 - 3; x <= X2; x++) for (let z = 0; z < D; z++) for (let y = 0; y < H; y++)
    if (!((x + y + z) & 1))
      for (let c = 0; c < NMOV; c++) m += wasm._meso3i_get(x, y, z, c);
  return m;
};

const run = q => {
  boot();
  seedCorridor(q);
  for (let t = 0; t < 40; t++) { wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); } // settle
  // fire: +x pulse at x=8..10 around the center
  let m0 = 0;
  for (const x of [8, 10]) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
    const px = x, py = CY + dy, pz = CZ + dz;
    if ((px + py + pz) & 1) continue;
    wasm._meso3i_set(px, py, pz, XPX, 64); m0 += 64;
  }
  const thresh = Math.max(4, m0 * 0.25);
  let tHit = -1;
  for (let t = 0; t < 400; t++) {
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    if (tHit < 0 && movZone() >= thresh) tHit = t;
    if (tHit > 0 && t > tHit + 20) break;
  }
  const dist = X2 - 10, v = tHit > 0 ? dist / tHit : NaN;
  return { q, tHit, v };
};

console.log('E2 — lag vs density: +x pulse transit through rest corridor');
console.log('q/site   t_arrive   v_eff (cells/tick)');
for (const q of [0, 8, 16, 32, 48, 64, 96]) {
  const r = run(q);
  console.log(`${String(r.q).padStart(4)}  ${String(r.tHit).padStart(7)}   ${r.v.toFixed(3)}`);
}
