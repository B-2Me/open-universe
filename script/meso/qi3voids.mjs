// qi3 void census — the defects ARE the particles: mobility,
// lifetime, healing (void + wound neighbor -> both normal =
// particle-hole annihilation), pairwise correlation.
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
q._qi3_init(N, N, N, 0); q._qi3_gap_mode(5);
let rng = 555;
const rnd = () => (rng = (rng*1103515245+12345)&0x7fffffff);
for (let i=0;i<30000;i++){
  const x=rnd()%N,y=rnd()%N,z=rnd()%N,c=rnd()%18;
  q._qi3_photon_set(x,y,z,c,20+rnd()%40); q._qi3_photon_nu_set(x,y,z,c,150+rnd()%100);
}
for (let t=0;t<200;t++) q._qi3_tick();   // saturate

const medW = () => {
  const ws=[];
  for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++)
    if(q._qi3_mass_get(x,y,z)){let w=0;for(let c=0;c<18;c++)w+=q._qi3_winding_get(x,y,z,c);ws.push(w);}
  ws.sort((a,b)=>a-b);return ws[ws.length>>1];
};
const voidMap = (med) => {
  const s=new Set();
  for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    if(!q._qi3_mass_get(x,y,z))continue;
    let w=0;for(let c=0;c<18;c++)w+=q._qi3_winding_get(x,y,z,c);
    if(w<med*0.5)s.add(x+','+y+','+z);
  }
  return s;
};
let prev = voidMap(medW());
console.log('tick  voids  born  healed  moved-ish  pairs(adjacent)');
for (let T=0;T<200;T+=25){
  const cur = voidMap(medW());
  let born=0,healed=0;
  for(const k of cur)if(!prev.has(k))born++;
  for(const k of prev)if(!cur.has(k))healed++;
  // adjacent void pairs (nearest-neighbor in x only for speed)
  let pairs=0;const vs=[...cur].map(k=>k.split(',').map(Number));
  for(let i=0;i<vs.length;i++)for(let j=i+1;j<vs.length;j++){
    const d=Math.abs(vs[i][0]-vs[j][0])+Math.abs(vs[i][1]-vs[j][1])+Math.abs(vs[i][2]-vs[j][2]);
    if(d<=2)pairs++;
  }
  console.log(`${String(200+T).padStart(3)}   ${String(cur.size).padStart(5)}  ${String(born).padStart(4)}  ${String(healed).padStart(5)}   —            ${pairs}`);
  prev=cur;
  for(let i=0;i<25;i++)q._qi3_tick();
}
