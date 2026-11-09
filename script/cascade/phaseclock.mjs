// phaseclock.mjs — the authored clock's first measurement.
// With phase_adv enabled, each live node's phase advances by
// (13 - armed_incipients) * qPhaseAdv per tick, then the Phase-5
// Jacobi pull synchronizes the bound state. Predictions:
//   1. interior (quiet, armed~0) advances at max rate
//   2. surface (transaction-heavy) lags -> interior/surface gradient
//   3. Phase-5 pull locks the knot to a collective rate set by its
//      busiest members
// Telemetry: per-site phase + armed count over time; mean phase of
// the seeded 3x3x3 core vs the shell box; wrap-aware phase velocity.
import { loadM26 } from '../lib/m26.mjs';

const ADV = parseFloat((process.argv.find(a => a.startsWith('--adv=')) || '--adv=4').split('=')[1]);
const CAP = parseInt((process.argv.find(a => a.startsWith('--cap=')) || '--cap=32').split('=')[1]);
const WARM = parseInt((process.argv.find(a => a.startsWith('--warm=')) || '--warm=600').split('=')[1]);
const PROBE = parseInt((process.argv.find(a => a.startsWith('--probe=')) || '--probe=128').split('=')[1]);
const FEEDPROBE = process.argv.includes('--feedprobe');
const BATH = parseFloat((process.argv.find(a => a.startsWith('--bath=')) || '--bath=0').split('=')[1]);
const BNU = parseInt((process.argv.find(a => a.startsWith('--bnu=')) || '--bnu=8').split('=')[1]);
let s = 4242;
const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
// low-nu bath: offers stand OFF-SHELL (nu<line refuses confirm) and
// clog the 13-slot negotiation table — the congestion that should
// crush the headroom clock. Isotropic placement, no momentum bias.
const bath = () => {
  for (let k = 0; k < 16; k++) {
    // concentrate near the knot so the offers actually reach its table
    const x = 8 + ((rnd() * 17) | 0), y = 8 + ((rnd() * 17) | 0), z = 8 + ((rnd() * 17) | 0);
    if (((x + y + z) & 1) === 0 && rnd() < BATH) {
      const c = [6, 8, 10, 12, 14, 16][(rnd() * 6) | 0];
      q._moore26_packet_set(x, y, z, c, 1);
      q._moore26_packet_nu_set(x, y, z, c, BNU);
    }
  }
};

const q = await loadM26();
const N = 32;
q._moore26_init(N, N, N);
q._moore26_evap_shift_set(4);
q._moore26_phase_adv_set(ADV);
q._moore26_work_cap_set(CAP);

const OFF = { incip: 156, phase: 432, txnWork: 444 };
const nodeSize = q._moore26_node_size();
const idx = (x, y, z) => (z * N * N + y * N + x);
// state_pointer() is the grid_current base — refetch each tick
// (the double buffer swaps; a raw buffer view reads garbage)
const heap = () => new Uint8Array(q.wasmMemory.buffer, q._moore26_state_pointer(), nodeSize * N * N * N);

const CV = [,,,,,, [1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],[1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1]];
for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
  q._moore26_winding_set(16 + dx, 16 + dy, 16 + dz, 6, 60);
  q._moore26_winding_set(16 + dx, 16 + dy, 16 + dz, 7, 60);
  q._moore26_mass_set(16 + dx, 16 + dy, 16 + dz, 10);
}
const spokes = [[6, -8, 0], [8, -8, 0], [10, 0, -8], [14, 0, -8]];
const feed = () => { for (const [c, ox, oz] of spokes) {
  let sx = 16 - ox - CV[c][0], sy = 16 - oz - CV[c][1], sz = 16 - CV[c][2];
  if ((sx + sy + sz) & 1) sz++;
  q._moore26_packet_set(sx, sy, sz, c, 2); q._moore26_packet_nu_set(sx, sy, sz, c, 96); } };

// sites: interior 15..17^3 vs shell 13..19^3 minus interior
const inner = [], shell = [];
for (let x = 13; x <= 19; x++) for (let y = 13; y <= 19; y++) for (let z = 13; z <= 19; z++) {
  if (((x + y + z) & 1) !== 0) continue;
  (x >= 15 && x <= 17 && y >= 15 && y <= 17 && z >= 15 && z <= 17 ? inner : shell).push([x, y, z]);
}
const read = ([x, y, z]) => {
  const b = heap(), i = idx(x, y, z) * nodeSize;
  let armed = 0;
  for (let c = 0; c < 26; c++) armed += b[i + OFF.incip + c];
  const ph = (b[i + OFF.phase] | (b[i + OFF.phase + 1] << 8) | (b[i + OFF.phase + 2] << 16) | (b[i + OFF.phase + 3] << 24)) >>> 0;
  return { ph, armed, work: b[i + OFF.txnWork] };
};

console.log(`phaseclock: adv=${ADV} warm=${WARM} probe=${PROBE} feedprobe=${FEEDPROBE}`);
for (let t = 0; t < WARM; t++) { feed(); q._moore26_tick(); }

const dph = (a, b) => { let d = (b - a) & 511; return d > 256 ? d - 512 : d; };
// wrap counter: a large negative step = phase wound past 511 -> 0.
// wraps/100 ticks IS the internal frequency — the dilatable clock.
const prev = new Map(), wraps = new Map(), armedHist = new Map(), workHist = new Map();
const allSites = [...inner, ...shell];
for (const s of allSites) { prev.set(s, 0); wraps.set(s, 0); armedHist.set(s, 0); workHist.set(s, 0); }
for (let t = 0; t < PROBE; t++) {
  if (FEEDPROBE) feed();
  if (BATH) bath();
  q._moore26_tick();
  for (const s of allSites) {
    const { ph, armed, work } = read(s);
    if (dph(prev.get(s), ph) < -256) wraps.set(s, wraps.get(s) + 1);
    prev.set(s, ph);
    armedHist.set(s, armedHist.get(s) + armed);
    workHist.set(s, workHist.get(s) + work);
  }
}
const rate = (sites) => +(sites.reduce((a, s) => a + wraps.get(s), 0) / sites.length / (PROBE / 100)).toFixed(2);
const aarmed = (sites) => +(sites.reduce((a, s) => a + armedHist.get(s), 0) / sites.length / PROBE).toFixed(3);
const mphase = (sites) => +(sites.reduce((a, s) => a + prev.get(s), 0) / sites.length).toFixed(1);
const mwork = (sites) => +(sites.reduce((a, s) => a + workHist.get(s), 0) / sites.length / PROBE).toFixed(2);
console.log(`wraps/100t: inner=${rate(inner)} shell=${rate(shell)} | armed: inner=${aarmed(inner)} shell=${aarmed(shell)} | work/t: inner=${mwork(inner)} shell=${mwork(shell)} | meanPh: inner=${mphase(inner)} shell=${mphase(shell)}`);
// top workers by total txnWork — where the knot actually routes
const top = [...allSites].sort((a, b) => workHist.get(b) - workHist.get(a)).slice(0, 8);
for (const s of top) {
  console.log(`  (${s}) work=${(workHist.get(s) / PROBE).toFixed(2)}/t armed=${(armedHist.get(s) / PROBE).toFixed(3)} wraps=${wraps.get(s)}`);
}
