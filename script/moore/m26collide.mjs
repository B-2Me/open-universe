// m26collide — bare-junction e+e- -> gamma gamma collider.
// Opposing massFlight slugs annihilate at the meeting node ->
// back-to-back packet jets (the Phase-1b annihilation path).
import { loadM26, ev, each3 } from '../lib/m26.mjs';
const q = await loadM26();
const N = 32, c0 = N >> 1;
q._moore26_init(N, N, N);
// ch6=(1,1,0) at (c0-4,c0-4,c0), ch7=(-1,-1,0) at (c0+4,c0+4,c0)
q._moore26_massflight_set(c0-4, c0-4, c0, 6, 300);
q._moore26_massflight_set(c0+4, c0+4, c0, 7, 300);
for (let t = 0; t < 10; t++) q._moore26_tick();
let pk = 0, mass = 0, heat = 0; const jets = [];
each3(N, (x, y, z) => {
  heat += Number(q._moore26_heat_get(x, y, z));
  mass += Number(q._moore26_mass_get(x, y, z));
  for (let c = 6; c < 18; c++) {
    const p = Number(q._moore26_packet_get(x, y, z, c));
    if (p) { pk += p; jets.push(`(${x},${y},${z})ch${c}=${p}`); }
  }
});
console.log(`packets=${pk} mass=${mass} heat=${heat}`);
console.log(jets.join(' '));
