// nu-emission: is the flat spectrum real or transit-shifted?
// Compare emission spectrum from a THIN shell (little mass to cross)
// vs deep lump — if thin emits hot, the flat spectrum was redshift.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso3i.js'), 'utf8');
const mod = { exports: {} };
for (const thick of [5,7]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso3i.js');return m.exports();})();
  const W=48,H=24,D=24;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);w._meso3i_phot(thick);
  for(let z=8;z<16;z++)for(let y=8;y<16;y++)for(let x=16;x<32;x++)
    if(!((x+y+z)&1)){ w._meso3i_set(x,y,z,REST,64); w._meso3i_eset(x,y,z,200); }
  
  for(let t=0;t<60;t++){ w._meso3i_drain_edge(4); w._meso3i_tick(); }
  const spec=[0,0,0,0];
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if((x+y+z)&1)continue;
    for(let c=0;c<18;c++)for(let n2=1;n2<=4;n2++) spec[n2-1]+=w._meso3i_phget_nu(x,y,z,c,n2);
  }
  console.log(`phot=${thick}: emitted=[${spec.join(',')}]`);
}
