// nuup (E101): inverse-Compton analog — cold photons gain nu crossing
// a hot (iE-charged) lump. Measure the transmitted nu spectrum.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso3i.js'), 'utf8');
const mod = { exports: {} };
for (const up of [0, 64]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso3i.js');return m.exports();})();
  const W=48,H=24,D=24,DETX=44;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
  w._meso3i_phot(0);   // no absorb — isolate the transit shift
  w._meso3i_nushift(0);
  if(w._meso3i_nuup) w._meso3i_nuup(up);
  // charged lump in the beam path — iE=200 each site
  for(let z=8;z<16;z++)for(let y=8;y<16;y++)for(let x=20;x<28;x++)
    if(!((x+y+z)&1)){ w._meso3i_set(x,y,z,REST,64); w._meso3i_eset(x,y,z,200); }
  // cold beam: nu=1 photons on +x channel
  for(let z=4;z<20;z++)for(let y=4;y<20;y++)for(let x=4;x<8;x++)
    if(!((x+y+z)&1)) w._meso3i_phset_nu(x,y,z,12,1,16);
  const det=[0,0,0,0];
  for(let t=0;t<50;t++){
    w._meso3i_tick();
    for(let z=0;z<D;z++)for(let y=0;y<H;y++){
      if((DETX+y+z)&1)continue;
      for(let nu=1;nu<=4;nu++) det[nu-1]+=w._meso3i_phget_nu(DETX,y,z,12,nu);
    }
  }
  console.log(`nuup=${up}: transmitted spectrum=[${det.join(',')}]`);
}
