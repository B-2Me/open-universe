// m26speed — front velocity calibration on TRANSPORT edge channels.
// A seeded packet should advance its leading edge 1 hop/tick along its
// own direction vector. All 12 edges are equidistant (sqrt2) => isotropy.
import { loadM26, each3 } from '../lib/m26.mjs';
const VEC = [
  [1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],
  [1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],
  [1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1],
  [1,1,1],[-1,-1,-1],[1,1,-1],[-1,-1,1],[1,-1,1],[-1,1,-1],[1,-1,-1],[-1,1,1]];
const TICKS = 16;
const q = await loadM26();
const N = 40, c0 = N >> 1;
console.log('chan   vec        hops/16t  v(c)');
for (const ch of [6, 8, 10, 14, 16]) {   // a spread of the 12 edges
  const v = VEC[ch];
  q._moore26_init(N, N, N);
  // packet 4 hops back along -v (parity stays even)
  for (let i = 0; i < 5; i++)
    q._moore26_packet_set(c0 - v[0]*8 + v[0]*i, c0 - v[1]*8 + v[1]*i, c0 - v[2]*8 + v[2]*i, ch, 4),
    q._moore26_packet_nu_set(c0 - v[0]*8 + v[0]*i, c0 - v[1]*8 + v[1]*i, c0 - v[2]*8 + v[2]*i, ch, 150);
  const front = () => {
    let best = -1;
    each3(N, (x, y, z) => {
      if (Number(q._moore26_packet_get(x, y, z, ch)) > 0) {
        // progress along v: dot with v's axis-dominant component
        const prog = v[0] ? x * v[0] : v[1] ? y * v[1] : z * v[2];
        if (prog > best) best = prog;
      }
    });
    return best;
  };
  const p0 = front();
  for (let t = 0; t < TICKS; t++) q._moore26_tick();
  const hops = front() - p0;
  console.log(`ch${String(ch).padEnd(4)} (${v.join(',')})  ${String(Math.max(0, hops)).padStart(3)}     ${(Math.max(0, hops) / TICKS).toFixed(2)}`);
}
