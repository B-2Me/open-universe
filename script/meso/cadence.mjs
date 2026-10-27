// cadence (E35): does a detaining medium stretch pulse-train spacing?
// Pulse train of photon bursts (T=10 apart) through an absorbing slab;
// detector logs arrival peaks at the far side.
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
const run=(withSlab)=>{
  const W=48,H=24,D=24,NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_init(W,H,D,1); w._meso3i_collmode(0); w._meso3i_friction(8);
  w._meso3i_fricmode(16); w._meso3i_fricp(128); w._meso3i_drest(0);
  w._meso3i_reflect(0); w._meso3i_phot(5); w._meso3i_phth(0); w._meso3i_iptbar(withSlab?4:0);
  if(withSlab)  // absorbing slab x in [16,32]
    for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=16;x<32;x++)
      if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,48);
  // pulse train: bursts of photons on +x at x=6, injected every 10 ticks
  const arrivals=[];
  for(let t=0;t<60;t++){
    if(t%10===0 && t<40)   // pulses at t=0,10,20,30
      for(let z=6;z<18;z++)for(let y=6;y<18;y++)for(let x=6;x<8;x++)
        if(!((x+y+z)&1)) w._meso3i_phset_nu(x,y,z,12,1,32);
    w._meso3i_tick();
    // detector: count photons on +x at x>40
    let det=0;
    for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=40;x<W;x++){
      if((x+y+z)&1)continue;
      for(let nu=1;nu<=4;nu++) det+=w._meso3i_phget_nu(x,y,z,12,nu); }
    arrivals.push([t,det]);
  }
  // per-pulse arrival centroid: window [base, base+12) around each expected pulse
  const cents=[];
  for(let p=0;p<4;p++){
    const t0=6+8+p*10;   // expected arrival ~t16+p*10 in free flight
    let num=0,den=0;
    for(const [t,d] of arrivals) if(t>=t0&&t<t0+14&&d>200){ num+=t*d; den+=d; }
    if(den) cents.push((num/den).toFixed(2));
  }
  const spacings=cents.slice(1).map((c,i)=>(parseFloat(c)-parseFloat(cents[i])).toFixed(2));
  console.log(`slab=${withSlab}: centroids=[${cents.join(', ')}] spacings=[${spacings.join(', ')}]`);
};
console.log('E38 — coherence barrier (leaky iPT): residue decays in dark gap, T preserved');
run(false); run(true);
