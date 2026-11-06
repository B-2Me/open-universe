// m26inversion — species-inverse balance: mass:bond equilibrium.
// Single wound cells at swept mass levels; crossover = setpoint.
import { loadM26, each3 } from '../lib/m26.mjs';
const q = await loadM26();
const N = 32, c0 = N >> 1;
const masses = [0, 64, 128, 256, 512, 1024, 2048];
const xs = [4, 8, 12, 16, 20, 24, 28];
console.log('mass0 | mass@100t | committed | ratio');
for (let i = 0; i < masses.length; i++) {
  q._moore26_init(N, N, N);
  const x = xs[i];
  for (let e = 0; e < 13; e++) {
    q._moore26_winding_set(x, c0, c0, 2*e, 120);
    q._moore26_winding_set(x, c0, c0, 2*e+1, 120);
  }
  if (masses[i]) q._moore26_mass_set(x, c0, c0, masses[i]);
  for (let t = 0; t < 100; t++) q._moore26_tick();
  let m = 0, w = 0;
  each3(N, (xx,yy,zz) => { m += Number(q._moore26_mass_get(xx,yy,zz)); for (let e=0;e<26;e++) w += Number(q._moore26_winding_get(xx,yy,zz,e)); });
  console.log(`${String(masses[i]).padStart(5)} | ${String(m).padStart(9)} | ${String(w).padStart(9)} | ${w?(m/w).toFixed(3):'-'}`);
}
