// m26sweep — runtime-knob tuning sweep:
//  1) confirm_cap ↑  -> does gap=6 dimer share a boundary layer?
//  2) commit_min  ↓  -> does a faint bridge persist between knots?
//  3) fusion_wall ↑  -> harder push -> does v_bulk exceed 0.033c?
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
const halves=()=>{let l=0,r=0;each3(N,(x,y,z)=>{const v=bound(x,y,z);if(v>=32){x<c0?l+=v:r+=v;}});return{l,r};};
const mid=()=>{let v=0;for(let z=c0-2;z<=c0+2;z++)for(let y=c0-2;y<=c0+2;y++)for(let x=c0-1;x<=c0+1;x++)v+=bound(x,y,z);return v;};

// --- test 1+2: dimer bridge at gap=6, comm=120 ---
console.log('== dimer gap=6 comm=120 (knobs vs mid-bridge committed volume) ==');
for (const [name,fn] of [
  ['baseline', () => {}],
  ['cap+64',   () => q._moore26_confirm_cap_set(224)],
  ['cap+96',   () => q._moore26_confirm_cap_set(256)],
  ['min-12',   () => q._moore26_commit_min_set(20)],
  ['min-20',   () => q._moore26_commit_min_set(12)],
]) {
  q._moore26_init(N, N, N);
  q._moore26_fusion_wall_set(256); q._moore26_commit_min_set(32);
  q._moore26_ground_floor_set(512); q._moore26_confirm_cap_set(160);
  fn();
  seed((c0-3)|0,4,120); seed((c0+3)|0,4,120);
  for (let t=0;t<60;t++) q._moore26_tick();
  const {l,r}=halves();
  console.log(`${name.padEnd(8)} L=${l} R=${r} ratio=${(Math.min(l,r)/Math.max(l,r)).toFixed(2)} midbound=${mid()}`);
}

// --- test 3: fusion_wall -> push energy ceiling ---
console.log('== terminal velocity vs fusion_wall (push nu=400) ==');
for (const wall of [256, 512, 768]) {
  q._moore26_init(N, N, N);
  q._moore26_fusion_wall_set(wall); q._moore26_commit_min_set(32);
  q._moore26_ground_floor_set(512); q._moore26_confirm_cap_set(160);
  seed(c0-8,4,120);
  const cxA=()=>{let n=0,d=0;each3(N,(x,y,z)=>{const v=bound(x,y,z);if(v>=32){n+=v*x;d+=v;}});return n/d;};
  const x0=cxA();
  for(let t=0;t<100;t++){
    for(let z=c0-8;z<=c0+8;z++)for(let y=c0-8;y<=c0+8;y++)
      q._moore26_packet_set(4,y,z,6,2),q._moore26_packet_nu_set(4,y,z,6,400);
    q._moore26_tick();
  }
  console.log(`wall=${wall}  dx=${(cxA()-x0).toFixed(2)}  v=${((cxA()-x0)/100).toFixed(4)}c`);
}
