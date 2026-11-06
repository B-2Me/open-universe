// m26nucleon — nucleon-scale calibration:
//  A) equilibrium knot diameter vs committed volume (target: ~10 nodes)
//  B) terminal velocity of a knot under a directional packet push
//  C) two-knot proximity: do adjacent knots bridge, bind, or repel?
import { loadM26, each3 } from '../lib/m26.mjs';
const q = await loadM26();
const N = 32, c0 = N >> 1;

const seedKnot = (cx, cy, cz, r, comm) => {
  for (let dz = -r; dz <= r; dz++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx*dx + dy*dy + dz*dz > r*r) continue;
    const x = cx + dx, y = cy + dy, z = cz + dz;
    for (let e = 0; e < 13; e++) {
      q._moore26_winding_set(x, y, z, 2*e, comm);
      q._moore26_winding_set(x, y, z, 2*e + 1, comm);
    }
  }
};
const bound = (x, y, z) => {
  let v = 0;
  for (let e = 0; e < 13; e++)
    v += Math.min(Number(q._moore26_winding_get(x, y, z, 2*e)),
                  Number(q._moore26_winding_get(x, y, z, 2*e + 1)));
  return v;
};
const measure = () => {
  let tot = 0, num = 0, cx = 0, cz = 0;
  each3(N, (x, y, z) => {
    const v = bound(x, y, z);
    if (v >= 32) { tot += v; cx += v * x; cz += v * z; }
  });
  cx /= tot; cz /= tot;
  each3(N, (x, y, z) => {
    const v = bound(x, y, z);
    if (v >= 32) num += v * ((x - cx)**2 + (y - c0)**2 + (z - cz)**2);
  });
  return { rmsR: Math.sqrt(num / tot), tot, cx };
};

// A) diameter calibration
console.log('== A) equilibrium diameter vs commitment ==');
for (const comm of [80, 96, 112]) {
  q._moore26_init(N, N, N);
  seedKnot(c0, c0, c0, 4, comm);
  for (let t = 0; t < 60; t++) q._moore26_tick();
  const m = measure();
  console.log(`comm=${comm}  rmsR=${m.rmsR.toFixed(2)}  ~diam=${(m.rmsR*2).toFixed(1)} nodes  committed=${m.tot}`);
}

// B) terminal velocity under a sustained directional packet push (+x-ish: ch6=(1,1,0))
console.log('== B) terminal velocity under push ==');
q._moore26_init(N, N, N);
seedKnot(c0 - 8, c0, c0, 4, 128);
const push = () => {
  for (let z = c0 - 8; z <= c0 + 8; z++) for (let y = c0 - 8; y <= c0 + 8; y++)
    q._moore26_packet_set(4, y, z, 6, 2), q._moore26_packet_nu_set(4, y, z, 6, 150);
};
const cxAt = () => measure().cx;
const x0 = cxAt();
for (let t = 0; t < 100; t++) { push(); q._moore26_tick(); }
const dx = cxAt() - x0;
console.log(`pushed 100t: dx=${dx.toFixed(2)}  v=${(dx/100).toFixed(4)}c`);

// C) two-knot proximity
console.log('== C) two-knot proximity ==');
for (const gap of [3, 6]) {
  q._moore26_init(N, N, N);
  seedKnot(c0 - gap/2 | 0, c0, c0, 4, 120);
  seedKnot(c0 + gap/2 | 0, c0, c0, 4, 120);
  const sep0 = c0 + gap/2 - (c0 - gap/2);
  for (let t = 0; t < 60; t++) q._moore26_tick();
  // bound-mass centroid split: count committed volume in each half
  let left = 0, right = 0;
  each3(N, (x, y, z) => {
    const v = bound(x, y, z);
    if (v >= 32) { if (x < c0) left += v; else right += v; }
  });
  console.log(`gap=${gap}t: left=${left} right=${right}  ratio=${(Math.min(left,right)/Math.max(left,right)).toFixed(2)}  ${Math.min(left,right) > 0.3 * Math.max(left,right) ? 'both survive' : 'merged/dispersed'}`);
}
