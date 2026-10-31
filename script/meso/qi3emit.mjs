// qi3 emission spectrum: sites at different charge levels should
// emit at different converging gaps — level derived from charge.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here, '../../docs/public/wasm/ember');
const src = readFileSync(join(DIR, 'qi3.js'), 'utf8');

const CV = [[1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],
  [1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1],
  [2,0,0],[-2,0,0],[0,2,0],[0,-2,0],[0,0,2],[0,0,-2]];
const wrap=(v,m)=>((v%m)+m)%m;
const gaps = {192:2,228:3,240:4,246:5,249:6,251:7,252:8};

// winding sets the level now: n = 1 + (totalWinding >> 8).
// wind 1,4,8 channels to reach different levels; charge = fuel.
for (const windChans of [1, 4, 8, 16]) {
  const q = await (() => {
    const m = { exports: {} };
    new Function('module','exports','require','__dirname','__filename',src)(m, m.exports, require, DIR, 'qi3.js');
    return m.exports();
  })();
  q._qi3_init(32, 32, 32, 0);
  q._qi3_gap_mode(1);
  q._qi3_mass_set(16, 16, 16, 160);
  q._qi3_charge_set(16, 16, 16, 255);
  for (let c = 0; c < windChans; c++) q._qi3_winding_set(16, 16, 16, c, 400);
  const level = 1 + Math.floor(windChans * 400 / 256);
  for (let t = 0; t < 12; t++) q._qi3_tick();
  // census emitted photon nus in a 12-cell radius
  const hist = {};
  for (let z=4;z<28;z++)for(let y=4;y<28;y++)for(let x=4;x<28;x++)
    for(let c=0;c<18;c++){
      const ph=q._qi3_photon_get(x,y,z,c);
      if(ph){ const nu=q._qi3_photon_nu(x,y,z,c); hist[nu]=(hist[nu]||0)+ph; }
    }
  console.log(`winding on ${windChans} chans (level~${Math.min(level,8)}): emitted nu census=`,
    JSON.stringify(hist));
}
