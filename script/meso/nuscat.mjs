// nuscat (E72): spectral routing — hot photons flee density, cold trap.
// Mixed nu=1+nu=4 beam through a slab; measure per-nu transmission.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso3i.js'), 'utf8');
const mod = { exports: {} };
for (const ns of [0, 2]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso3i.js');return m.exports();})();
  const W=48,H=24,D=24,DETX=44;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0); w._meso3i_friction(8); w._meso3i_fricmode(16);
  w._meso3i_fricp(128); w._meso3i_drest(1); w._meso3i_reflect(0);
  w._meso3i_phot(0);   /* no absorb — pure routing test */
  w._meso3i_scatter(192);
  if (w._meso3i_nuscat) w._meso3i_nuscat(ns);
  // slab x in [16,32) rho=32
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=16;x<32;x++)
    if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,32);
  // mixed beam: nu=1 + nu=4 on +x at x in [4,6]
  let seeded1=0,seeded4=0;
  for(let z=4;z<20;z++)for(let y=4;y<20;y++)for(let x=4;x<6;x++)
    if(!((x+y+z)&1)){ w._meso3i_phset_nu(x,y,z,12,1,16); seeded1+=16;
                     w._meso3i_phset_nu(x,y,z,12,4,16); seeded4+=16; }
  const det=[0,0,0,0];
  for(let t=0;t<60;t++){
    w._meso3i_tick();
    for(let z=0;z<D;z++)for(let y=0;y<H;y++){
      if((DETX+y+z)&1)continue;
      for(let nu=1;nu<=4;nu++) det[nu-1]+=w._meso3i_phget_nu(DETX,y,z,12,nu); }
  }
  console.log(`nuscat=${ns}: T(nu1)=${(det[0]/seeded1).toFixed(3)} T(nu4)=${(det[3]/seeded4).toFixed(3)} det=[${det.join(',')}]`);
}
