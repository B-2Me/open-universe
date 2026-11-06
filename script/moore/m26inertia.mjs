// m26inertia — mass-velocity discriminator: same push force on knots
// of different committed volume. v ~ 1/V => true inertia (a=F/m);
// flat v => fixed kinematic cap.
import { loadM26, each3 } from '../lib/m26.mjs';
const q = await loadM26();
const N = 32, c0 = N >> 1;
const seed = (cx, r, comm) => {
  for (let dz=-r;dz<=r;dz++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
    if(dx*dx+dy*dy+dz*dz>r*r)continue;
    for(let e=0;e<13;e++){
      q._moore26_winding_set(cx+dx,c0+dy,c0+dz,2*e,comm);
      q._moore26_winding_set(cx+dx,c0+dy,c0+dz,2*e+1,comm);
    }
  }
};
const bound=(x,y,z)=>{let v=0;for(let e=0;e<13;e++)v+=Math.min(Number(q._moore26_winding_get(x,y,z,2*e)),Number(q._moore26_winding_get(x,y,z,2*e+1)));return v;};
const cxA=()=>{let n=0,d=0;each3(N,(x,y,z)=>{const v=bound(x,y,z);if(v>=32){n+=v*x;d+=v;}});return n/d;};
const totV=()=>{let t=0;each3(N,(x,y,z)=>{const v=bound(x,y,z);if(v>=32)t+=v;});return t;};

console.log('comm | committed | v(c)    | v*V (scaled x1e-6)');
for (const comm of [40, 60, 90, 120]) {
  q._moore26_init(N, N, N);
  q._moore26_fusion_wall_set(512);
  q._moore26_commit_min_set(32);
  q._moore26_ground_floor_set(512);
  q._moore26_confirm_cap_set(160);
  q._moore26_catch_gate_set(8);          // fully porous crust
  seed(c0 - 8, 4, comm);
  const x0 = cxA(), V = totV();
  for (let t = 0; t < 100; t++) {
    for (let z = c0 - 8; z <= c0 + 8; z++) for (let y = c0 - 8; y <= c0 + 8; y++)
      q._moore26_packet_set(4, y, z, 6, 2), q._moore26_packet_nu_set(4, y, z, 6, 400);
    q._moore26_tick();
  }
  const dx = cxA() - x0, v = dx / 100;
  console.log(`${String(comm).padStart(4)} | ${String(V).padStart(9)} | ${v.toFixed(4)} | ${(v * V / 1e6).toFixed(2)}`);
}
