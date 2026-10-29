// ampere (E81): parallel currents attract? two mass beams, same vs
// opposite direction — measure drift between them.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
for (const mode of ['parallel','antiparallel']) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
  const W=48,H=24,D=24;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);w._meso3i_phot(0);
  // two beams: top at y=5, bottom at y=9 (4 apart). parallel: both ch12(+x). antiparallel: bottom ch13(-x)
  for(let z=4;z<20;z++)for(let x=4;x<44;x++){
    if(!((x+5+z)&1))   w._meso3i_set(x,5,z,12,16);
    if(!((x+9+z)&1))   w._meso3i_set(x,9,z, mode==='parallel'?12:13, 16);
  }
  // measure beam y-separation over time
  const out=[];
  for(let t=0;t<120;t++){
    w._meso3i_tick();
    if(t%30===0){
      // count mass at y=5 row vs y=9 row
      let top=0,bot=0;
      for(let z=0;z<D;z++)for(let x=0;x<W;x++){
        if((x+5+z)&1)continue; for(let c=0;c<NMOV;c++)top+=w._meso3i_get(x,5,z,c);
        if((x+9+z)&1)continue; for(let c=0;c<NMOV;c++)bot+=w._meso3i_get(x,9,z,c);
      }
      out.push(`t${t}:top=${top} bot=${bot}`);
    }
  }
  console.log(`${mode}: ${out.join(' | ')}`);
}
