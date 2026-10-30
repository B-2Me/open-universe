// comove (E122): does the lump's iE now travel WITH the mass?
// Track where the charge sits relative to the lump's centroid.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso3i.js'), 'utf8');
const mod = { exports: {} };
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso3i.js');return m.exports();})();
const W=80,H=16,D=16;
w._meso3i_init(W,H,D,1);
const NMOV=w._meso3i_nch()-1,REST=NMOV;
w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
w._meso3i_phot(5);
for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=16;x<24;x++)
  if(!((x+y+z)&1)){ w._meso3i_set(x,y,z,REST,64); w._meso3i_eset(x,y,z,240); w._meso3i_rset(x,y,z,12,128); }
const centX=(f)=>{let m=0,sx=0;for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  if((x+y+z)&1)continue;const v=f(x,y,z);m+=v;sx+=v*x;}return m?sx/m:0;};
const out=[];
for(let t=0;t<150;t++){
  w._meso3i_tick();
  if(t%30===0)out.push(`t${t}:massX=${centX((x,y,z)=>w._meso3i_get(x,y,z,REST)+w._meso3i_rget(x,y,z,12)).toFixed(1)} chargeX=${centX((x,y,z)=>w._meso3i_eget(x,y,z)).toFixed(1)}`);
}
console.log(out.join(' | '));
