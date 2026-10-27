// cadence2 (E36): can earlier light deposit mass that delays later light?
// Pulse train on +x through a corridor filled with a counter-beam.
// Head-on pairs fuse (IPHOT=9) depositing rest mass mid-path; trailing
// pulses then see parked mass where the corridor was empty.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso3i.js'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'require', '__dirname', '__filename', src)
  (mod, mod.exports, require, join(here, '../../docs/public/wasm/ember'), 'meso3i.js');
const w = await mod.exports();
const run=(counter)=>{
  const W=48,H=24,D=24,NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_init(W,H,D,1); w._meso3i_collmode(0); w._meso3i_friction(8);
  w._meso3i_fricmode(16); w._meso3i_fricp(128); w._meso3i_drest(0);
  w._meso3i_reflect(0); w._meso3i_phot(counter?9:5); w._meso3i_phth(0);
  // counter-beam: photons on -x (ch13) filling the corridor x in [16,40]
  if(counter)
    for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=16;x<40;x++)
      if(!((x+y+z)&1)) w._meso3i_phset_nu(x,y,z,13,1,16);
  const arrivals=[];
  for(let t=0;t<70;t++){
    if(t%10===0 && t<40)   // pulses at t=0,10,20,30 on +x at x=6
      for(let z=6;z<18;z++)for(let y=6;y<18;y++)for(let x=6;x<8;x++)
        if(!((x+y+z)&1)) w._meso3i_phset_nu(x,y,z,12,1,32);
    w._meso3i_tick();
    let det=0;
    for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=40;x<W;x++){
      if((x+y+z)&1)continue;
      for(let nu=1;nu<=4;nu++) det+=w._meso3i_phget_nu(x,y,z,12,nu); }
    arrivals.push([t,det]);
  }
  const cents=[];
  for(let p=0;p<4;p++){
    const t0=14+p*10;
    let num=0,den=0;
    for(const [t,d] of arrivals) if(t>=t0&&t<t0+14&&d>200){ num+=t*d; den+=d; }
    if(den) cents.push((num/den).toFixed(2));
  }
  w._meso3i_rg_refresh();
  const spacings=cents.slice(1).map((c,i)=>(parseFloat(c)-parseFloat(cents[i])).toFixed(2));
  console.log(`counter=${counter}: centroids=[${cents.join(', ')}] spacings=[${spacings.join(', ')}] corridorRest=${w._meso3i_rest_mass()}`);
};
console.log('E36 — deposited mass delaying trailing pulses?');
run(false); run(true);
