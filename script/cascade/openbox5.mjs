// openbox5.mjs — the shift=5 asymptote: 5000 ticks, engine-side
// absorb wall (no JS drain — absorbs boundary each tick)
import { loadM26 } from '../lib/m26.mjs';
const q = await loadM26();
q._moore26_init(32,32,32);q._moore26_evap_shift_set(5);
if(q._moore26_absorb_set)q._moore26_absorb_set(1);
for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  q._moore26_winding_set(16+dx,16+dy,16+dz,6,60);q._moore26_winding_set(16+dx,16+dy,16+dz,7,60);
  q._moore26_mass_set(16+dx,16+dy,16+dz,10);}
const CV6=[1,1,0];
const massOf=()=>{let m=0;for(let x=10;x<=22;x++)for(let y=10;y<=22;y++)for(let z=10;z<=22;z++)m+=Number(q._moore26_mass_get(x,y,z));return m;};
for(let t=1;t<=5000;t++){
  // convergent feed, 4 spokes aimed at center on ch6
  for(const [ox,oy] of [[-8,0],[8,0],[0,-8],[0,8]]){
    let sx=16-ox-1,sy=16-oy-1,sz=16;
    if((sx+sy+sz)&1)sz++;
    q._moore26_packet_set(sx,sy,sz,6,2);q._moore26_packet_nu_set(sx,sy,sz,6,96);}
  q._moore26_tick();
  if(t%1000===0)console.log('t'+t+' knot='+massOf());}
console.log('FINAL t5000 knot='+massOf());
