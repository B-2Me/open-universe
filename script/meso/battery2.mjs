// battery2 (E58): does charged iE mobilize mass? Charge the lump hard,
// cut feed, watch mov_mass — does stored energy deploy into motion?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso3i.js'), 'utf8');
const mod = { exports: {} };
const EC = Number(process.argv[2] || 0);
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso3i.js');return m.exports();})();
const W=48,H=24,D=24;
w._meso3i_init(W,H,D,1);
const NMOV=w._meso3i_nch()-1,REST=NMOV;
w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
w._meso3i_phot(5); w._meso3i_erate(7);
if(w._meso3i_iecost) w._meso3i_iecost(EC);
for(let z=8;z<16;z++)for(let y=8;y<16;y++)for(let x=16;x<32;x++)
  if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,64);
const ie=()=>{let s=0;for(let z=8;z<16;z++)for(let y=8;y<16;y++)for(let x=16;x<32;x++)
  if(!((x+y+z)&1)) s+=w._meso3i_eget(x,y,z); return s;};
const out=[];
for(let t=0;t<400;t++){
  if(t<150&&t%2===0)for(let z=8;z<16;z++)for(let y=8;y<16;y++){
    if(!((4+y+z)&1)) w._meso3i_phset_nu(4,y,z,12,1,8); }
  w._meso3i_drain_edge(4); w._meso3i_tick();
  if(t%50===0){w._meso3i_rg_refresh();out.push(`t${t}:iE=${ie()} mov=${w._meso3i_mov_mass()} rest=${w._meso3i_rest_mass()}`);}
}
console.log(`battery2 iecost=${EC}: ${out.join(' | ')}`);
