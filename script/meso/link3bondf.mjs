// link3bondf: does the session's exchange create a FORCE? Measure
// pair separation with the exchange on vs off — bond or repulsion.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
for (const [tag,feed] of [['no exchange',0],['exchange',1]]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(64,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
  w._link3_ieburst(160);w._link3_photdecay(96);w._link3_egate(16);w._link3_grav(24);
  for(let z=5;z<11;z++)for(let y=5;y<11;y++){
    for(let x=26;x<30;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);}
    for(let x=34;x<38;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);}
  }
  const sep=()=>{let a=0,b=0,m1=0,m2=0;
    for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=0;x<64;x++){
      if((x+y+z)&1)continue;let v=w._link3_rest(x,y,z);
      for(let c=0;c<NMOV;c++)v+=w._link3_drest(x,y,z,c);
      if(x<32){a+=v*x;m1+=v;}else{b+=v*x;m2+=v;}}
    return m1&&m2?(b/m2-a/m1):0;};
  const s0=sep();
  for(let t=0;t<200;t++){
    if(feed)for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=30;x<34;x++)
      if(!((x+y+z)&1)){w._link3_phset(x,y,z,12,20);w._link3_phset(x,y,z,13,20);}
    w._link3_tick();
  }
  console.log(`${tag}: sep ${s0.toFixed(1)}->${sep().toFixed(1)}`);
}
