// forkmap (E75): which ends compete at shared junctions? Enable a rich
// regime and read which iEV branches fire — the contested forks show.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
const names=['park','pair','emit','qcap','annih','absorb','refl/bnc','fuse','drain','caploss'];
for (const [tag,cfg] of [
  ['baseline',      {fric:8,lens:0,sc:0,ie:0,ep:0,lc:0,an:0}],
  ['attract',       {fric:8,lens:-8,sc:0,ie:0,ep:0,lc:0,an:0}],
  ['pressure',      {fric:8,lens:8,sc:0,ie:0,ep:0,lc:0,an:0}],
  ['capture',       {fric:8,lens:0,sc:0,ie:0,ep:-8,lc:0,an:0}],
  ['full-regime',   {fric:8,lens:-8,sc:128,ie:1,ep:-8,lc:-4,an:64}],
]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
  const W=32,H=16,D=16;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(cfg.fric);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
  w._meso3i_phot(9); w._meso3i_scatter(cfg.sc); w._meso3i_iecost(cfg.ie);
  if(w._meso3i_iepush) w._meso3i_iepush(cfg.ep);
  if(w._meso3i_lens)   w._meso3i_lens(cfg.lens);
  if(w._meso3i_linkcap)w._meso3i_linkcap(cfg.lc);
  if(w._meso3i_annih)  w._meso3i_annih(cfg.an);
  for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=14;x<20;x++)
    if(!((x+y+z)&1)){ w._meso3i_set(x,y,z,REST,32); w._meso3i_set(x,y,z,12,16); }
  w._meso3i_ev_reset();
  for(let t=0;t<100;t++){
    if(t<20&&t%4===0)for(let z=4;z<8;z++)for(let y=3;y<6;y++)for(let x=3;x<6;x++)
      if(!((x+y+z)&1)) w._meso3i_set(x,y,z,12,8);
    w._meso3i_drain_edge(3); w._meso3i_tick();
  }
  w._meso3i_rg_refresh();
  const ev=[]; for(let i=0;i<10;i++){const v=Number(w._meso3i_ev(i));if(v)ev.push(`${names[i]}=${v}`);}
  console.log(`${tag}: rest=${w._meso3i_rest_mass()} | ${ev.join(' ')}`);
}
