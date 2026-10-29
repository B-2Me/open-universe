// loopaudit (E98): is the runaway recycling or amplifying?
// Track photon count vs total mass under each mechanic combination.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
for (const [tag,pd,eg] of [['pd-only',32,0],['eg-only',0,8],['pd+eg',32,8]]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
  const W=48,H=32,D=16;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
  w._meso3i_phot(9); w._meso3i_scatter(128);
  if(w._meso3i_photdecay) w._meso3i_photdecay(pd);
  if(w._meso3i_egate) w._meso3i_egate(eg);
  let seedPhn=0;
  for(let z=4;z<D-4;z++)for(let y=4;y<H-4;y++)for(let x=4;x<W-4;x++)
    if(!((x+y+z)&1)){ w._meso3i_phset(x,y,z,12,32); w._meso3i_phset(x,y,z,13,32); seedPhn+=64; }
  const out=[];
  for(let t=0;t<200;t++){
    w._meso3i_tick();
    if(t%50===0){
      w._meso3i_rg_refresh();
      let dT=0;for(let z=4;z<D-4;z++)for(let y=4;y<H-4;y++)for(let x=4;x<W-4;x++){
        if((x+y+z)&1)continue;
        let v=w._meso3i_get(x,y,z,REST);for(let c=0;c<NMOV;c++)v+=w._meso3i_rget(x,y,z,c);
        dT+=v;}
      out.push(`t${t}:phn=${w._meso3i_photons()} mass=${dT} tot=${w._meso3i_photons()+dT}`);
    }
  }
  console.log(`${tag}: seedPhn=${seedPhn} | ${out.join(' | ')}`);
}
