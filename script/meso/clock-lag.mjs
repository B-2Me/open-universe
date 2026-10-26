// clock-lag (E2): the lag-vs-density transfer function f(rho).
// A corridor of seeded rest density density blocks x in [X0,X1); a +x pulse is
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

const gridW = 72, gridH = 24, gridD = 24;
const centerY = gridH >> 1, centerZ = gridD >> 1;
const X0 = 14, X1 = 52, X2 = 60;          // corridor + detector plane
if (wasm._meso3i_init(gridW, gridH, gridD, 1) !== 0) throw new Error('init failed');
const nChannels = wasm._meso3i_nch(), nMoving = nChannels - 1, restCh = nChannels - 1;
let chPX = -1;                             // +x axial channel
for (let ch = 0; ch < nMoving; ch++) {
  const dir = [wasm._meso3i_cvc(ch, 0), wasm._meso3i_cvc(ch, 1), wasm._meso3i_cvc(ch, 2)];
  if (dir[0] > 0 && dir[1] === 0 && dir[2] === 0) chPX = ch;
}

const resetEngine = () => {
  wasm._meso3i_init(gridW, gridH, gridD, 1);
  wasm._meso3i_collmode(0);
  wasm._meso3i_friction(8);
  wasm._meso3i_fricmode(-4);
  wasm._meso3i_drest(0);
  wasm._meso3i_fricp(0);        // no capture — pure transit drag, else
                                // the corridor eats the pulse (density>=8 = NaN)
  wasm._meso3i_friccurve(0);
  wasm._meso3i_reflect(0);
};

const seedCorridor = density => {
  for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++) for (let x = X0; x < X1; x++) {
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, restCh, density);
  }
};

// bulk-mass arrival: moving in the 4-plane detector zone — a statistical
// threshold, not a single-particle trigger (coarse-grained observable)
const zoneFlux = () => {
  let mass = 0;
  for (let x = X2 - 3; x <= X2; x++) for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++)
    if (!((x + y + z) & 1))
      for (let ch = 0; ch < nMoving; ch++) mass += wasm._meso3i_get(x, y, z, ch);
  return mass;
};

const run = density => {
  resetEngine();
  seedCorridor(density);
  for (let t = 0; t < 40; t++) { wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); } // settle
  // fire: +x pulse at x=8..10 around the center
  let injectedMass = 0;
  for (const x of [8, 10]) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
    const px = x, py = centerY + dy, pz = centerZ + dz;
    if ((px + py + pz) & 1) continue;
    wasm._meso3i_set(px, py, pz, chPX, 64); injectedMass += 64;
  }
  const thresh = Math.max(4, injectedMass * 0.25);
  let tArrived = -1;
  for (let t = 0; t < 400; t++) {
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    if (tArrived < 0 && zoneFlux() >= thresh) tArrived = t;
    if (tArrived > 0 && t > tArrived + 20) break;
  }
  const dist = X2 - 10, vEff = tArrived > 0 ? dist / tArrived : NaN;
  return { density, tArrived, vEff };
};

console.log('E2 — lag vs density: +x pulse transit through rest corridor');
console.log('density/site   t_arrive   v_eff (cells/tick)');
for (const density of [0, 8, 16, 32, 48, 64, 96]) {
  const r = run(density);
  console.log(`${String(r.density).padStart(4)}  ${String(r.tArrived).padStart(7)}   ${r.vEff.toFixed(3)}`);
}
