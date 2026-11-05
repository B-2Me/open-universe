// m26ledger — closed-box energy audit. Ledger channels:
//   packet energy (count*nu), winding deposits (armed packets),
//   heat (decay sink, ev7). Residual should close ~0.
import { loadM26, ev, each3 } from '../lib/m26.mjs';
const q = await loadM26();
const N = 32, c0 = N >> 1;
q._moore26_init(N, N, N);
for (let i = 0; i < 400; i++) {
  const x = c0 - 8 + (i % 16), y = c0 - 4 + ((i / 16) % 8), c = 6 + (i % 12);
  q._moore26_packet_set(x, y, c0, c, 3);
  q._moore26_packet_nu_set(x, y, c0, c, 128);
}
const counts = () => {
  let pk = 0, wind = 0, heat = 0, mass = 0;
  each3(N, (x, y, z) => {
    mass += Number(q._moore26_mass_get(x, y, z));
    heat += Number(q._moore26_heat_get(x, y, z));
    for (let c = 0; c < 26; c++) {
      pk += Number(q._moore26_packet_get(x, y, z, c));
      wind += Number(q._moore26_winding_get(x, y, z, c));
    }
  });
  return { pk, wind, heat, mass };
};
const s0 = counts(), d0 = ev(q, 7);
for (let t = 0; t < 20; t++) q._moore26_tick();
const s1 = counts(), d1 = ev(q, 7);
console.log(`        packets  winding  heat    mass`);
console.log(`t=0  ${String(s0.pk).padStart(7)} ${String(s0.wind).padStart(8)} ${String(s0.heat).padStart(8)} ${s0.mass}`);
console.log(`t=20 ${String(s1.pk).padStart(7)} ${String(s1.wind).padStart(8)} ${String(s1.heat).padStart(8)} ${s1.mass}`);
const pkLost = s0.pk - s1.pk;                    // quanta that left flight
console.log(`packets lost: ${pkLost}  (x nu=128 -> ${pkLost * 128} E if unchanged)`);
console.log(`winding gained: ${s1.wind - s0.wind}   (confirm deposits ~2xnu per armed packet)`);
console.log(`heat gained (field): ${s1.heat - s0.heat}   decayedE ledger: ${d1 - d0}`);
