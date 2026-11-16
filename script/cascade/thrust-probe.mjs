/* thrust-probe — regression harness for the CascadeSimulator ⚡ kick.
 * Replicates the demo's exact code path: seed a wound lump, write
 * momentum[3] on a 3^3 block at its center (odd=3200 / even=400),
 * arm inertial drift (momentum_set=255), then verify the mass
 * centroid actually translates along the kick axis.
 *
 * Usage: node script/cascade/thrust-probe.mjs [--w=64] [--ticks=40]
 *        [--dir=1|-1] [--settle=10]
 * Verdict: PASS if centroid moves >0.5 cells along +kick axis.
 */
import { loadM26 } from '../lib/m26.mjs';
const arg = (k, d) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=')[1] : d; };
const q = await loadM26();

const W = parseInt(arg('w', '64')), TICKS = parseInt(arg('ticks', '40'));
const DIR = parseInt(arg('dir', '1')), SETTLE = parseInt(arg('settle', '10'));
const C = W >> 1;
q._moore26_init(W, W, W);

/* seedLump (mirrors docs/.vitepress/cascade/main.js):
 * R=3 ball, mass=256, wound edge pairs e=3..5 (channels 6..11), w=96 */
const R = 3, LM = 256, LW = 96;
let n = 0;
for (let dz = -R; dz <= R; dz++) for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
  if (dx * dx + dy * dy + dz * dz > R * R) continue;
  q._moore26_mass_set(C + dx, C + dy, C + dz, LM);
  for (let e = 3; e < 6; e++) {
    q._moore26_winding_set(C + dx, C + dy, C + dz, 2 * e, LW);
    q._moore26_winding_set(C + dx, C + dy, C + dz, 2 * e + 1, LW);
  }
  n++;
}
console.log(`lump seeded: ${n} sites (mirrors demo seedLump)`);

const centroidX = () => {
  let num = 0, den = 0;
  for (let z = 0; z < W; z++) for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const m = q._moore26_mass_get(x, y, z); num += x * m; den += m;
  }
  return den > 0 ? { cx: num / den, mass: den } : { cx: -1, mass: 0 };
};

for (let t = 0; t < SETTLE; t++) q._moore26_tick();
const before = centroidX();
console.log(`pre-kick:  cx=${before.cx.toFixed(2)} mass=${before.mass}`);

/* EXACT demo kick (main.js fireInject, ui.thrustArm branch) */
for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
  const kx = C + dx, ky = C + dy, kz = C + dz;
  const odd = ((kx + ky + kz) & 1) !== 0;
  q._moore26_momentum_at_set(kx, ky, kz, 3, (odd ? 3200 : 400) * DIR);
}
q._moore26_momentum_set(255);

for (let t = 1; t <= TICKS; t++) {
  q._moore26_tick();
  if (t % 10 === 0) {
    const c = centroidX();
    console.log(`t=${String(t).padStart(3)}   cx=${c.cx.toFixed(2)} mass=${c.mass}  dx=${((c.cx - before.cx) * DIR).toFixed(2)}`);
  }
}
const after = centroidX();
const dx = (after.cx - before.cx) * DIR;
console.log(`VERDICT: ${dx > 0.5 ? 'PASS — lump translated ' + dx.toFixed(2) + ' cells' : 'FAIL — no translation (' + dx.toFixed(2) + ')'}`);
process.exit(dx > 0.5 ? 0 : 1);
