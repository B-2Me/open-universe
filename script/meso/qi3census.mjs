// qi3 topology census + correlator on the genesis universe:
// do nucleated lumps cluster? Do adjacent-lump edge bonds exist?
// Does the exchange volley correlate (link3's -0.81 signature)?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here, '../../docs/public/wasm/ember');
const src = readFileSync(join(DIR, 'qi3.js'), 'utf8');
const q = await (() => {
  const m = { exports: {} };
  new Function('module','exports','require','__dirname','__filename',src)(m, m.exports, require, DIR, 'qi3.js');
  return m.exports();
})();
const N = 32;
q._qi3_init(N, N, N, 0); q._qi3_gap_mode(1);
let rng = 999;
const rnd = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff);
for (let i = 0; i < 3000; i++) {
  const x = rnd()%N, y = rnd()%N, z = rnd()%N, c = rnd()%18;
  q._qi3_photon_set(x,y,z,c, 20+rnd()%60); q._qi3_photon_nu_set(x,y,z,c, 100+rnd()%156);
}
for (let t = 0; t < 200; t++) q._qi3_tick();

// cluster census: count lumps, their bond-degree (how many live edges)
let lumps = 0, bondDeg = {}, edgesTot = 0;
for (let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  if (!q._qi3_mass_get(x,y,z)) continue;
  lumps++;
  let deg = 0;
  for (let e=0;e<9;e++) if (q._qi3_session_state(x,y,z,e*2)===2) deg++;
  bondDeg[deg] = (bondDeg[deg]||0)+1;
  edgesTot += deg;
}
console.log(`lumps: ${lumps}   live edges (total): ${edgesTot}   avg deg: ${(edgesTot/lumps).toFixed(2)}`);
console.log('bond-degree histogram (deg -> count):', JSON.stringify(bondDeg));

// spatial correlation: is a lump's neighbor more likely massive?
let adj=0, adjMass=0;
const CV=[[1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],[1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1],[2,0,0],[-2,0,0],[0,2,0],[0,-2,0],[0,0,2],[0,0,-2]];
const wr=(v,m)=>((v%m)+m)%m;
for (let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  if (!q._qi3_mass_get(x,y,z)) continue;
  for (const[dx,dy,dz]of CV){ adj++;
    if (q._qi3_mass_get(wr(x+dx,N),wr(y+dy,N),wr(z+dz,N))) adjMass++; }
}
const frac = adjMass/adj, rho = lumps/(N**3);
console.log(`neighbor mass fraction: ${frac.toFixed(3)} vs background ${rho.toFixed(3)} -> clustering ratio ${(frac/rho).toFixed(2)}`);
