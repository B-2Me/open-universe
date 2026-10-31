// qi3 phase sweep: bath density -> lump fraction, bond degree,
// level diversity. Characterize the hot<->cold transition so the
// crossover maps onto nature's freeze-out (structure forms when
// production rate falls below depletion rate).
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here, '../../docs/public/wasm/ember');
const src = readFileSync(join(DIR, 'qi3.js'), 'utf8');
const mk = () => (() => {
  const m = { exports: {} };
  new Function('module','exports','require','__dirname','__filename',src)(m, m.exports, require, DIR, 'qi3.js');
  return m.exports();
})();

const N = 32;
console.log('seeds   lumpFrac  avgDeg  lvlsAlive  maxLvl  meanWind');
for (const seeds of [110, 130, 150, 170, 200, 230, 260, 300]) {
  const q = await mk();
  q._qi3_init(N, N, N, 0); q._qi3_gap_mode(1);
  let rng = seeds * 7 + 13;
  const rnd = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff);
  for (let i = 0; i < seeds; i++) {
    const x = rnd()%N, y = rnd()%N, z = rnd()%N, c = rnd()%18;
    q._qi3_photon_set(x,y,z,c, 20+rnd()%60); q._qi3_photon_nu_set(x,y,z,c, 100+rnd()%156);
  }
  for (let t = 0; t < 200; t++) q._qi3_tick();
  let lumps=0, edges=0, windTot=0, lvls={};
  for (let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    if(!q._qi3_mass_get(x,y,z))continue;
    lumps++;
    let w=0;
    for(let e=0;e<9;e++){ if(q._qi3_session_state(x,y,z,e*2)===2)edges++; }
    for(let c=0;c<18;c++)w+=q._qi3_winding_get(x,y,z,c);
    windTot+=w;
    lvls[Math.min(1+Math.floor(w/256),8)]=1;
  }
  const maxLvl = Math.max(...Object.keys(lvls).map(Number), 0);
  console.log(`${String(seeds).padStart(6)}  ${(lumps/N**3).toFixed(3)}     ${(edges/Math.max(lumps,1)).toFixed(2)}    ${Object.keys(lvls).length}          ${maxLvl}       ${(windTot/Math.max(lumps,1)).toFixed(0)}`);
}
