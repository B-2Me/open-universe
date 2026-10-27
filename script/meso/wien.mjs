// wien (E31): do hotter sites emit higher-nu photons? (Wien law)
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
const W=24,H=12,D=12;
let NMOV,REST;   // nch is garbage before init — compute inside run
const run=(exc)=>{
  w._meso3i_init(W,H,D,1); NMOV=w._meso3i_nch()-1; REST=NMOV; w._meso3i_collmode(0); w._meso3i_friction(0);
  w._meso3i_fricmode(-500); w._meso3i_drest(0); w._meso3i_reflect(0);
  w._meso3i_phot(7);
  // sparse excited field: isolated sites, photons emit into vacuum
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if((x+y+z)&1)continue;
    w._meso3i_set(x,y,z,REST,4); w._meso3i_eset(x,y,z,exc);   // thin mass so photons escape
  }
  for(let t=0;t<8;t++) w._meso3i_tick();
  const spec=[0,0,0,0];
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if((x+y+z)&1)continue;
    for(let c=0;c<NMOV;c++)for(let nu=1;nu<=4;nu++) spec[nu-1]+=w._meso3i_phget_nu(x,y,z,c,nu);
  }
  const tot=spec.reduce((a,b)=>a+b,0), E=spec.reduce((a,b,i)=>a+b*(i+1),0);
  let esum=0; for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++)
    if(!((x+y+z)&1)) esum+=w._meso3i_eget(x,y,z);
  console.log(`n=${exc}: spectrum=[${spec.join(',')}] photons=${tot} IPHN=${w._meso3i_photons()} phenergy=${w._meso3i_phenergy()} nLeft=${esum}`);
};
console.log('E31 — Wien: hot vs cold emission spectrum');
run(2); run(20); run(100);
