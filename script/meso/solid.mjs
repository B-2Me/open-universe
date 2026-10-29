// solid (E93): 2x2x2 cube of lumps — does the bond hold in 3D?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
const W=64,H=48,D=48;
w._meso3i_init(W,H,D,1);
const NMOV=w._meso3i_nch()-1,REST=NMOV;
w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
w._meso3i_phot(9); w._meso3i_scatter(128);
// 8 lumps: x in {16,40}, y in {12,28}, z in {14,30}
const out=[];
for(let t=0;t<200;t++){
  if(t===0)for(const px of [16,40])for(const py of [12,28])for(const pz of [14,30])
    for(let z=pz-2;z<pz+3;z++)for(let y=py-2;y<py+3;y++)for(let x=px-2;x<px+3;x++)
      if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,64);
  if(t===0)for(let z=4;z<D-4;z++)for(let y=4;y<H-4;y++)for(let x=4;x<W-4;x++)
    if(!((x+y+z)&1)){ w._meso3i_phset(x,y,z,12,6); w._meso3i_phset(x,y,z,13,6); }
  w._meso3i_tick();
  if(t%50===0){w._meso3i_rg_refresh();out.push(`t${t}:rest=${w._meso3i_rest_mass()} mov=${w._meso3i_mov_mass()}`);}
}
console.log(`solid: ${out.join(' | ')}`);
