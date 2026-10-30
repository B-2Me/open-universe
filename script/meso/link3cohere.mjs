// link3cohere: does the session network make the cluster ONE body?
// Wind the cluster — does it move coherently or fall apart?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
for (const [tag,sess] of [['no session feed',0],['with sessions',1]]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(96,20,20,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
  w._link3_ieburst(160);w._link3_photdecay(96);w._link3_egate(16);
  const lumps=[[36,9,9],[28,9,9],[44,9,9],[36,4,9],[36,14,9]];
  for(const [cx,cy,cz] of lumps)
    for(let dz=-1;dz<2;dz++)for(let dy=-1;dy<2;dy++)for(let dx=-1;dx<2;dx++)
      if(!((cx+dx+cy+dy+cz+dz)&1)){
        w._link3_set(cx+dx,cy+dy,cz+dz,REST,64);
        w._link3_eset(cx+dx,cy+dy,cz+dz,160);
        w._link3_rset(cx+dx,cy+dy,cz+dz,12,96); // wind +x
      }
  if(sess)for(let t=0;t<80;t++){
    for(let z=5;z<14;z++)for(let y=5;y<16;y++)for(let x=26;x<48;x++)
      if(!((x+y+z)&1)){w._link3_phset(x,y,z,12,12);w._link3_phset(x,y,z,13,12);}
    w._link3_tick();
  }
  const cent=()=>{let m=0,sx=0,sy=0;
    for(let z=0;z<20;z++)for(let y=0;y<20;y++)for(let x=0;x<96;x++){
      if((x+y+z)&1)continue;let v=w._link3_rest(x,y,z);
      for(let c=0;c<NMOV;c++)v+=w._link3_drest(x,y,z,c);
      m+=v;sx+=v*x;sy+=v*y;}return m?[sx/m,sy/m]:[0,0];};
  const [x0,y0]=cent();
  for(let t=0;t<150;t++)w._link3_tick();
  const [x1,y1]=cent();
  // cluster spread — did it stay coherent or scatter?
  let spread=0,n=0;
  for(let z=0;z<20;z++)for(let y=0;y<20;y++)for(let x=0;x<96;x++){
    if((x+y+z)&1)continue;let v=w._link3_rest(x,y,z);
    for(let c=0;c<NMOV;c++)v+=w._link3_drest(x,y,z,c);
    if(v>0){spread+=Math.abs(x-x1)+Math.abs(y-y1);n+=v;}}
  console.log(`${tag}: drift x=${(x1-x0).toFixed(1)} spread=${n?(spread/n).toFixed(1):0} rest=${w._link3_rest_mass()}`);
}
