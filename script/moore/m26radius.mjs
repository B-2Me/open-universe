// m26radius — bound-state scaling: seed wound knots at different
// commitment volumes, let them relax, measure RMS radius of bound
// structure (winding-dense cells) vs total committed volume.
// Scaling hypothesis: R ~ vol^(1/3) if the knot is a 3D bound state.
import { loadM26, each3 } from '../lib/m26.mjs';
const q = await loadM26();
const N = 32, c0 = N >> 1;
const bound = (x, y, z) => {
  let v = 0;
  for (let e = 0; e < 13; e++) {
    const a = Number(q._moore26_winding_get(x, y, z, 2*e));
    const b = Number(q._moore26_winding_get(x, y, z, 2*e + 1));
    v += Math.min(a, b);
  }
  return v;  // committed volume at site
};
for (const comm of [64, 128, 192, 255]) {
  q._moore26_init(N, N, N);
  for (let dz = -4; dz <= 4; dz++) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    if (dx*dx + dy*dy + dz*dz > 16) continue;
    const x = c0 + dx, y = c0 + dy, z = c0 + dz;
    for (let e = 0; e < 13; e++) {
      q._moore26_winding_set(x, y, z, 2*e, comm);
      q._moore26_winding_set(x, y, z, 2*e + 1, comm);
    }
  }
  for (let t = 0; t < 40; t++) q._moore26_tick();
  // RMS radius of bound volume
  let tot = 0, num = 0;
  each3(N, (x, y, z) => {
    const v = bound(x, y, z);
    if (v >= 32) {
      tot += v;
      const dx = x - c0, dy = y - c0, dz = z - c0;
      num += v * (dx*dx + dy*dy + dz*dz);
    }
  });
  const rms = tot ? Math.sqrt(num / tot) : 0;
  // naive radius if volume were a uniform ball: R3 = (3V/4pi)^(1/3)
  const naive = Math.cbrt(tot / 13 / 4.18879);   // per-edge volume
  console.log(`comm=${String(comm).padStart(3)} committed=${tot} rmsR=${rms.toFixed(2)} naiveR=${naive.toFixed(2)} rms/naive=${(rms/naive).toFixed(2)}`);
}
