// link3tri: the peer triplet — 3 lumps in a tight triangle at
// mutual exchange range. Do all three pair-links form sessions?
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
w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
w._link3_ieburst(160);w._link3_egate(16);w._link3_phspread(96);w._link3_dwell(4);
// triangle: A(20,12) B(28,12) C(24,19) — pairwise gap ~7-8
const lumps=[[21,12,12,[0,2]],[27,12,12,[1,7]],[24,17,12,[9,10]]];
for(const[cx,cy,cz,winds]of lumps)
  for(let dz=-1;dz<2;dz++)for(let dy=-1;dy<2;dy++)for(let dx=-1;dx<2;dx++)
    if(!((cx+dx+cy+dy+cz+dz)&1)){
      w._link3_set(cx+dx,cy+dy,cz+dz,REST,64);
      w._link3_eset(cx+dx,cy+dy,cz+dz,160);
      for(const c of winds)w._link3_rset(cx+dx,cy+dy,cz+dz,c,96);
    }
for(let t=0;t<200;t++)w._link3_tick();
// sessions between each pair (rough regions)
const pair=(xa,xb,ya,yb)=>{let n=0;
  for(let z=0;z<24;z++)for(let y=ya;y<yb;y++)for(let x=xa;x<xb;x++)
    if(!((x+y+z)&1))for(let c=0;c<NMOV;c++)if(w._link3_sst(x,y,z,c)===3)n++;
  return n;};
console.log(`A-B gap: ${pair(20,28,10,15)}`);
console.log(`A-C gap: ${pair(20,25,13,19)}`);
console.log(`B-C gap: ${pair(24,29,13,19)}`);
