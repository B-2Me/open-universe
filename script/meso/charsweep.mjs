// charsweep (E110): characterization — each flag ON vs OFF on the same
// lump+bath regime. Does each mechanic produce its designed delta?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
const run=async(flags)=>{
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
  const W=32,H=16,D=16;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
  w._meso3i_phot(9); w._meso3i_scatter(128);
  for(const [f,v] of Object.entries(flags)) if(w['_meso3i_'+f]) w['_meso3i_'+f](v);
  for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=12;x<20;x++)
    if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,64);
  w._meso3i_ev_reset();
  for(let t=0;t<200;t++){
    if(t%4===0)for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=8;x<26;x++)
      if(!((x+y+z)&1)) w._meso3i_phset(x,y,z,12,16);
    w._meso3i_drain_edge(3); w._meso3i_tick();
  }
  w._meso3i_rg_refresh();
  return {rest:w._meso3i_rest_mass(),phn:w._meso3i_photons(),park:w._meso3i_ev(0),emit:w._meso3i_ev(2),fuse:w._meso3i_ev(7),drain:w._meso3i_ev(8)};
};
const cases=[
  ['baseline',{}],
  ['massbnc=1',{massbnc:1}],
  ['iget=32',{iget:32}],
  ['egate=8',{egate:8}],
  ['egate=-8',{egate:-8}],
  ['photdecay=8',{photdecay:8}],
  ['linkcap=4',{linkcap:4}],
  ['lens=-8',{lens:-8}],
  ['lens=8',{lens:8}],
  ['iepush=8',{iepush:8}],
];
const base=await run({});
for(const [tag,fl] of cases){
  const r=tag==='baseline'?base:await run(fl);
  const d=tag==='baseline'?'':` Δrest=${r.rest-base.rest} Δemit=${r.emit-base.emit} Δfuse=${r.fuse-base.fuse}`;
  console.log(`${tag}: rest=${r.rest} emit=${r.emit} fuse=${r.fuse} drain=${r.drain}${d}`);
}
