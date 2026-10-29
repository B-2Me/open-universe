// nuc-thresh (E96): nucleation phase boundary — sweep photon density,
// where do seeds cross the lump threshold?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
for (const feed of [32, 128, 255]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
  const W=48,H=32,D=16;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
  w._meso3i_phot(9); w._meso3i_scatter(128);
  if(w._meso3i_photdecay) w._meso3i_photdecay(32); if(w._meso3i_egate)w._meso3i_egate(8);
  for(let z=4;z<D-4;z++)for(let y=4;y<H-4;y++)for(let x=4;x<W-4;x++)
    if(!((x+y+z)&1)){ w._meso3i_phset(x,y,z,12,feed); w._meso3i_phset(x,y,z,13,feed); }
  const peaks=()=>{let n=0,mx=0,dT=0;for(let z=4;z<D-4;z++)for(let y=4;y<H-4;y++)for(let x=4;x<W-4;x++){
    if((x+y+z)&1)continue;let d=0;for(let c=0;c<NMOV;c++)d+=w._meso3i_rget(x,y,z,c);
    const v=w._meso3i_get(x,y,z,REST)+d;dT+=d;if(v>16)n++;if(v>mx)mx=v;}return[n,mx,dT];};
  const out=[];
  for(let t=0;t<150;t++){
    w._meso3i_tick();
    if(t%25===0){const[n,mx,dT]=peaks();out.push(`t${t}:pk=${n} mx=${mx} dT=${dT}`);}
  }
  console.log(`feed=${feed}: ${out.join(' | ')}`);
}
