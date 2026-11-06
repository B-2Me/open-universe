// m26porous — the 0.033c ceiling test: sweep catch gate porosity and
// measure both terminal velocity AND absorption. If v rises with
// porosity -> the cap was boundary deflection. If v stays ~0.033c
// even at full absorption -> substrate law: bound topology can't
// translate faster.
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
const totals=()=>{let w=0,h=0;each3(N,(x,y,z)=>{h+=Number(q._moore26_heat_get(x,y,z));for(let e=0;e<26;e++)w+=Number(q._moore26_winding_get(x,y,z,e));});return{w,h};};

console.log('gate | accept%* | v(c)    | dx/100t | dWinding | dHeat');
for (const gate of [64, 32, 16, 8, 4]) {
  q._moore26_init(N, N, N);
  q._moore26_fusion_wall_set(512);       // keep push energy below pair wall
  q._moore26_commit_min_set(32);
  q._moore26_ground_floor_set(512);
  q._moore26_confirm_cap_set(160);
  q._moore26_catch_gate_set(gate);
  seed(c0 - 8, 4, 120);
  const t0 = totals(), x0 = cxA();
  for (let t = 0; t < 100; t++) {
    for (let z = c0 - 8; z <= c0 + 8; z++) for (let y = c0 - 8; y <= c0 + 8; y++)
      q._moore26_packet_set(4, y, z, 6, 2), q._moore26_packet_nu_set(4, y, z, 6, 400);
    q._moore26_tick();
  }
  const t1 = totals(), dx = cxA() - x0;
  // lvl=8 at knot surface -> accept = min(100, 8/gate*100)
  const acc = Math.min(100, 800 / gate).toFixed(0);
  console.log(`${String(gate).padStart(4)} | ${acc.padStart(7)} | ${(dx/100).toFixed(4)} | ${dx.toFixed(2).padStart(6)} | ${String(t1.w - t0.w).padStart(8)} | ${t1.h - t0.h}`);
}
