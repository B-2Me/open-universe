// seedgrow (E97): do spontaneous seeds organize into structure?
// Long run — track total mass, peak count, spatial clustering.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
const W=48,H=32,D=16;
w._meso3i_init(W,H,D,1);
const NMOV=w._meso3i_nch()-1,REST=NMOV;
w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
w._meso3i_phot(9); w._meso3i_scatter(128);
if(w._meso3i_photdecay) w._meso3i_photdecay(32);
if(w._meso3i_egate) w._meso3i_egate(8);
for(let z=4;z<D-4;z++)for(let y=4;y<H-4;y++)for(let x=4;x<W-4;x++)
  if(!((x+y+z)&1)){ w._meso3i_phset(x,y,z,12,32); w._meso3i_phset(x,y,z,13,32); }
const out=[];
for(let t=0;t<400;t++){
  w._meso3i_tick();
  if(t%50===0){
    w._meso3i_rg_refresh();
    // count distinct peaks (sites with rest+drest > 64) + largest site
    let pk=0,mx=0,tot=0;
    for(let z=4;z<D-4;z++)for(let y=4;y<H-4;y++)for(let x=4;x<W-4;x++){
      if((x+y+z)&1)continue;
      let v=w._meso3i_get(x,y,z,REST);
      for(let c=0;c<NMOV;c++)v+=w._meso3i_rget(x,y,z,c);
      tot+=v; if(v>64)pk++; if(v>mx)mx=v;
    }
    out.push(`t${t}:pk=${pk} mx=${mx} tot=${tot}`);
  }
}
console.log(out.join(' | '));
