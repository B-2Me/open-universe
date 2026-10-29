// battery (E57): iE as energy storage — charge curve, capacity, discharge.
// Lump seeded; photon feed ON for TCHARGE ticks then OFF; iE sampled.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso3i.js'), 'utf8');
const mod = { exports: {} };
const TCH = Number(process.argv[2] || 150);   /* charge ticks */
const FEED = Number(process.argv[3] || 8);    /* photons/ch/feed */
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso3i.js');return m.exports();})();
const W=48,H=24,D=24;
w._meso3i_init(W,H,D,1);
const NMOV=w._meso3i_nch()-1,REST=NMOV;
w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
w._meso3i_phot(5); w._meso3i_erate(7);        /* absorb->iE, A21 decay */
for(let z=8;z<16;z++)for(let y=8;y<16;y++)for(let x=16;x<32;x++)
  if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,64);   /* the lump */
const ie=()=>{let s=0;for(let z=8;z<16;z++)for(let y=8;y<16;y++)for(let x=16;x<32;x++)
  if(!((x+y+z)&1)) s+=w._meso3i_eget(x,y,z); return s;};
const out=[];
for(let t=0;t<400;t++){
  if(t<TCH&&t%2===0)for(let z=8;z<16;z++)for(let y=8;y<16;y++){
    if(!((4+y+z)&1)) w._meso3i_phset_nu(4,y,z,12,1,FEED); }
  w._meso3i_drain_edge(4); w._meso3i_tick();
  if(t%25===0) out.push(`t${t}:${ie()}`);
}
console.log(`battery TCH=${TCH} feed=${FEED}: iE ${out.join(' ')}`);
