// spinspin (E82): ferromagnetic question — two WOUND lumps, aligned vs
// anti-aligned winding. Does spin exchange couple them differently?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
for (const mode of ['aligned','anti','control']) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
  const W=48,H=16,D=16;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
  w._meso3i_phot(9); w._meso3i_scatter(128);
  // two lumps at x=10 and x=30 — wound on ch12 (+x) or ch13 (-x)
  const wind=(xL,c)=>{for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=xL;x<xL+6;x++)
    if(!((x+y+z)&1)) w._meso3i_set(x,y,z,c,64);};
  // wait — winding is drest, not mass — seed rest + direction
  const seed=(xL,c)=>{for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=xL;x<xL+6;x++)
    if(!((x+y+z)&1)){ w._meso3i_set(x,y,z,REST,32); if(c>=0) w._meso3i_drest && w._meso3i_drest(1); }};
  // wind left lump +x (ch12 drest); right lump: aligned=ch12, anti=ch13
  const cL = 12, cR = mode==='anti' ? 13 : 12;
  for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=10;x<16;x++)
    if(!((x+y+z)&1)) { w._meso3i_set(x,y,z,REST,32); w._meso3i_dset(x,y,z,cL,64); }
  for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=30;x<36;x++)
    if(!((x+y+z)&1)) { w._meso3i_set(x,y,z,REST,32); if(mode!=='control')w._meso3i_dset(x,y,z,cR,64); }
  const out=[];
  for(let t=0;t<200;t++){
    w._meso3i_drain_edge(3); w._meso3i_tick();
    if(t%50===0){w._meso3i_rg_refresh();out.push(`t${t}:rest=${w._meso3i_rest_mass()}`);}
  }
  w._meso3i_rg_refresh();
  console.log(`${mode}: ${out.join(' | ')}`);
}
