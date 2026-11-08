// openbox.mjs — driven dissipative equilibrium
// Sustained flux feeds the knot; boundary shell is drained each
// tick (absorbing wall). If mass tax sets the spectrum,
// plateau ~ flux / evap_rate => spacing across evap_shift.
import { loadM26 } from '../lib/m26.mjs';
const q = await loadM26();
const N=32, CV=[,,,,,,[1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],[1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1]];
const drain=()=>{for(let x=0;x<N;x++)for(let y=0;y<N;y++)for(let z=0;z<N;z++){
  if(x>1&&x<N-2&&y>1&&y<N-2&&z>1&&z<N-2)continue;
  for(let c=0;c<26;c++){q._moore26_packet_set(x,y,z,c,0);q._moore26_winding_set(x,y,z,c,0);}}};
const massOf=()=>{let m=0;for(let x=10;x<=22;x++)for(let y=10;y<=22;y++)for(let z=10;z<=22;z++)m+=Number(q._moore26_mass_get(x,y,z));return m;};
for (const sh of [3,4,5]) {
  q._moore26_init(N,N,N);q._moore26_evap_shift_set(sh);
  for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    q._moore26_winding_set(16+dx,16+dy,16+dz,6,60);q._moore26_winding_set(16+dx,16+dy,16+dz,7,60);
    q._moore26_mass_set(16+dx,16+dy,16+dz,10);}
  // convergent feed: 4 spokes aimed at center, 2 pkt/tick each
  const spokes=[[6,-8,0],[8,-8,0],[10,0,-8],[14,0,-8]];
  for(let t=1;t<=1500;t++){
    for(const [c,ox,oz] of spokes){
      let sx=16-ox-CV[c][0],sy=16-oz-CV[c][1],sz=16-CV[c][2];
      if((sx+sy+sz)&1)sz++;
      q._moore26_packet_set(sx,sy,sz,c,2);q._moore26_packet_nu_set(sx,sy,sz,c,96);}
    q._moore26_tick();drain();
    if(t%500===0)console.log('sh='+sh+' t'+t+' knot='+massOf());}
  console.log('sh='+sh+' PLATEAU='+massOf());
}
