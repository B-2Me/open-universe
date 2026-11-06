// m26map — one-axis sensitivity map: which tuners move physics?
// Standard scenario: comm=120 knot + packet flux. Sweep each knob
// alone, measure vol/mass/dd/radE/heat vs baseline.
import { loadM26, ev, each3 } from '../lib/m26.mjs';
const q = await loadM26();
const N = 32, c0 = N >> 1;
const KNOBS = [
  ['fusion_wall', [256, 384]], ['commit_min', [32, 16]],
  ['ground_floor', [512, 256]], ['confirm_cap', [160, 224]],
  ['catch_gate', [16, 8]], ['dir_bias', [0, 256]],
  ['dd_shift', [0, 3]], ['bend_shift', [0, 7]],
  ['rad_shift', [0, 6]], ['phase_gate', [0, 64]], ['phase_sync', [1, 0]],
];
const SET = (n, v) => q[`_moore26_${n}_set`](v);
const seed = () => {
  q._moore26_init(N, N, N);
  for (let dz=-4;dz<=4;dz++) for (let dy=-4;dy<=4;dy++) for (let dx=-4;dx<=4;dx++) {
    if (dx*dx+dy*dy+dz*dz>16) continue;
    const x=c0+dx,y=c0+dy,z=c0+dz;
    for (let e=0;e<13;e++) {
      q._moore26_winding_set(x,y,z,2*e,120);
      q._moore26_winding_set(x,y,z,2*e+1,120);
    }
  }
  q._moore26_mass_set(c0,c0,c0,256);
};
const run = (knob, val) => {
  seed();
  // defaults
  SET('fusion_wall',256); SET('commit_min',32); SET('ground_floor',512);
  SET('confirm_cap',160); SET('catch_gate',8); SET('dir_bias',256);
  SET('dd_shift',3); SET('bend_shift',7); SET('rad_shift',6);
  SET('phase_gate',0); SET('phase_sync',1);
  if (knob !== 'baseline') SET(knob, val);
  for (let t=0;t<80;t++) {
    for (let z=c0-8;z<=c0+8;z++) for (let y=c0-8;y<=c0+8;y++)
      q._moore26_packet_set(4,y,z,6,2), q._moore26_packet_nu_set(4,y,z,6,150);
    q._moore26_tick();
  }
  let vol=0,mass=0,dd=0,heat=0;
  each3(N,(x,y,z)=>{
    let v=0;for(let e=0;e<13;e++)v+=Math.min(Number(q._moore26_winding_get(x,y,z,2*e)),Number(q._moore26_winding_get(x,y,z,2*e+1)));
    if(v>=32)vol+=v;
    mass+=Number(q._moore26_mass_get(x,y,z));heat+=Number(q._moore26_heat_get(x,y,z));
    dd+=Number(q._moore26_winding_get(x,y,z,6))-Number(q._moore26_winding_get(x,y,z,7));
  });
  return {vol,mass,dd,heat,radE:ev(q,33)};
};
const base = run('baseline');
console.log(`baseline: vol=${base.vol} mass=${base.mass} dd=${base.dd} heat=${base.heat} radE=${base.radE}`);
for (const [name, vals] of KNOBS) {
  for (const v of vals) {
    const r = run(name, v);
    const dv = ((r.vol-base.vol)/base.vol*100).toFixed(1);
    console.log(`${name}=${v}: vol=${r.vol}(${dv}%) mass=${r.mass} dd=${r.dd} heat=${r.heat} radE=${r.radE}`);
  }
}
