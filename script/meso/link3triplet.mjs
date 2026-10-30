// link3triplet: 3-lump complementarity — can a triplet form where
// each pair is wound to face the others? (the quark-color analog:
// three different "colors" bound together)
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
// three lumps: A wound +x, B wound -x, C wound +y — arranged triangle
for (const [tag,config] of [['triplet',1],['all-same',0]]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(64,20,20,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
  w._link3_ieburst(160);w._link3_photdecay(96);w._link3_egate(16);
  const lumps=[[24,10,9],[38,10,9],[31,16,9]]; // triangle
  const winds=config?[12,13,0]:[12,12,12];
  for(let i=0;i<3;i++){
    const [cx,cy,cz]=lumps[i];
    for(let dz=-1;dz<2;dz++)for(let dy=-1;dy<2;dy++)for(let dx=-1;dx<2;dx++)
      if(!((cx+dx+cy+dy+cz+dz)&1)){
        w._link3_set(cx+dx,cy+dy,cz+dz,REST,64);
        w._link3_eset(cx+dx,cy+dy,cz+dz,160);
        w._link3_rset(cx+dx,cy+dy,cz+dz,winds[i],96);
      }
  }
  for(let t=0;t<150;t++)w._link3_tick();
  const est=()=>{let n=0;for(let z=0;z<20;z++)for(let y=0;y<20;y++)for(let x=20;x<44;x++)
    if(!((x+y+z)&1))for(let c=0;c<NMOV;c++)if(w._link3_sst(x,y,z,c)===3)n++;return n;};
  console.log(`${tag}: estab=${est()} bursts=${w._link3_ev(11)}`);
}
