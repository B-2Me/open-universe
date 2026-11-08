// closedbox.mjs — does a knot have a stable rest mass?
// Single balanced wound knot, zero drive, closed 32^3 box.
// Win: mass plateaus while vacuum retains heat (emission≈absorption).
// Loss: mass accretes until the vacuum starves (greedy condenser).
import { loadM26 } from '../lib/m26.mjs';
const q = await loadM26();
const N = 32, c0 = 16;
q._moore26_init(N, N, N);
const W=(x,y,z,c,v)=>q._moore26_winding_set(x,y,z,c,v);
const M=(x,y,z,v)=>q._moore26_mass_set(x,y,z,v);
/* balanced wound knot — the verified 120/180 recipe on -dd */
for(let dz=-3;dz<=3;dz++)for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
  if(dx*dx+dy*dy+dz*dz>9)continue;
  for(let e=0;e<13;e++){W(c0+dx,c0+dy,c0+dz,2*e,120);W(c0+dx,c0+dy,c0+dz,2*e+1,180);}
  M(c0+dx,c0+dy,c0+dz,10);
}
const massOf=()=>{let m=0;for(let x=c0-6;x<=c0+6;x++)for(let y=c0-6;y<=c0+6;y++)for(let z=c0-6;z<=c0+6;z++)m+=Number(q._moore26_mass_get(x,y,z));return m;};
const knots=Number(q._moore26_sum(0));
console.log('t=0 mass-knot:',massOf(),'mass-grid:',knots);
for(let t=1;t<=3000;t++){
  q._moore26_tick();
  if(t%250===0||t===1||t===10||t===50){
    console.log(`t${t} knot=${massOf()} wind=${Number(q._moore26_sum(1))} pkt=${Number(q._moore26_sum(2))} heat=${Number(q._moore26_sum(3))}`);
  }
}
