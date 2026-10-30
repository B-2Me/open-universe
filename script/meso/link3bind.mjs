// link3bind: binding energy — does a bound pair's transaction
// budget differ from two separate lumps? (the energy-deficit
// signature of a real bound state)
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
for (const [tag,sep] of [['bound(gap=4)',4],['far(gap=14)',14]]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(64,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
  w._link3_ieburst(160);w._link3_photdecay(96);w._link3_egate(16);
  const a=26, b=30+sep;
  for(let z=5;z<11;z++)for(let y=5;y<11;y++){
    for(let x=a;x<a+4;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);}
    for(let x=b;x<b+4;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);}
  }
  w._link3_ev_reset();
  for(let t=0;t<200;t++){
    // feed the gap to sustain the exchange
    for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=a+4;x<b;x++)
      if(!((x+y+z)&1)){w._link3_phset(x,y,z,12,20);w._link3_phset(x,y,z,13,20);}
    w._link3_tick();
  }
  const ev=w._link3_ev.bind(w);
  const tot=ev(0)+ev(1)+ev(3)+ev(4)+ev(5)+ev(6)+ev(7)+ev(8)+ev(9)+ev(10)+ev(11)+ev(12)+ev(13)+ev(14)+ev(15);
  console.log(`${tag}: total transactions=${tot} estabs=${ev(14)} closes=${ev(15)} rest=${w._link3_rest_mass()}`);
}
