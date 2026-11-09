// recoil.mjs — Newton III test: does emission recoil translate a knot?
// Seeds a wound knot (openbox geometry), lets it radiate under
// evap_shift, tracks the mass centroid per 100 ticks. Drift along the
// axis opposite the dominant-dd emission = the radiative rocket.
import { loadM26, centroid, ev } from '../lib/m26.mjs';
const q = await loadM26();
const N = 32;
q._moore26_init(N, N, N); q._moore26_evap_shift_set(4);
const CV=[,,,,,,[1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],[1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1]];
for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
  q._moore26_winding_set(16 + dx, 16 + dy, 16 + dz, 6, 60);
  q._moore26_winding_set(16 + dx, 16 + dy, 16 + dz, 7, 60);
  q._moore26_mass_set(16 + dx, 16 + dy, 16 + dz, 10);
}
const drain = () => { for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) {
  if (x > 1 && x < N - 2 && y > 1 && y < N - 2 && z > 1 && z < N - 2) continue;
  for (let c = 0; c < 26; c++) { q._moore26_packet_set(x, y, z, c, 0); q._moore26_winding_set(x, y, z, c, 0); } } };
const spokes = [[6, -8, 0], [8, -8, 0], [10, 0, -8], [14, 0, -8]];
const feed = () => { for (const [c, ox, oz] of spokes) {
  let sx = 16 - ox - CV[c][0], sy = 16 - oz - CV[c][1], sz = 16 - CV[c][2];
  if ((sx + sy + sz) & 1) sz++;
  q._moore26_packet_set(sx, sy, sz, c, 2); q._moore26_packet_nu_set(sx, sy, sz, c, 96); } };
console.log('t | mass | cx | cy | cz | emit(ev4) | evap(ev43) | massflight x-sum');
const flyX = () => {
  let s = 0;
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++)
    s += Number(q._moore26_massflight_get(x, y, z, 6)) - Number(q._moore26_massflight_get(x, y, z, 7));
  return s;
};
const massOf = () => {
  let m = 0;
  for (let x = 10; x <= 22; x++) for (let y = 10; y <= 22; y++) for (let z = 10; z <= 22; z++)
    m += Number(q._moore26_mass_get(x, y, z));
  return m;
};
for (let t = 0; t <= 2000; t += 100) {
  console.log(`${t} ${massOf()} ${centroid(q, N, 'x').toFixed(2)} ${centroid(q, N, 'y').toFixed(2)} ${centroid(q, N, 'z').toFixed(2)} ev4=${ev(q, 4)} ev43=${ev(q, 43)} flyX=${flyX()}`);
  for (let i = 0; i < 100; i++) { feed(); q._moore26_tick(); drain(); }
}
