// m26disp — dispersion: does front speed depend on packet energy (nu)?
// A causal substrate should be nu-independent — v=1 hop/tick for all.
import { loadM26, each3 } from '../lib/m26.mjs';
const TICKS = 8;
const q = await loadM26();
const N = 32, c0 = N >> 1;
console.log('nu   | advance | v/c');
for (const nu of [1, 8, 32, 64, 128, 255]) {
  q._moore26_init(N, N, N);
  q._moore26_packet_set(c0 - 6, c0 - 6, c0, 6, 50);
  q._moore26_packet_nu_set(c0 - 6, c0 - 6, c0, 6, nu);
  const front = () => {
    let best = -99;
    each3(N, (x, y, z) => {
      if (Number(q._moore26_packet_get(x, y, z, 6)) > 0) {
        const p = x + y;
        if (p > best) best = p;
      }
    });
    return best;
  };
  const p0 = front();
  for (let t = 0; t < TICKS; t++) q._moore26_tick();
  const hops = (front() - p0) / 2;
  console.log(`${String(nu).padStart(3)}  | ${String((front() - p0)).padStart(3)} proj | ${(hops / TICKS).toFixed(2)}`);
}
