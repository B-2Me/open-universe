// link3shellflux: integrated flux through a shell at radius R —
// does the broadcast field fall off measurably?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
w._link3_init(80,40,40,1);
const NMOV=w._link3_nch()-1,REST=NMOV;
w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(0);
w._link3_ieburst(160);w._link3_egate(0);w._link3_phspread(96);w._link3_dwell(1);
for(let z=17;z<23;z++)for(let y=17;y<23;y++)for(let x=37;x<43;x++)
  if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,128);w._link3_eset(x,y,z,255);}
for(let t=0;t<60;t++)w._link3_tick();
// count photons in spherical shells around (40,20,20)
const shell=(r)=>{let n=0;
  for(let z=0;z<40;z++)for(let y=0;y<40;y++)for(let x=0;x<80;x++){
    if((x+y+z)&1)continue;
    const d=Math.sqrt((x-40)**2+(y-20)**2+(z-20)**2);
    if(d>=r-1.5&&d<r+1.5)for(let c=0;c<NMOV;c++)n+=w._link3_phget(x,y,z,c);
  }return n;};
for(const r of [4,6,8,10,12,14]){
  const f=shell(r);
  console.log(`r=${r}: flux=${f}  flux*r^2=${(f*r*r).toFixed(0)}`);
}
