// ledgerbox.mjs — is the checkbook balanced?
// L = mass + winding + heat + Σ(photon·nu) + ev44(bath) must be
// flat across 3k ticks if the ledger is truly closed.
import { loadM26 } from '../lib/m26.mjs';
const q = await loadM26();
q._moore26_init(32,32,32);
q._moore26_evap_shift_set(4);
const BA = +(process.env.BONDAGE ?? 0);
if (BA) q._moore26_bond_age_set(BA);
console.log(`bond_age=${BA}`);
const W=(x,y,z,c,v)=>q._moore26_winding_set(x,y,z,c,v);
const M=(x,y,z,v)=>q._moore26_mass_set(x,y,z,v);
for(let dz=-3;dz<=3;dz++)for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
  if(dx*dx+dy*dy+dz*dz>9)continue;
  for(let e=0;e<13;e++){W(16+dx,16+dy,16+dz,2*e,120);W(16+dx,16+dy,16+dz,2*e+1,180);}
  M(16+dx,16+dy,16+dz,10);
}
const L=()=>Number(q._moore26_sum(0))+Number(q._moore26_sum(1))
         +Number(q._moore26_sum(3))+Number(q._moore26_sum(8))
         +Number(q._moore26_sum(5))+Number(q._moore26_sum(6))
         +Number(q._moore26_sum(7))+Number(q._moore26_sum(4))
         +Number(q._moore26_events(44));
const L0=L();console.log('t0 L='+L0);
for(let t=1;t<=3000;t++){
  q._moore26_tick();
  if(t%250===0)console.log('t'+t+' L='+L()+' dL='+(L()-L0)+' ev44='+q._moore26_events(44)+' ev43='+q._moore26_events(43));
}
