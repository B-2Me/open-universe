// epochclock.mjs — does the knot's shell clock slow when it moves?
// Single-knot self-controlled design: one knot in a sustained
// isotropic bath (the proven drift regime: wcx +1.09/2000t).
// Every 200 ticks: reset all phase registers in the probe box to 0,
// measure the 40-tick phase WIND-UP slope per site -> local clock
// rate. Log per epoch: shell slope, knot velocity |dc|/t, mass,
// work/t. Then test: does slope anti-correlate with velocity?
// The knot is its own control — same bath, varying v and mass.
import { loadM26, rng } from '../lib/m26.mjs';

const N = 32, ADV = 8, CAP = 6, BATH = 0.02, EPOCH = 200, WINDUP = 40, EPOCHS = 9;

const q = await loadM26();
q._moore26_init(N, N, N);
q._moore26_evap_shift_set(4);
q._moore26_phase_adv_set(ADV);
q._moore26_work_cap_set(CAP);

const OFF = { phase: 432, txnWork: 444 };
const nodeSize = q._moore26_node_size();
const idx = (x, y, z) => (z * N * N + y * N + x);
const heap = () => new Uint8Array(q.wasmMemory.buffer, q._moore26_state_pointer(), nodeSize * N * N * N);

const CV = [,,,,,, [1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],[1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1]];
for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
  q._moore26_winding_set(16 + dx, 16 + dy, 16 + dz, 6, 60);
  q._moore26_winding_set(16 + dx, 16 + dy, 16 + dz, 7, 60);
  q._moore26_mass_set(16 + dx, 16 + dy, 16 + dz, 10);
}
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
const drain = () => { for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) {
  if (x > 1 && x < N - 2 && y > 1 && y < N - 2 && z > 1 && z < N - 2) continue;
  for (let c = 0; c < 26; c++) { q._moore26_packet_set(x, y, z, c, 0); q._moore26_winding_set(x, y, z, c, 0); } } };

// probe box: tracks the knot (recenters on the winding centroid)
const sites = (c) => {
  const s = [];
  for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) for (let dz = -3; dz <= 3; dz++) {
    const x = Math.round(c[0]) + dx, y = Math.round(c[1]) + dy, z = Math.round(c[2]) + dz;
    if (x < 2 || x >= N - 2 || y < 2 || y >= N - 2 || z < 2 || z >= N - 2) continue;
    if (((x + y + z) & 1) === 0) s.push([x, y, z]);
  }
  return s;
};
const wcent = () => {
  let sw = [0, 0, 0], sm = 0;
  for (let x = 6; x <= 26; x++) for (let y = 6; y <= 26; y++) for (let z = 6; z <= 26; z++)
    for (let c = 0; c < 26; c++) {
      const w = Number(q._moore26_winding_get(x, y, z, c));
      if (w) { sw[0] += w * x; sw[1] += w * y; sw[2] += w * z; sm += w; }
    }
  return sm ? sw.map(v => v / sm) : [16, 16, 16];
};
const massOf = () => {
  let m = 0;
  for (let x = 6; x <= 26; x++) for (let y = 6; y <= 26; y++) for (let z = 6; z <= 26; z++)
    m += Number(q._moore26_mass_get(x, y, z));
  return m;
};

console.log(`epochclock: adv=${ADV} cap=${CAP} bath=${BATH} epoch=${EPOCH} windup=${WINDUP} epochs=${EPOCHS}`);
console.log('epoch | dc(tick speed) | mass | shell windup slope | shell work/t | ev4');
let cPrev = wcent();
for (let e = 0; e < EPOCHS; e++) {
  // EPOCH ticks of free evolution
  for (let t = 0; t < EPOCH; t++) { bath(); q._moore26_tick(); drain(); }
  const cNow = wcent();
  const v = Math.hypot(cNow[0] - cPrev[0], cNow[1] - cPrev[1], cNow[2] - cPrev[2]) / EPOCH;
  // reset phase across the current knot's probe box, measure windup
  const ss = sites(cNow);
  for (const [x, y, z] of ss) q._moore26_phase_set(x, y, z, 0);
  let phSum = 0, workSum = 0;
  for (let t = 0; t < WINDUP; t++) {
    bath(); q._moore26_tick(); drain();
    for (const s of ss) {
      const b = heap(), i = idx(s[0], s[1], s[2]) * nodeSize;
      phSum += (b[i + OFF.phase] | (b[i + OFF.phase + 1] << 8) | (b[i + OFF.phase + 2] << 16) | (b[i + OFF.phase + 3] << 24)) >>> 0;
      workSum += b[i + OFF.txnWork];
    }
  }
  const slope = phSum / (ss.length * WINDUP);   // mean phase during windup
  const work = workSum / (ss.length * WINDUP);
  const c2 = wcent();
  console.log(`${e} | v=${v.toFixed(4)} | mass=${massOf()} | slope=${slope.toFixed(1)} | work=${work.toFixed(3)} | ev4=${q._moore26_events(4)} | c=(${c2.map(v => v.toFixed(1))})`);
  cPrev = c2;
}
