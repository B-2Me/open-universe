// link3duplex: the duplex signal — does a link carrying a stream
// congest in its direction while the antipodal link stays free?
// Opposing beams through the same region: measure up/dn load asym.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
w._link3_init(48,16,16,1);
const NMOV=w._link3_nch()-1,REST=NMOV;
w._link3_friction(0);w._link3_emit(0);w._link3_phot(0);w._link3_drain_edge(2);
// ONE-WAY beam +x through the middle — the wire should load +x only
for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=4;x<10;x++)
  if(!((x+y+z)&1))w._link3_set(x,y,z,12,96);
for(let t=0;t<40;t++)w._link3_tick();
// measure link load +x vs -x at the midpoint
let up=0,dn=0,upx=[],dnx=[];
for(let x=12;x<40;x++){
  let u=0,d=0;for(let z=5;z<11;z++)for(let y=5;y<11;y++){
    if((x+y+z)&1)continue;
    u+=w._link3_load(x,y,z,12);d+=w._link3_load(x,y,z,13);}
  upx.push(u);dnx.push(d);
}
console.log(`up(+x)  loads: ${upx.join(',')}`);
console.log(`dn(-x)  loads: ${dnx.join(',')}`);
