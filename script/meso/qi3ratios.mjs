// qi3 ratio battery — dimensionless physics checks on the new
// mechanics: 1/r^2 flux dilution, 1/nu range, E=mc^2 fusion,
// conservation.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const DIR = join(process.cwd(), 'docs/public/wasm/ember');
const src = readFileSync(join(DIR, 'qi3.js'), 'utf8');
const mk = () => (() => {
  const m = { exports: {} };
  new Function('module','exports','require','__dirname','__filename',src)(m, m.exports, require, DIR, 'qi3.js');
  return m.exports();
})();
const N = 32;
// --- 1/r^2: photon flux vs distance from a point source ---
const q1 = await mk();
q1._qi3_init(N, N, N, 0); q1._qi3_gap_mode(1);
for (let t = 0; t < 40; t++) {
  // steady spherical-ish source at center, all 18 channels
  for (let c = 0; c < 18; c++) { q1._qi3_photon_set(16,16,16,c,10); q1._qi3_photon_nu_set(16,16,16,c,64); }
  q1._qi3_tick();
}
console.log('--- 1/r^2: mean photon flux per cell by distance (approx) ---');
const rings = {};
for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  const dx=x-16,dy=y-16,dz=z-16,d2=dx*dx+dy*dy+dz*dz;
  if(d2<4||d2>500)continue;
  const r=Math.round(Math.sqrt(d2));if(r<3||r>12)continue;
  let f=0;for(let c=0;c<18;c++)f+=q1._qi3_photon_get(x,y,z,c);
  rings[r]=(rings[r]||[]);rings[r].push(f);
}
for(let r=3;r<=12;r++){
  if(!rings[r])continue;
  const m=rings[r].reduce((a,b)=>a+b)/rings[r].length;
  console.log(`  r=${String(r).padStart(2)}  mean-flux=${m.toFixed(2)}  flux*r^2=${(m*r*r).toFixed(1)}`);
}
// --- 1/nu range: inject same count at several nu, how far do they get? ---
const q2 = await mk();
q2._qi3_init(N, N, N, 0); q2._qi3_gap_mode(1);
console.log('--- 1/nu range: distance traveled before decay ---');
for (const nu of [32, 64, 128, 192]) {
  const q3 = await mk();
  q3._qi3_init(N, N, N, 0); q3._qi3_gap_mode(1);
  q3._qi3_photon_set(4, 16, 16, 12, 1000); q3._qi3_photon_nu_set(4, 16, 16, 12, nu);
  for (let t = 0; t < 60; t++) q3._qi3_tick();
  let maxX = 0;
  for (let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++)
    if (q3._qi3_photon_get(x,y,z,12)) maxX = Math.max(maxX, x);
  const range = maxX - 4;
  console.log(`  nu=${String(nu).padStart(3)}  range=${range}  range*nu=${range*nu}`);
}
// --- E=mc^2: fusion deposit vs photon energy in ---
const q4 = await mk();
q4._qi3_init(N, N, N, 0); q4._qi3_gap_mode(1);
q4._qi3_photon_set(16, 14, 16, 0, 100); q4._qi3_photon_nu_set(16, 14, 16, 0, 200);
q4._qi3_photon_set(16, 18, 16, 1, 100); q4._qi3_photon_nu_set(16, 18, 16, 1, 200);
q4._qi3_tick(); q4._qi3_tick(); q4._qi3_tick();
console.log('--- fusion: mass/charge deposited vs photon E in ---');
console.log(`  mass=${q4._qi3_mass_get(16,16,16)}  charge=${q4._qi3_charge_get(16,16,16)}  (Ein=100*400=40000)`);
