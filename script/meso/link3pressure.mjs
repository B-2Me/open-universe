// link3pressure: radiation pressure — a LIGHT absorber vs a heavy
// photon beam. Does the lump get pushed? centroid drift +x.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
for(const[tag,beam]of[['beam',12],['no beam',-1]]){
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(96,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(8);w._link3_phot(5);w._link3_drain_edge(2);w._link3_egate(16);w._link3_recoil(1);
  // small light lump wound -x (accepts +x offers), rest=16
  for(let z=6;z<10;z++)for(let y=6;y<10;y++)for(let x=28;x<32;x++)
    if(!((x+y+z)&1)){ w._link3_set(x,y,z,REST,64); w._link3_rset(x,y,z,13,96); }
  w._link3_ev_reset();
  for(let t=0;t<150;t++){
    if(beam>=0)for(let z=6;z<10;z++)for(let y=6;y<10;y++)for(let x=6;x<12;x++)
      if(!((x+y+z)&1))w._link3_phset(x,y,z,12,48);
    w._link3_tick();
  }
  let phl=0;
  for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=12;x<60;x++){
    if((x+y+z)&1)continue;
    for(let c=0;c<NMOV;c++)phl+=w._link3_phget(x,y,z,c);}
  let pev=0,pod=0,px=[];
  for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=12;x<60;x++){
    if((x+y+z)&1){for(let c=0;c<NMOV;c++)pod+=w._link3_phget(x,y,z,c);}
    else{for(let c=0;c<NMOV;c++)pev+=w._link3_phget(x,y,z,c);}}
  for(let x=12;x<60;x++){let col=0;
    for(let z=0;z<16;z++)for(let y=0;y<16;y++)
      for(let c=0;c<NMOV;c++)col+=w._link3_phget(x,y,z,c);
    if(col)px.push(`${x}:${col}`);}
  console.log(`corridor=${phl} even=${pev} odd=${pod}`);
  console.log(`columns: ${px.slice(0,20).join(' ')}`);
  let cx=0,m=0;
  for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=0;x<96;x++){
    if((x+y+z)&1)continue;let v=w._link3_rest(x,y,z);
    for(let c=0;c<NMOV;c++)v+=w._link3_drest(x,y,z,c);
    m+=v;cx+=v*x;}
  let mx=0;
  for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=0;x<96;x++){
    if((x+y+z)&1)continue;let v=w._link3_rest(x,y,z);
    for(let c=0;c<NMOV;c++)v+=w._link3_drest(x,y,z,c);
    if(v>mx)mx=v;}
  console.log(`${tag}: mass=${m} cx=${(cx/Math.max(1,m)).toFixed(1)} maxsite=${mx} absorb=${w._link3_ev(7)} conv=${w._link3_ev(8)}`);
}
