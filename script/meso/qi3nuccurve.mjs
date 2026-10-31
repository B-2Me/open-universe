// qi3 nucleation curve: fine-rho sigmoid, nu=128 kinematic wall,
// ticks-to-first-fusion (ev23) as the rate inside the probability.
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

const N = 32, RESTARTS = 6, TICKS = 120;
const run = async (rho, nu, seed) => {
  const q = await mk();
  q._qi3_init(N, N, N, 0); q._qi3_gap_mode(1);
  let rng = seed;
  const rnd = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff);
  const nj = Math.round(rho * N * N * N / 2);
  for (let i = 0; i < nj; i++) {
    let x, y, z;
    do { x=rnd()%N; y=rnd()%N; z=rnd()%N; } while ((x+y+z)&1);
    const c = rnd()%18;
    q._qi3_photon_set(x,y,z,c, 20); q._qi3_photon_nu_set(x,y,z,c, nu);
  }
  let firstFuse = -1;
  for (let t = 0; t < TICKS; t++) {
    q._qi3_tick();
    if (firstFuse < 0 && Number(q._qi3_event(23)) > 0) firstFuse = t;
  }
  let lumps = 0;
  for (let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++)
    if (q._qi3_mass_get(x,y,z)) lumps++;
  return { ignited: lumps > N*N, firstFuse };
};

console.log('--- rho sigmoid at nu=200 ---');
for (const rho of [0.005, 0.008, 0.012, 0.016, 0.020, 0.025, 0.030]) {
  let ign = 0, fuseTicks = [];
  for (let r = 0; r < RESTARTS; r++) {
    const { ignited, firstFuse } = await run(rho, 200, 3000 + r * 7919 + rho * 1e6);
    if (ignited) ign++;
    if (firstFuse >= 0) fuseTicks.push(firstFuse);
  }
  const tf = fuseTicks.length ? (fuseTicks.reduce((a,b)=>a+b)/fuseTicks.length).toFixed(1) : '-';
  console.log(`rho=${rho}  ignite=${ign}/${RESTARTS} (${(ign/RESTARTS).toFixed(2)})  meanFuseTick=${tf}`);
}
console.log('--- nu wall at rho=0.05 ---');
for (const nu of [100, 120, 127, 128, 140, 200]) {
  let ign = 0, fuseTicks = [];
  for (let r = 0; r < RESTARTS; r++) {
    const { ignited, firstFuse } = await run(0.05, nu, 5000 + r * 7919 + nu);
    if (ignited) ign++;
    if (firstFuse >= 0) fuseTicks.push(firstFuse);
  }
  const tf = fuseTicks.length ? (fuseTicks.reduce((a,b)=>a+b)/fuseTicks.length).toFixed(1) : '-';
  console.log(`nu=${nu}  ignite=${ign}/${RESTARTS} (${(ign/RESTARTS).toFixed(2)})  meanFuseTick=${tf}`);
}
