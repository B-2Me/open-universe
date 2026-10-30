// link3sessdrag: session inertia — does a BOUND pair resist motion
// more than a lone lump? Push both, measure drift.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
for (const [tag,second] of [['lone',0],['bound-pair',1]]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(96,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
  w._link3_ieburst(160);w._link3_photdecay(96);w._link3_egate(16);
  // lump A wound +x (drifts); optional lump B nearby with exchange
  for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=26;x<30;x++)
    if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);w._link3_rset(x,y,z,12,128);}
  if(second){
    for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=34;x<38;x++)
      if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);w._link3_rset(x,y,z,12,128);}
  }
  const cent=()=>{let m=0,sx=0;for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=0;x<96;x++){
    if((x+y+z)&1)continue;let v=w._link3_rest(x,y,z);
    for(let c=0;c<NMOV;c++)v+=w._link3_drest(x,y,z,c);
    m+=v;sx+=v*x;}return m?sx/m:0;};
  // build the session if pair
  for(let t=0;t<50;t++){
    if(second)for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=30;x<34;x++)
      if(!((x+y+z)&1)){w._link3_phset(x,y,z,12,20);w._link3_phset(x,y,z,13,20);}
    w._link3_tick();
  }
  const x0=cent();
  for(let t=0;t<150;t++)w._link3_tick();
  console.log(`${tag}: drift=${(cent()-x0).toFixed(1)}`);
}
