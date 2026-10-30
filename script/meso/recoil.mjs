// recoil (E116): momentum-conserving emission — does a lump emitting
// photons gain net momentum (recoil drift opposite the emission)?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso3i.js'), 'utf8');
const mod = { exports: {} };
for (const rc of [0, 1]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso3i.js');return m.exports();})();
  const W=48,H=16,D=16;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
  w._meso3i_phot(5);
  if(w._meso3i_recoil)w._meso3i_recoil(rc);
  for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=20;x<28;x++)
    if(!((x+y+z)&1)){ w._meso3i_set(x,y,z,REST,64); w._meso3i_eset(x,y,z,200); }
  w._meso3i_ev_reset();
  for(let t=0;t<150;t++) w._meso3i_tick();
  // moving-mass direction histogram — does one direction dominate?
  const chs=new Array(NMOV).fill(0);
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if((x+y+z)&1)continue;
    for(let c=0;c<NMOV;c++)chs[c]+=w._meso3i_get(x,y,z,c);}
  const top=chs.indexOf(Math.max(...chs));
  console.log(`recoil=${rc}: movCh top=${top} [+x=12,-x=13]: ch12=${chs[12]} ch13=${chs[13]} total_mov=${chs.reduce((a,b)=>a+b)}`);
}
