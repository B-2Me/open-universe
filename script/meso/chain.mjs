// chain (E80): three breathing lumps — group entrainment or phase split?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
const W=64,H=16,D=16;
w._meso3i_init(W,H,D,1);
const NMOV=w._meso3i_nch()-1,REST=NMOV;
w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
w._meso3i_phot(9); w._meso3i_scatter(128); w._meso3i_iepush(8);
const Xs=[8,24,40];   // three lumps, 10-site pitch
for(const xL of Xs)for(let z=5;z<11;z++)for(let y=5;y<11;y++)
  for(let x=xL;x<xL+6;x++) if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,64);
const out=[];
for(let t=0;t<300;t++){
  if(t%4===0)for(let z=4;z<12;z++)for(let y=4;y<12;y++){
    for(let x=4;x<8;x++)  if(!((x+y+z)&1)) w._meso3i_phset(x,y,z,12,16);
    for(let x=56;x<60;x++)if(!((x+y+z)&1)) w._meso3i_phset(x,y,z,13,16);
  }
  w._meso3i_drain_edge(3); w._meso3i_tick();
  if(t%20===0){
    const ie=Xs.map(xL=>{let s=0;for(let z=5;z<11;z++)for(let y=5;y<11;y++)
      for(let x=xL;x<xL+6;x++) if(!((x+y+z)&1)) s+=w._meso3i_eget(x,y,z); return s;});
    out.push(`t${t}:[${ie.join(',')}]`);
  }
}
console.log(`chain: ${out.join(' | ')}`);
