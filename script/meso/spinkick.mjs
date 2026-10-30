// spinkick (E104): does a wound lump's iepush emit directionally?
// Wind one lump's drest on +x, fund it with iE, measure the emitted
// mass channel histogram — directional if the winding transfers.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso3i.js'), 'utf8');
const mod = { exports: {} };
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso3i.js');return m.exports();})();
const W=48,H=24,D=24;
w._meso3i_init(W,H,D,1);
const NMOV=w._meso3i_nch()-1,REST=NMOV;
w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
w._meso3i_phot(0); w._meso3i_iepush(4);
// wound lump: rest + iE funded + drest wound on +x (channel 12)
for(let z=8;z<16;z++)for(let y=8;y<16;y++)for(let x=16;x<32;x++)
  if(!((x+y+z)&1)){ w._meso3i_set(x,y,z,REST,32); w._meso3i_eset(x,y,z,200);
                   w._meso3i_rset(x,y,z,12,32); }
w._meso3i_ev_reset();
for(let t=0;t<60;t++){ w._meso3i_tick(); }
// count moving mass by channel anywhere on the grid
const chs=new Array(NMOV).fill(0);
for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  if((x+y+z)&1)continue;
  for(let c=0;c<NMOV;c++)chs[c]+=w._meso3i_get(x,y,z,c);}
const tot=chs.reduce((a,b)=>a+b,0)||1;
console.log(`emit ch12(+x)=${chs[12]} ch13(-x)=${chs[13]} rest=${w._meso3i_rest_mass()} | top=${Math.max(...chs)} (${(100*Math.max(...chs)/tot).toFixed(0)}% on peak ch)`);
