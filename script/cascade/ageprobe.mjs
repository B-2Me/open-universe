// ageprobe.mjs — the knot's growth rings.
// bondTick (offset 448, u32) records each node's first successful
// confirm — its binding birthday. bondAge = t - bondTick is the
// volumetric "nestedness": seeded core = primordial (tick 0),
// accreting shell = young. A drifting knot should skew the age
// field along its velocity axis (old trailing edge, young leading).
import { loadM26 } from '../lib/m26.mjs';

const TICKS = parseInt((process.argv.find(a => a.startsWith('--ticks=')) || '--ticks=800').split('=')[1]);
const FEED = !process.argv.includes('--nofeed');
const BATH = parseFloat((process.argv.find(a => a.startsWith('--bath=')) || '--bath=0').split('=')[1]);
const q = await loadM26();
const N = 32;
q._moore26_init(N, N, N); q._moore26_evap_shift_set(4);

const OFF = { bondTick: 448, mass: 436, incip: 156 };
const nodeSize = q._moore26_node_size();
const idx = (x, y, z) => (z * N * N + y * N + x);
const heap = () => new Uint8Array(q.wasmMemory.buffer, q._moore26_state_pointer(), nodeSize * N * N * N);
const bondTick = (x, y, z) => {
  const b = heap(), i = idx(x, y, z) * nodeSize + OFF.bondTick;
  return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
};

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
// isotropic boundary bath — the dense-accretion regime (recoil.mjs
// pattern): every boundary cell injects inward on all 12 channels
// at rate BATH. Zero net momentum; pure ambient flux pressure.
let s = 42;
const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const bath = () => {
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) {
    if (x > 1 && x < N - 2 && y > 1 && y < N - 2 && z > 1 && z < N - 2) continue;
    for (let c = 6; c < 18; c++) {
      const nx = x + CV[c][0], ny = y + CV[c][1], nz = z + CV[c][2];
      if (nx < 0 || nx >= N || ny < 0 || ny >= N || nz < 0 || nz >= N) continue;
      if (rnd() < BATH) { q._moore26_packet_set(x, y, z, c, 1); q._moore26_packet_nu_set(x, y, z, c, 96); }
    }
  }
};
const drain = () => { for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) {
  if (x > 1 && x < N - 2 && y > 1 && y < N - 2 && z > 1 && z < N - 2) continue;
  for (let c = 0; c < 26; c++) { q._moore26_packet_set(x, y, z, c, 0); q._moore26_winding_set(x, y, z, c, 0); } } };

console.log(`ageprobe: ticks=${TICKS} feed=${FEED} bath=${BATH}`);
for (let t = 1; t <= TICKS; t++) { if (FEED) feed(); if (BATH) bath(); q._moore26_tick(); if (BATH) drain(); }

// age map: x-z slice at y=16, ages quantized into rings
console.log(`\nbondAge map at y=16 (t=${TICKS}) — digits = age/100, '.' = never bonded, ' ' = dead`);
for (let z = 12; z <= 20; z++) {
  let row = '';
  for (let x = 10; x <= 24; x++) {
    const bt = bondTick(x, 16, z);
    const m = q._moore26_mass_get(x, 16, z);
    if (!m && !bt) { row += ' '; continue; }
    if (!bt) { row += '.'; continue; }
    row += Math.min(9, Math.floor((TICKS - bt) / 100));
  }
  console.log(` z=${String(z).padStart(2)}  ${row}`);
}
// radial profile: mean age vs distance from knot center
const rings = new Map();
for (let x = 10; x <= 24; x++) for (let y = 12; y <= 20; y++) for (let z = 12; z <= 20; z++) {
  const bt = bondTick(x, y, z);
  if (!bt) continue;
  const r = Math.round(Math.hypot(x - 17, y - 16, z - 17));
  const a = rings.get(r) || { n: 0, s: 0 };
  a.n++; a.s += TICKS - bt; rings.set(r, a);
}
console.log('\nage by radius (ticks):');
for (const [r, a] of [...rings.entries()].sort((x, y) => x[0] - y[0]))
  console.log(`  r=${r}  nodes=${a.n}  meanAge=${(a.s / a.n).toFixed(0)}`);
