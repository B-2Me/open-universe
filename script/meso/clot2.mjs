// clot2 (E64): two flux-formed clots in one grid — merge, repel, or orbit?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso3i.js'), 'utf8');
const mod = { exports: {} };
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso3i.js');return m.exports();})();
const W=64,H=24,D=24;
w._meso3i_init(W,H,D,1);
const NMOV=w._meso3i_nch()-1,REST=NMOV;
w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
w._meso3i_phot(9); w._meso3i_scatter(128); w._meso3i_iecost(1);
// two bath regions: left clot x in [12,26], right clot x in [38,52]
const bath=(x0,x1,on)=>{for(let z=6;z<18;z++)for(let y=6;y<18;y++)for(let x=x0;x<x1;x++)
  if(!((x+y+z)&1)){ w._meso3i_phset_nu(x,y,z,12,1,on); w._meso3i_phset_nu(x,y,z,13,1,on);}};
const massIn=(x0,x1)=>{let s=0;for(let z=6;z<18;z++)for(let y=6;y<18;y++)for(let x=x0;x<x1;x++){
  if((x+y+z)&1)continue; s+=w._meso3i_get(x,y,z,REST); for(let c=0;c<NMOV;c++)s+=w._meso3i_rget(x,y,z,c);}return s;};
for(let z=8;z<16;z++)for(let y=8;y<16;y++)for(let x=38;x<46;x++)
  if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,64);
const out=[];
for(let t=0;t<400;t++){
  if(t<150&&t%4===0){ bath(18,30,16); }
  w._meso3i_drain_edge(4); w._meso3i_tick();
  if(t%80===0) out.push(`t${t}:L=${massIn(14,32)} R=${massIn(32,50)}`);
}
console.log(`clot2: ${out.join(' | ')}`);
