// m26crawl — mass-launch velocity vs circulation asymmetry:
// dominant-edge imbalance dd = winding[+x]-winding[-x] at the core.
// Ratio: v_crawl/c vs dd — linear? threshold? saturation?
import { loadM26, each3 } from '../lib/m26.mjs';
const q = await loadM26();
const N = 32, c0 = N >> 1, TICKS = 150;
const centroidX = () => {
  let num = 0, den = 0;
  each3(N, (x, y, z) => {
    const m = Number(q._moore26_mass_get(x, y, z));
    num += x * m; den += m;
  });
  return den > 0 ? num / den : -1;
};
console.log('dd   | v_crawl (cells/150t) | v/c');
for (const dd of [0, 32, 64, 96, 128]) {
  q._moore26_init(N, N, N);
  // wound ball, same as smoke
  for (let dz = -4; dz <= 4; dz++) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    if (dx*dx + dy*dy + dz*dz > 16) continue;
    const x = c0 + dx, y = c0 + dy, z = c0 + dz;
    for (let e = 0; e < 13; e++) {
      q._moore26_winding_set(x, y, z, 2*e, 64);
      q._moore26_winding_set(x, y, z, 2*e + 1, 64);
    }
  }
  q._moore26_mass_set(c0, c0, c0, 256);
  // asymmetry on the +x/-x edge pair (e=0: channels 0,1 — face pair)
  q._moore26_winding_set(c0, c0, c0, 0, 64 + dd);
  q._moore26_winding_set(c0, c0, c0, 1, Math.max(0, 64 - dd));
  const x0 = centroidX();
  for (let t = 0; t < TICKS; t++) q._moore26_tick();
  const dx = centroidX() - x0;
  console.log(`${String(dd).padStart(3)}  | ${dx.toFixed(2).padStart(20)} | ${(dx / TICKS).toFixed(4)}`);
}
