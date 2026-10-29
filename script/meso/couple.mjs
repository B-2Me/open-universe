// couple (E79): two breathing lumps sharing a photon field —
// does the coupling synchronize their charge cycles?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
const GAP = Number(process.argv[2] || 4);
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
const W=48,H=16,D=16;
w._meso3i_init(W,H,D,1);
const NMOV=w._meso3i_nch()-1,REST=NMOV;
w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
w._meso3i_phot(9); w._meso3i_scatter(128); w._meso3i_iepush(8);
const xL=8, xR=xL+6+GAP+4;   // lumps x in [8,14) and [xR,xR+6)
for(let z=5;z<11;z++)for(let y=5;y<11;y++){
  for(let x=xL;x<xL+6;x++) if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,64);
  for(let x=xR;x<xR+6;x++) if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,64);
}
const out=[];
for(let t=0;t<300;t++){
  if(t%4===0)for(let z=4;z<12;z++)for(let y=4;y<12;y++){
    for(let x=xL-4;x<xL;x++) if(!((x+y+z)&1)) w._meso3i_phset(x,y,z,12,16);
    for(let x=xR+6;x<xR+10;x++) if(!((x+y+z)&1)) w._meso3i_phset(x,y,z,13,16);
  }
  w._meso3i_drain_edge(3); w._meso3i_tick();
  if(t%10===0){
    let iL=0,iR=0;
    for(let z=5;z<11;z++)for(let y=5;y<11;y++){
      for(let x=xL;x<xL+6;x++) if(!((x+y+z)&1)) iL+=w._meso3i_eget(x,y,z);
      for(let x=xR;x<xR+6;x++) if(!((x+y+z)&1)) iR+=w._meso3i_eget(x,y,z);
    }
    out.push(`t${t}:L=${iL} R=${iR}`);
  }
}
console.log(`gap=${GAP}: ${out.join(' | ')}`);
