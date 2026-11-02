// dragq: quick single-case drag check — mdrag only, small
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
for(const md of [0,16]){
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
  const W=32,H=16,D=16;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);w._meso3i_phot(0);
  if(w._meso3i_mdrag)w._meso3i_mdrag(md);
  for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=12;x<20;x++)
    if(!((x+y+z)&1)){ w._meso3i_set(x,y,z,REST,64); w._meso3i_dset(x,y,z,12,64);
                      for(let c=0;c<NMOV;c++)w._meso3i_phset(x,y,z,c,4); }
  for(let t=0;t<30;t++)w._meso3i_tick();
  const chs=new Array(NMOV).fill(0);
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if((x+y+z)&1)continue;
    for(let c=0;c<NMOV;c++)chs[c]+=w._meso3i_phget(x,y,z,c);}
  console.log(`mdrag=${md}: ch12=${chs[12]} ch13=${chs[13]} tot=${chs.reduce((a,b)=>a+b)}`);
}
