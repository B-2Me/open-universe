// link3ring: a painted closed loop — sites arranged in a diamond,
// each wound toward the next in the ring. Does mass circulate?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
w._link3_init(48,24,24,1);
const NMOV=w._link3_nch()-1,REST=NMOV;
w._link3_friction(32);w._link3_emit(0);w._link3_phot(0);w._link3_drain_edge(0);w._link3_egate(0);
// diamond loop on the xy diagonals at z=12:
// (24,12)->(26,14)->(24,16)->(22,14)-> back to (24,12)
// channels: 0={1,1,0} 1={-1,-1,0} 2={1,-1,0} 3={-1,1,0}
const ring=[[24,12,12,0],[26,14,12,1],[24,16,12,2],[22,14,12,3]];
// each site wound toward the NEXT site in the ring
const dirs=[0,1,2,3]; // diamond channel sequence
for(let i=0;i<4;i++){
  const [x,y,z,c]=ring[i];
  // wind toward next site — channel mapping may need the opposite convention; test both
  w._link3_set(x,y,z,REST,64);
  w._link3_rset(x,y,z,c,200);
}
// also fill the gap sites of the ring for continuity
for(let t=0;t<100;t++)w._link3_tick();
// measure: did the mass stay on the ring or disperse?
let ringMass=0,farMass=0;
for(let z=0;z<24;z++)for(let y=0;y<24;y++)for(let x=0;x<48;x++){
  if((x+y+z)&1)continue;
  let v=w._link3_rest(x,y,z);for(let c=0;c<NMOV;c++)v+=w._link3_drest(x,y,z,c);
  const onRing=ring.some(([rx,ry,rz])=>Math.abs(x-rx)<4&&Math.abs(y-ry)<4&&z===rz);
  if(onRing)ringMass+=v;else farMass+=v;
}
console.log(`ring mass=${ringMass} outside=${farMass}`);
// and the drest on each ring site — is it circulating (moving between sites)?
for(const[x,y,z,c]of ring){
  const ds=[];for(let cc=0;cc<NMOV;cc++){const v=w._link3_drest(x,y,z,cc);if(v)ds.push(`c${cc}:${v}`);}
  console.log(`  site(${x},${y}) drest: ${ds.join(' ')}`);
}
