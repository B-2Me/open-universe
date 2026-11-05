// m26spec — emitted spectrum vs structure: geo_gap says emitted nu =
// (weakest committed edge >>2)*2/L^2. Seed knots at varying weakest
// edge commitments, catch emitted packets, read nu from the raw blob
// (photonNu base=130+ch within the 392-byte NodeState).
import { loadM26, each3 } from '../lib/m26.mjs';
const q = await loadM26();
const N = 32, c0 = N >> 1;
const PTR = () => Number(q._moore26_state_pointer());
const SZ = 392, NU_OFF = 130;
const nuAt = (x, y, z, c) => q.HEAPU8[PTR() + (z*N*N + y*N + x)*SZ + NU_OFF + c];

for (const weak of [64, 96, 128, 160]) {
  q._moore26_init(N, N, N);
  // knot: all 13 edges at 200 committed EXCEPT the weakest edge at `weak`
  for (let dz = -2; dz <= 2; dz++) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (dx*dx + dy*dy + dz*dz > 4) continue;
    const x = c0 + dx, y = c0 + dy, z = c0 + dz;
    for (let e = 0; e < 13; e++) {
      const v = e === 0 ? weak : 200;
      q._moore26_winding_set(x, y, z, 2*e, v);
      q._moore26_winding_set(x, y, z, 2*e + 1, v);
    }
  }
  const hist = {};
  for (let t = 0; t < 60; t++) {
    q._moore26_tick();
    each3(N, (x, y, z) => {
      const dx = x - c0, dy = y - c0, dz = z - c0;
      if (dx*dx + dy*dy + dz*dz <= 16) return;    // inside seed ball
      for (let c = 6; c < 18; c++) {
        if (Number(q._moore26_packet_get(x, y, z, c)) > 0) {
          const nu = nuAt(x, y, z, c);
          hist[nu] = (hist[nu] || 0) + 1;
        }
      }
    });
  }
  const top = Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 5);
  // predicted: geo_gap = (weak>>2)*2/2 = weak>>2 (edge L^2=2)
  console.log(`weak=${String(weak).padStart(3)} pred-nu=${weak >> 2} | emitted nu hist: ${JSON.stringify(Object.fromEntries(top))}`);
}
