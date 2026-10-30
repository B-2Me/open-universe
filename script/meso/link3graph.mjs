// link3graph: the cluster's session topology — which lumps bind to
// which. Read the ESTAB graph between the 5-lump cluster.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
w._link3_init(64,20,20,1);
const NMOV=w._link3_nch()-1,REST=NMOV;
w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
w._link3_ieburst(160);w._link3_photdecay(96);w._link3_egate(16);
const lumps=[[30,9,9],[22,9,9],[38,9,9],[30,4,9],[30,14,9]];
for(const [cx,cy,cz] of lumps)
  for(let dz=-1;dz<2;dz++)for(let dy=-1;dy<2;dy++)for(let dx=-1;dx<2;dx++)
    if(!((cx+dx+cy+dy+cz+dz)&1)){w._link3_set(cx+dx,cy+dy,cz+dz,REST,64);w._link3_eset(cx+dx,cy+dy,cz+dz,160);}
for(let t=0;t<150;t++){
  for(let z=5;z<14;z++)for(let y=5;y<16;y++)for(let x=24;x<42;x++)
    if(!((x+y+z)&1)){w._link3_phset(x,y,z,12,12);w._link3_phset(x,y,z,13,12);}
  w._link3_tick();
}
// session heatmap — where are the ESTAB links? (y-z slice at z=9)
console.log('ESTAB session map (x across, y down) at z=9:');
for(let y=2;y<18;y++){
  let row='';
  for(let x=20;x<44;x++){
    if((x+y+9)&1){row+=' ';continue;}
    let est=0;for(let c=0;c<NMOV;c++)if(w._link3_sst(x,y,9,c)===3)est++;
    row+=est>2?'#':est>0?'+':'.';
  }
  console.log(`  y=${String(y).padStart(2)} ${row}`);
}
