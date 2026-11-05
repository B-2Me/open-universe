// m26fuse — moore26 port of qi3fuse: head-on packets fuse into a mass pair.
// Only EDGE channels 6..17 transport (FCC sublattice). Edge pair = c / c^1.
// ch6=(1,1,0), ch7=(-1,-1,0). nu_a+nu_b >= 256 triggers pair production.
import { loadM26, ev } from '../lib/m26.mjs';
const q = await loadM26();
const N = 32, c0 = N >> 1;
q._moore26_init(N, N, N);
// counter-propagating along the xy-diagonal, converging at (16,16,16)
q._moore26_packet_set(14, 14, 16, 6, 100); q._moore26_packet_nu_set(14, 14, 16, 6, 200);
q._moore26_packet_set(18, 18, 16, 7, 100); q._moore26_packet_nu_set(18, 18, 16, 7, 200);
for (let t = 0; t < 4; t++) q._moore26_tick();
let m = 0, ch = 0, w = 0, mf = 0;
for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  m += Number(q._moore26_mass_get(x, y, z));
  ch += Number(q._moore26_charge_get(x, y, z));
  for (let e = 0; e < 26; e++) w += Number(q._moore26_winding_get(x, y, z, e));
  for (let e = 0; e < 26; e++) mf += Number(q._moore26_massflight_get(x, y, z, e));
}
console.log(`fusion: mass=${m} charge=${ch} winding=${w} massFlight=${mf}`);
console.log(`fusion events (ev23): ${ev(q, 23)}`);
