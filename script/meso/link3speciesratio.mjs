// link3speciesratio: species line+mass census — do our ν ratios
// land on real spectral/hadron ratios?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const run = async (wind, ie) => {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(48,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(0);w._link3_phot(0);w._link3_drain_edge(0);
  w._link3_egate(0);w._link3_dwell(1);
  for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=20;x<28;x++)
    if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,ie);w._link3_rset(x,y,z,wind,96);}
  w._link3_tick();
  const nu=w._link3_snu(24,8,8);
  let mass=0;
  for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=0;x<48;x++){
    if((x+y+z)&1)continue;let v=w._link3_rest(x,y,z);
    for(let c=0;c<NMOV;c++)v+=w._link3_drest(x,y,z,c);mass+=v;}
  return {nu,mass};
};
console.log('wind iE | nu | mass');
const species=[];
for(const[wind,ie]of[[12,0],[12,40],[12,80],[12,160],[0,160],[4,160],[8,160],[16,160],[13,160],[14,160]]){
  const r=await run(wind,ie);
  species.push({wind,ie,...r});
  console.log(`${wind} ${ie} | nu=${r.nu} mass=${r.mass}`);
}
