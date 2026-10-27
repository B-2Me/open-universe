// hot-clock (E25): does a hot cavity clock dilate vs a cold one?
// Same E4 cavity + packet, but interior sites pre-loaded with n.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso3i.js'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'require', '__dirname', '__filename', src)
  (mod, mod.exports, require, join(here, '../../docs/public/wasm/ember'), 'meso3i.js');
const w = await mod.exports();
const W=48,H=48,D=48,C=24,NMOV=w._meso3i_nch()-1,REST=NMOV;
const run=(exc)=>{
  w._meso3i_init(W,H,D,1); w._meso3i_collmode(0); w._meso3i_friction(0);
  w._meso3i_fricmode(0); w._meso3i_drest(0); w._meso3i_reflect(0);
  w._meso3i_phot(exc?5:0);
  // cavity walls x=0/2 and x=44/46 + interior mass at density 1
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if((x+y+z)&1)continue;
    if(x<=2||x>=44) w._meso3i_set(x,y,z,REST,128);
    else { w._meso3i_set(x,y,z,REST,1); if(exc) w._meso3i_eset(x,y,z,exc); }
  }
  w._meso3i_set(C,C,C,0,10);   // packet on channel 0 (+x)
  const flips=[]; let dir=1;
  for(let t=0;t<400;t++){
    const before=w._meso3i_get(C,C,C,0);
    w._meso3i_drain_edge(3); w._meso3i_tick();
    const after=w._meso3i_get(C,C,C,0);
    if(after>before&&!flips.includes(t)) flips.push(t);
  }
  const hp=flips.length>1?((flips[flips.length-1]-flips[0])/(flips.length-1)).toFixed(1):'?';
  console.log(`n=${exc}: flips=[${flips.join(',')}] half-period=${hp}t`);
};
console.log('E25 — hot cavity clock: does excitation dilate the period?');
run(0); run(50); run(200);
