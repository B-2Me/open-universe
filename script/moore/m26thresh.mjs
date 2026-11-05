// m26thresh — fusion-wall scan: head-on edge packets at varying
// nu_a+nu_b. Wall should sit at 256. Above: ev23 fires, mass mints
// (dep = pair*(nuA+nuB), mass += dep>>5 per node).
import { loadM26, ev } from '../lib/m26.mjs';
const q = await loadM26();
const N = 32;
const totMass = () => {
  let m = 0;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
    m += Number(q._moore26_mass_get(x, y, z));
  return m;
};
console.log('nuA+nuB | fuse23 | mass  | mass/quantum');
for (const [a, b] of [[100,100],[120,120],[128,128],[130,130],[150,150],[200,200],[255,255]]) {
  q._moore26_init(N, N, N);
  q._moore26_packet_set(14, 14, 16, 6, 10); q._moore26_packet_nu_set(14, 14, 16, 6, a);
  q._moore26_packet_set(18, 18, 16, 7, 10); q._moore26_packet_nu_set(18, 18, 16, 7, b);
  for (let t = 0; t < 5; t++) q._moore26_tick();
  const m = totMass();
  console.log(`${String(a + b).padStart(5)}   | ${String(ev(q, 23)).padStart(6)} | ${String(m).padStart(5)} | ${m ? (m / Math.max(1, ev(q,23))).toFixed(1) : '-'}`);
}
