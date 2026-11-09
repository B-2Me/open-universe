// recoil.mjs — Newton III test: does emission recoil translate a knot?
// Seeds a wound knot (openbox geometry), lets it radiate under
// evap_shift, tracks the WINDING centroid (the structure's true
// position — ignores the expelled massFlight trail). FEED=0 runs
// unfed: the radiative recoil is the sole kinematic driver.
import { loadM26, ev, rng } from '../lib/m26.mjs';
const q = await loadM26();
const N = 32, FEED = +(process.env.FEED ?? 1), WARM = +(process.env.WARM ?? 0), BATH = +(process.env.BATH ?? 0);
q._moore26_init(N, N, N); q._moore26_evap_shift_set(4);
const CV=[,,,,,,[1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],[1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1]];
for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
  q._moore26_winding_set(16 + dx, 16 + dy, 16 + dz, 6, 60);
  q._moore26_winding_set(16 + dx, 16 + dy, 16 + dz, 7, 60);
  q._moore26_mass_set(16 + dx, 16 + dy, 16 + dz, (FEED || BATH) ? 10 : 400);
}
const rnd = rng(42);   // seeded — reproducible runs
const drain = () => { for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) {
  if (x > 1 && x < N - 2 && y > 1 && y < N - 2 && z > 1 && z < N - 2) continue;
  for (let c = 0; c < 26; c++) { q._moore26_packet_set(x, y, z, c, 0); q._moore26_winding_set(x, y, z, c, 0); } } };
const spokes = [[6, -8, 0], [8, -8, 0], [10, 0, -8], [14, 0, -8]];
const feed = () => { for (const [c, ox, oz] of spokes) {
  let sx = 16 - ox - CV[c][0], sy = 16 - oz - CV[c][1], sz = 16 - CV[c][2];
  if ((sx + sy + sz) & 1) sz++;
  q._moore26_packet_set(sx, sy, sz, c, 2); q._moore26_packet_nu_set(sx, sy, sz, c, 96); } };
// isotropic ambient bath: every boundary cell injects on every
// inward-pointing transport channel at equal rate — net-zero
// momentum baseline; any knot drift is pure emission recoil.
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
// winding centroid over the FULL grid — the structure's true
// position. (Boxed windows leak once the knot drifts past x=22.)
const wcent = (ax) => {
  let sw = 0, sm = 0;
  // knot window 6..26 — contains the knot + trail without the
  // bath's ambient accretion dominating the measure
  for (let x = 6; x <= 26; x++) for (let y = 6; y <= 26; y++) for (let z = 6; z <= 26; z++)
    for (let c = 0; c < 26; c++) {
      const w = Number(q._moore26_winding_get(x, y, z, c));
      if (w) { sw += w * ({ x, y, z })[ax]; sm += w; }
    }
  return sm ? sw / sm : 0;
};
const massOf = () => {
  let m = 0;
  for (let x = 6; x <= 26; x++) for (let y = 6; y <= 26; y++) for (let z = 6; z <= 26; z++)
    m += Number(q._moore26_mass_get(x, y, z));
  return m;
};
// net massFlight vector over all 6 axis pairs — the recoil axis is
// whichever dd channel dominates, not just the x pair
const flyVec = () => {
  let vx = 0, vy = 0, vz = 0;
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++)
    for (let c = 6; c < 18; c += 2) {
      const f = Number(q._moore26_massflight_get(x, y, z, c)) - Number(q._moore26_massflight_get(x, y, z, c + 1));
      vx += f * CV[c][0]; vy += f * CV[c][1]; vz += f * CV[c][2];
    }
  return [vx, vy, vz];
};
console.log(`FEED=${FEED} WARM=${WARM} BATH=${BATH} — t | mass | wcx | wcy | wcz | ev4 | ev43 | ev43/mass | flyVec`);
let prevEv = 0;
for (let t = 0; t <= 2000; t += 100) {
  const m = massOf(), e = ev(q, 43), rate = m ? ((e - prevEv) / m).toFixed(3) : '0';
  const fv = flyVec().map(v => v.toFixed(0)).join(',');
  console.log(`${t} ${m} ${wcent('x').toFixed(2)} ${wcent('y').toFixed(2)} ${wcent('z').toFixed(2)} ev4=${ev(q, 4)} ev43=${e} ${rate} fly=[${fv}]`);
  prevEv = e;
  for (let i = 0; i < 100; i++) { if (BATH) bath(); if (FEED || (WARM && t + i <= WARM)) feed(); q._moore26_tick(); drain(); }
}
