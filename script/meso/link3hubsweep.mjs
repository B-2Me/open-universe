// link3hubsweep: the hub-capacity map — sessions/client vs
// (client count x hub mass). Where does the center saturate?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const run = async (NC, hubRest, R) => {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(96,40,40,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
  w._link3_ieburst(160);w._link3_egate(16);w._link3_phspread(96);w._link3_dwell(4);
  for(let z=17;z<23;z++)for(let y=17;y<23;y++)for(let x=45;x<51;x++)
    if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,hubRest);w._link3_eset(x,y,z,255);}
  const offs=[[R,0,0],[-R,0,0],[0,R,0],[0,-R,0],[0,0,R],[0,0,-R],
              [R-2,R-2,0],[-R+2,-R+2,0],[R-2,-R+2,0],[-R+2,R-2,0],
              [R-2,0,R-2],[-R+2,0,-R+2]];
  const winds=[12,13,14,15,16,17,0,1,2,3,8,9];
  for(let i=0;i<NC;i++){
    const[dx,dy,dz]=offs[i];
    for(let z=18;z<22;z++)for(let y=18;y<22;y++)for(let x=46;x<50;x++)
      if(!((x+dx+y+dy+z+dz)&1)){w._link3_set(x+dx,y+dy,z+dz,REST,32);w._link3_eset(x+dx,y+dy,z+dz,160);w._link3_rset(x+dx,y+dy,z+dz,winds[i],96);}
  }
  for(let t=0;t<200;t++)w._link3_tick();
  let est=0;
  for(let z=0;z<40;z++)for(let y=0;y<40;y++)for(let x=42;x<54;x++)
    if(!((x+y+z)&1))for(let c=0;c<NMOV;c++)if(w._link3_sst(x,y,z,c)===3)est++;
  return est;
};
for(const hub of [64,128]){
  console.log(`--- hubRest=${hub} ---`);
  for(const NC of [2,4,6,8,10]){
    const est = await run(NC, hub, 10);
    console.log(`clients=${NC}: sessions=${est} per-client=${(est/NC).toFixed(1)}`);
  }
}
