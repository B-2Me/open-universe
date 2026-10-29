// clot-phase (E63): is the corridor clot physical saturation or runaway?
// Counter-beam photons + scatter -> fusion -> mass plug. Sweep scatter x feed.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso3i.js'), 'utf8');
const mod = { exports: {} };
for (const sc of [0, 64, 128, 255]) {
  for (const feed of [4, 16]) {
    const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso3i.js');return m.exports();})();
    const W=48,H=24,D=24;
    w._meso3i_init(W,H,D,1);
    const NMOV=w._meso3i_nch()-1,REST=NMOV;
    w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
    w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
    w._meso3i_phot(9); w._meso3i_scatter(sc);
    const s=[];
    for(let t=0;t<400;t++){
      if(t%4===0)for(let z=6;z<18;z++)for(let y=6;y<18;y++)for(let x=16;x<40;x++){
        if(!((x+y+z)&1)){ w._meso3i_phset_nu(x,y,z,13,1,feed);
                          w._meso3i_phset_nu(x,y,z,12,1,feed); }
      }
      w._meso3i_drain_edge(4); w._meso3i_tick();
      if(t%80===0){w._meso3i_rg_refresh();s.push(w._meso3i_rest_mass());}
    }
    w._meso3i_rg_refresh();
    console.log(`scatter=${sc} feed=${feed}: rest ${s.join(' -> ')} -> ${w._meso3i_rest_mass()}`);
  }
}

// E63b: is the saturated clot CHARGED (iE inside) or a dead mass plug?
for (const sc of [128]) {
  const w2 = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso3i.js');return m.exports();})();
  const W=48,H=24,D=24;
  w2._meso3i_init(W,H,D,1);
  const NMOV=w2._meso3i_nch()-1,REST=NMOV;
  w2._meso3i_collmode(0);w2._meso3i_friction(8);w2._meso3i_fricmode(4);
  w2._meso3i_fricp(128);w2._meso3i_drest(1);w2._meso3i_reflect(0);
  w2._meso3i_phot(9); w2._meso3i_scatter(sc);
  for(let t=0;t<400;t++){
    if(t%4===0)for(let z=6;z<18;z++)for(let y=6;y<18;y++)for(let x=16;x<40;x++){
      if(!((x+y+z)&1)){ w2._meso3i_phset_nu(x,y,z,13,1,16); w2._meso3i_phset_nu(x,y,z,12,1,16); }
    }
    w2._meso3i_drain_edge(4); w2._meso3i_tick();
  }
  let ie=0,mr=0; for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=16;x<40;x++)
    if(!((x+y+z)&1)){ ie+=w2._meso3i_eget(x,y,z); }
  w2._meso3i_rg_refresh();
  console.log(`clot sc=${sc}: iE_total=${ie} rest=${w2._meso3i_rest_mass()} phn=${w2._meso3i_photons()}`);
}
