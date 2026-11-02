// link3hubsat: does a hub's capacity saturate? Clients ring a dense
// hub — do sessions/client decline as the cluster grows (the global
// constraint peer chains lack)?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
for(const NC of [2,4,6,8]){
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(64,32,32,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
  w._link3_ieburst(160);w._link3_egate(16);w._link3_phspread(96);w._link3_dwell(4);
  // dense hub at center (32,16,16)
  for(let z=13;z<19;z++)for(let y=13;y<19;y++)for(let x=29;x<35;x++)
    if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,128);w._link3_eset(x,y,z,255);}
  // clients in a ring around the hub at r=8 (axial + diagonal directions)
  const offs=[[8,0,0],[-8,0,0],[0,8,0],[0,-8,0],[0,0,8],[0,0,-8],[6,6,0],[-6,-6,0]];
  const winds=[12,13,14,15,16,17,0,1];
  for(let i=0;i<NC;i++){
    const[dx,dy,dz]=offs[i];
    for(let z=14;z<18;z++)for(let y=14;y<18;y++)for(let x=30;x<34;x++)
      if(!((x+dx+y+dy+z+dz)&1)){w._link3_set(x+dx,y+dy,z+dz,REST,32);w._link3_eset(x+dx,y+dy,z+dz,160);w._link3_rset(x+dx,y+dy,z+dz,winds[i],96);}
  }
  for(let t=0;t<200;t++)w._link3_tick();
  // sessions into the hub region (per client)
  let est=0;
  for(let z=0;z<32;z++)for(let y=0;y<32;y++)for(let x=26;x<38;x++)
    if(!((x+y+z)&1))for(let c=0;c<NMOV;c++)if(w._link3_sst(x,y,z,c)===3)est++;
  console.log(`clients=${NC}: hub sessions=${est} per-client=${(est/NC).toFixed(1)}`);
}
