// m26floor — lightest stable bound state. Sweep comm downward on a
// fixed lump until the lump stops surviving (the atomic floor).
// Found: 27 cells at comm>=4 hold at exact seed volume; comm=2 dies.
import { loadM26, each3 } from '../lib/m26.mjs';
const q = await loadM26();
const N = 32, c0 = N >> 1;
const bound=(x,y,z)=>{let v=0;for(let e=0;e<13;e++)v+=Math.min(Number(q._moore26_winding_get(x,y,z,2*e)),Number(q._moore26_winding_get(x,y,z,2*e+1)));return v;};
console.log('comm | cells | live@200t | vol');
for (const comm of [64, 32, 16, 8, 4, 2]) {
  const r = comm > 16 ? 3 : 1;
  q._moore26_init(N, N, N);
  let seeded = 0;
  for (let dz=-r;dz<=r;dz++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
    if (dx*dx+dy*dy+dz*dz>r*r) continue;
    const x=c0+dx,y=c0+dy,z=c0+dz;seeded++;
    for(let e=0;e<13;e++){q._moore26_winding_set(x,y,z,2*e,comm);q._moore26_winding_set(x,y,z,2*e+1,comm);}
  }
  for(let t=0;t<200;t++)q._moore26_tick();
  let n=0,vol=0;each3(N,(x,y,z)=>{const v=bound(x,y,z);if(v>=32){n++;vol+=v;}});
  console.log(`${String(comm).padStart(4)} | ${String(seeded).padStart(5)} | ${String(n).padStart(9)} | ${vol}`);
}
