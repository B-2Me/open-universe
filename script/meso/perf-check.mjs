// perf-check: three-engine comparison — meso3i vs core vs perf.
// Perf must stay bitwise-identical (active-list skips empty cells only).
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const load = async (f) => {
  const src = readFileSync(join(here, `../../docs/public/wasm/ember/${f}`), 'utf8');
  const mod = { exports: {} };
  new Function('module','exports','require','__dirname','__filename',src)
    (mod, mod.exports, require, join(here,'../../docs/public/wasm/ember'), f);
  return mod.exports();
};
const w3 = await load('meso3i.js'), wc = await load('meso_core.js'), wp = await load('meso_perf.js');
const W=24,H=12,D=12;
for (const w of [w3,wc,wp]) {
  w._meso3i_init(W,H,D,7);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0); w._meso3i_friction(8); w._meso3i_fricmode(16);
  w._meso3i_fricp(128); w._meso3i_drest && w._meso3i_drest(1);
  w._meso3i_reflect(0); w._meso3i_phot(5); w._meso3i_pair(0); w._meso3i_erate(7);
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=8;x<16;x++)
    if(!((x+y+z)&1)){ w._meso3i_set(x,y,z,REST,32); w._meso3i_set(x,y,z,12,8); }
}
let div=-1;
for(let t=0;t<40;t++){
  w3._meso3i_tick(); wc._meso3i_tick(); wp._meso3i_tick();
  w3._meso3i_rg_refresh();
  const r3=w3._meso3i_rest_mass(),m3=w3._meso3i_mov_mass(),p3=w3._meso3i_photons();
  const rc=wc._meso3i_rest_mass(),mc=wc._meso3i_mov_mass(),pc=wc._meso3i_photons();
  const rp=wp._meso3i_rest_mass(),mp=wp._meso3i_mov_mass(),pp=wp._meso3i_photons();
  if(r3!==rp||m3!==mp||p3!==pp){div=t;
    console.log(`t${t}: meso3i ${r3}/${m3}/${p3} | core ${rc}/${mc}/${pc} | perf ${rp}/${mp}/${pp}`);break;}
}
console.log(div<0?'PARITY: perf bitwise-identical 40 ticks':`perf diverged at ${div}`);
for(const [w,name] of [[w3,'meso3i'],[wc,'core'],[wp,'perf']]){
  const t0=Date.now(); for(let t=0;t<100;t++) w._meso3i_tick();
  console.log(`${name}: ${Date.now()-t0}ms /100t`);
}
