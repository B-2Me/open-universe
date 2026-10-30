// stimrate (E109): per-tick emission rate on a big parked reservoir —
// dark vs charged lump, does iE lift the rate where the roll gates?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso3i.js'), 'utf8');
const mod = { exports: {} };
for (const [tag,iE] of [['dark',0],['charged',240]]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso3i.js');return m.exports();})();
  const W=32,H=16,D=16;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(64);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
  w._meso3i_phot(5);
  // big lump — 2k parked quanta
  for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=12;x<20;x++)
    if(!((x+y+z)&1)){ w._meso3i_set(x,y,z,REST,255); if(iE)w._meso3i_eset(x,y,z,iE); }
  w._meso3i_ev_reset();
  // measure per-tick emission over 50 ticks
  const rates=[];
  let prev=0;
  for(let t=0;t<50;t++){
    w._meso3i_tick();
    const ev=w._meso3i_ev(2);
    if(t%10===9){rates.push(ev-prev);prev=ev;}
  }
  console.log(`${tag}: emits/10tick=[${rates.join(',')}] avg=${(rates.reduce((a,b)=>a+b)/rates.length).toFixed(0)}`);
}
