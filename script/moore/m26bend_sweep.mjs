// m26bend_sweep — find the rate window where dd survives through the
// bend while still paying the synchrotron tax (ev33>0).
import { loadM26, ev } from '../lib/m26.mjs';
const q = await loadM26();
const N = 32, c0 = N >> 1;
const V = {6:[1,1,0],7:[-1,-1,0],8:[1,-1,0],9:[-1,1,0],10:[1,0,1],11:[-1,0,-1],12:[1,0,-1],13:[-1,0,1],14:[0,1,1],15:[0,-1,-1],16:[0,1,-1],17:[0,-1,1]};
const cells=[]; let x=c0-8,y=c0,z=c0;
for (const ch of [6,10,16,7]) for(let i=0;i<6;i++){cells.push([x,y,z,ch]);x+=V[ch][0];y+=V[ch][1];z+=V[ch][2];}
const run = (bs, ds, rs, rate, ticks) => {
  q._moore26_init(N,N,N);
  q._moore26_dd_shift_set(ds); q._moore26_dir_bias_set(256);
  q._moore26_catch_gate_set(8); q._moore26_bend_shift_set(bs); q._moore26_rad_shift_set(rs);
  for(const[px,py,pz]of cells)for(let e=0;e<13;e++){
    q._moore26_winding_set(px,py,pz,2*e,120);q._moore26_winding_set(px,py,pz,2*e+1,120);}
  const m=cells[0];
  for(let t=0;t<ticks;t++){
    q._moore26_packet_set(m[0],m[1],m[2],6,rate);
    q._moore26_packet_nu_set(m[0],m[1],m[2],6,150);
    q._moore26_tick();
  }
  const legs=[];
  for(let l=0;l<4;l++){
    const tCh=[6,10,16,7][l];let dd=0;
    for(const[px,py,pz]of cells.slice(l*6,l*6+6))
      dd+=Number(q._moore26_winding_get(px,py,pz,tCh))-Number(q._moore26_winding_get(px,py,pz,tCh^1));
    legs.push(dd);
  }
  return {legs, radE: ev(q,33)};
};
console.log('bend dd  rad | leg dd                | radE');
for (const bs of [5,6,7]) for (const ds of [2,3]) for (const rs of [5,6]) {
  const r = run(bs, ds, rs, 4, 200);
  console.log(`${bs}    ${ds}   ${rs}   | [${legs_str(r.legs)}] | ${r.radE}`);
}
function legs_str(a){return a.map(v=>String(v).padStart(5)).join(',');}
