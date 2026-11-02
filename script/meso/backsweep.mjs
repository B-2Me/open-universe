// backsweep (E99): promote-to-default validation — key regimes under
// baseline vs egate+iget+photdecay. Do committed numbers hold?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const load=async()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();};
const REG=process.argv[2]||'base';
const E={base:{eg:0,ig:0,pd:0},new:{eg:8,ig:48,pd:8}}[REG];
console.log(`REGIME=${REG} (eg=${E.eg} ig=${E.ig} pd=${E.pd})`);

// 1. clot-phase: sustained corridor bath -> saturation mass (E63 baseline: bounded)
{
  const w=await load(); const W=32,H=16,D=16;
  w._meso3i_init(W,H,D,1); const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
  w._meso3i_phot(9);w._meso3i_scatter(128);
  if(w._meso3i_egate)w._meso3i_egate(E.eg); if(w._meso3i_iget)w._meso3i_iget(E.ig);
  if(w._meso3i_photdecay)w._meso3i_photdecay(E.pd);
  for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=14;x<20;x++)
    if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,64);
  for(let t=0;t<400;t++){
    if(t%4===0)for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=8;x<28;x++)
      if(!((x+y+z)&1)){ w._meso3i_phset(x,y,z,13,16); w._meso3i_phset(x,y,z,12,16); }
    w._meso3i_tick();
  }
  w._meso3i_rg_refresh();
  console.log(`  clot: rest=${w._meso3i_rest_mass()} phn=${w._meso3i_photons()}`);
}
// 2. bound-pair: two lumps, does equilibrium hold?
{
  const w=await load(); const W=48,H=16,D=16;
  w._meso3i_init(W,H,D,1); const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
  w._meso3i_phot(9);w._meso3i_scatter(128);
  if(w._meso3i_egate)w._meso3i_egate(E.eg); if(w._meso3i_iget)w._meso3i_iget(E.ig);
  if(w._meso3i_photdecay)w._meso3i_photdecay(E.pd);
  for(let z=5;z<11;z++)for(let y=5;y<11;y++){
    for(let x=15;x<21;x++)if(!((x+y+z)&1))w._meso3i_set(x,y,z,REST,64);
    for(let x=27;x<33;x++)if(!((x+y+z)&1))w._meso3i_set(x,y,z,REST,64);
  }
  for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=21;x<27;x++)
    if(!((x+y+z)&1)){ w._meso3i_phset(x,y,z,12,16); w._meso3i_phset(x,y,z,13,16); }
  const cent=(x0,x1)=>{let m=0,sx=0;for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=x0;x<x1;x++){
    if((x+y+z)&1)continue;let v=w._meso3i_get(x,y,z,REST);for(let c=0;c<NMOV;c++)v+=w._meso3i_rget(x,y,z,c);
    m+=v;sx+=v*x;}return m?sx/m:0;};
  for(let t=0;t<300;t++)w._meso3i_tick();
  console.log(`  pair: sep=${(cent(26,W)-cent(0,22)).toFixed(1)}`);
}
// 3. breath: iE sawtooth still cycles?
{
  const w=await load(); const W=32,H=16,D=16;
  w._meso3i_init(W,H,D,1); const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
  w._meso3i_phot(9);w._meso3i_scatter(128);w._meso3i_iepush(8);
  if(w._meso3i_egate)w._meso3i_egate(E.eg); if(w._meso3i_iget)w._meso3i_iget(E.ig);
  if(w._meso3i_photdecay)w._meso3i_photdecay(E.pd);
  for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=14;x<20;x++)
    if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,64);
  const out=[];
  for(let t=0;t<180;t++){
    if(t%4===0)for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=8;x<14;x++)
      if(!((x+y+z)&1)) w._meso3i_phset(x,y,z,12,16);
    w._meso3i_drain_edge(3); w._meso3i_tick();
    if(t%30===0){let ie=0;for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=14;x<20;x++)
      if(!((x+y+z)&1)) ie+=w._meso3i_eget(x,y,z); out.push(ie);}
  }
  console.log(`  breath iE: [${out.join(',')}]`);
}
