// moveclock.mjs — does MOTION dilate the internal clock?
// Intrinsic-control design: two knots on ONE grid in ONE bath.
//   Knot M (mover):  dd-biased winding (w6=90,w7=30 -> dominant +dd
//                    channel) -> aligned emission -> recoil drift.
//   Knot P (parked): dd-balanced winding (w6=w7=60 -> no dominant
//                    channel) -> isotropic emission -> no net thrust.
// Same bath, same accretion statistics; translation is the variable.
//
// Clock observable: after the knots reach steady state, reset every
// phase register in their regions to 0 and measure the WIND-UP rate
// (dphi/dt over the first ~40 ticks before the dome re-saturates).
// Wind-up slope = local advance rate = the node's internal clock.
// Prediction (headroom driver): M's shell does more work -> slower
// wind-up than P's shell; interiors (shielded, idle) match.
import { loadM26, rng } from '../lib/m26.mjs';

const N = 64, WARM = 600, RESET_AT = 600, PROBE = 96;
const ADV = 8, CAP = 6, BATH = 0.02;

const q = await loadM26();
q._moore26_init(N, N, N);
q._moore26_evap_shift_set(4);
q._moore26_phase_adv_set(ADV);
q._moore26_work_cap_set(CAP);

const OFF = { incip: 156, phase: 432, txnWork: 444 };
const nodeSize = q._moore26_node_size();
const idx = (x, y, z) => (z * N * N + y * N + x);
const heap = () => new Uint8Array(q.wasmMemory.buffer, q._moore26_state_pointer(), nodeSize * N * N * N);

const CV = [,,,,,, [1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],[1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1]];

// two 3x3x3 knots: M dd-biased (moves), P balanced (parks)
const MC = [16, 32, 32], PC = [48, 32, 32];
const seed = (c, w6, w7) => {
  for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    q._moore26_winding_set(c[0] + dx, c[1] + dy, c[2] + dz, 6, w6);
    q._moore26_winding_set(c[0] + dx, c[1] + dy, c[2] + dz, 7, w7);
    q._moore26_mass_set(c[0] + dx, c[1] + dy, c[2] + dz, 10);
  }
};
seed(MC, 90, 30);   // dd = +60 -> aligned emission -> recoil
seed(PC, 60, 60);   // dd = 0   -> isotropic emission -> parks

const rnd = rng(42);
const bath = () => {
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) {
    if (x > 1 && x < N - 2 && y > 1 && y < N - 2 && z > 1 && z < N - 2) continue;
    for (let c = 6; c < 18; c++) {
      const nx = x + CV[c][0], ny = y + CV[c][1], nz = z + CV[c][2];
      if (nx < 0 || nx >= N || ny < 0 || ny >= N || nz < 0 || nz >= N) continue;
      if (rnd() / 0x7fffffff < BATH) { q._moore26_packet_set(x, y, z, c, 1); q._moore26_packet_nu_set(x, y, z, c, 96); }
    }
  }
};

// per-knot regions: core (3x3x3) + shell (5x5x5 - core)
const regions = (c) => {
  const core = [], shell = [];
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
    const x = c[0] + dx, y = c[1] + dy, z = c[2] + dz;
    if (((x + y + z) & 1) !== 0) continue;
    (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) <= 1 ? core : shell).push([x, y, z]);
  }
  return { core, shell };
};
const rm = regions(MC), rp = regions(PC);
const allSites = [...rm.core, ...rm.shell, ...rp.core, ...rp.shell];

const readPh = ([x, y, z]) => {
  const b = heap(), i = idx(x, y, z) * nodeSize;
  return (b[i + OFF.phase] | (b[i + OFF.phase + 1] << 8) | (b[i + OFF.phase + 2] << 16) | (b[i + OFF.phase + 3] << 24)) >>> 0;
};
const readWork = ([x, y, z]) => heap()[idx(x, y, z) * nodeSize + OFF.txnWork];

const wcent = (c, ax) => {
  let sw = 0, sm = 0;
  for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 4; dy++) for (let dz = -4; dz <= 4; dz++) {
    const x = c[0] + dx, y = c[1] + dy, z = c[2] + dz;
    if (x < 0 || x >= N || y < 0 || y >= N || z < 0 || z >= N) continue;
    for (let cc = 0; cc < 26; cc++) {
      const w = Number(q._moore26_winding_get(x, y, z, cc));
      if (w) { sw += w * ({ x, y, z })[ax]; sm += w; }
    }
  }
  return sm ? sw / sm : 0;
};

console.log(`moveclock: N=${N} adv=${ADV} cap=${CAP} bath=${BATH} warm=${WARM} probe=${PROBE}`);
console.log('knot M = dd-biased (mover), knot P = balanced (parked)');
for (let t = 0; t < WARM; t++) { bath(); q._moore26_tick(); }
console.log(`t=${WARM} M c=(${wcent(MC,'x').toFixed(2)},${wcent(MC,'y').toFixed(2)},${wcent(MC,'z').toFixed(2)}) P c=(${wcent(PC,'x').toFixed(2)},${wcent(PC,'y').toFixed(2)},${wcent(PC,'z').toFixed(2)})`);

// reset all phase in the probe regions -> measure wind-up
for (const [x, y, z] of allSites) q._moore26_phase_set(x, y, z, 0);
const phSum = new Map(allSites.map(s => [s, 0]));
const workSum = new Map(allSites.map(s => [s, 0]));
const phSeries = [];
for (let t = 0; t < PROBE; t++) {
  bath(); q._moore26_tick();
  const row = [];
  for (const s of allSites) { const p = readPh(s); phSum.set(s, phSum.get(s) + p); workSum.set(s, workSum.get(s) + readWork(s)); row.push(p); }
  phSeries.push(row);
}
// wind-up slope: mean phase per region averaged over the probe window
// (linear while unsaturated — report mean over t for comparability)
const avg = (sites) => {
  const i0 = allSites.indexOf(sites[0]);
  let m = 0, w = 0;
  for (const s of sites) { m += phSum.get(s) / PROBE; w += workSum.get(s) / PROBE; }
  return { ph: m / sites.length, work: w / sites.length };
};
const cm = avg(rm.core), sm = avg(rm.shell), cp = avg(rp.core), sp = avg(rp.shell);
console.log(`\nmean phase during wind-up (slope proxy):`);
console.log(`  M core=${cm.ph.toFixed(1)} shell=${sm.ph.toFixed(1)} | P core=${cp.ph.toFixed(1)} shell=${sp.ph.toFixed(1)}`);
console.log(`work/tick: M core=${cm.work.toFixed(2)} shell=${sm.work.toFixed(2)} | P core=${cp.work.toFixed(2)} shell=${sp.work.toFixed(2)}`);
console.log(`\nfinal centroids: M=(${wcent(MC,'x').toFixed(2)},${wcent(MC,'y').toFixed(2)},${wcent(MC,'z').toFixed(2)}) P=(${wcent(PC,'x').toFixed(2)},${wcent(PC,'y').toFixed(2)},${wcent(PC,'z').toFixed(2)})`);
