// gradients (E69): probe the collapsed ends — nu spectrum, parity, Q register
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso3i.js'), 'utf8');
const mod = { exports: {} };
const load=async()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso3i.js');return m.exports();};

// 1. nu spectrum: does a hot (nu=4) lump differ from a cold (nu=1) lump
//    as the source of emitted photons? (spectral gradient)
for (const nu of [1,4]) {
  const w = await load();
  const W=48,H=24,D=24;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);w._meso3i_phot(7);
  for(let z=8;z<16;z++)for(let y=8;y<16;y++)for(let x=16;x<32;x++)
    if(!((x+y+z)&1)){ w._meso3i_set(x,y,z,REST,64); w._meso3i_eset(x,y,z,200); }
  for(let t=0;t<100;t++){ w._meso3i_drain_edge(4); w._meso3i_tick(); }
  const spec=[0,0,0,0];
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if((x+y+z)&1)continue;
    for(let c=0;c<18;c++)for(let n2=1;n2<=4;n2++) spec[n2-1]+=w._meso3i_phget_nu(x,y,z,c,n2);
  }
  console.log(`nu-spectrum (iE=200 lump): emitted bins=[${spec.join(',')}]`);
}

// 2. parity: seed mass preferentially on one parity — does it behave differently?
for (const par of [0,1]) {
  const w = await load();
  const W=48,H=24,D=24;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);w._meso3i_phot(0);
  let seed=0;
  for(let z=8;z<16;z++)for(let y=8;y<16;y++)for(let x=16;x<32;x++){
    if(((x+y+z)&1)===par) continue;   /* only one parity gets mass */
    w._meso3i_set(x,y,z,REST,64); seed+=64;
  }
  for(let t=0;t<100;t++){ w._meso3i_drain_edge(4); w._meso3i_tick(); }
  w._meso3i_rg_refresh();
  console.log(`parity=${par} seed=${seed}: rest=${w._meso3i_rest_mass()} mov=${w._meso3i_mov_mass()}`);
}

// 3. Q register: does the bound-state ledger hold/release quanta?
{
  const w = await load();
  const W=48,H=24,D=24;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);w._meso3i_phot(0);
  if(w._meso3i_qcap) w._meso3i_qcap(8);   /* enable Q capture if exported */
  for(let z=8;z<16;z++)for(let y=8;y<16;y++)for(let x=16;x<32;x++)
    if(!((x+y+z)&1)) w._meso3i_set(x,y,z,0,64);
  const out=[];
  for(let t=0;t<200;t++){
    w._meso3i_drain_edge(4); w._meso3i_tick();
    if(t%50===0){w._meso3i_rg_refresh();out.push(`t${t}:rest=${w._meso3i_rest_mass()} q=${w._meso3i_ev(3)}`);}
  }
  w._meso3i_rg_refresh();
  console.log(`qregister: ${out.join(' | ')}`);
}
