// m26speed — front velocity on transport edge channels (6..17).
// Packet advances 1 hop/tick along its edge vector. v/c = hops per tick.
// DIMS MUST BE POW2 — masked wrap corrupts non-pow2 grids.
import { loadM26, each3 } from '../lib/m26.mjs';
const VEC = [
  [1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],
  [1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],
  [1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1],
  [1,1,1],[-1,-1,-1],[1,1,-1],[-1,-1,1],[1,-1,1],[-1,1,-1],[1,-1,-1],[-1,1,1]];
const TICKS = 8;
const q = await loadM26();
const N = 32, c0 = N >> 1;
console.log('chan   vec         advance/8t   v/c');
for (const ch of [6, 8, 10, 14, 16, 7]) {
  const v = VEC[ch];
  q._moore26_init(N, N, N);
  const sx = c0 - v[0]*6, sy = c0 - v[1]*6, sz = c0 - v[2]*6;
  q._moore26_packet_set(sx, sy, sz, ch, 50);
  q._moore26_packet_nu_set(sx, sy, sz, ch, 200);
  const front = () => {
    let best = -99;
    each3(N, (x, y, z) => {
      if (Number(q._moore26_packet_get(x, y, z, ch)) > 0) {
        const prog = x*v[0] + y*v[1] + z*v[2];  // projection along flight dir
        if (prog > best) best = prog;
      }
    });
    return best;
  };
  const p0 = front();
  for (let t = 0; t < TICKS; t++) q._moore26_tick();
  const adv = front() - p0;
  // each hop projects 2 onto the unit-ish dir (|v|^2=2): hops = adv/2
  const hops = adv / 2;
  console.log(`ch${String(ch).padEnd(4)} (${v.join(',')})   ${String(adv).padStart(3)} proj   ${(hops / TICKS).toFixed(2)}`);
}
