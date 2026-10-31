// void predictions P1-P4: lifetime tail, pair-binding vs null,
// mobility, co-annihilation. Track every void over 200t.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const DIR = join(process.cwd(), 'docs/public/wasm/ember');
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
for (let t=0;t<200;t++) q._qi3_tick();
const CV=[[1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],[1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1],[2,0,0],[-2,0,0],[0,2,0],[0,-2,0],[0,0,2],[0,0,-2]];
const wr=(v)=>((v%N)+N)%N;
const siteW=(x,y,z)=>{let w=0;for(let c=0;c<18;c++)w+=q._qi3_winding_get(x,y,z,c);return w;};
const med=1028;
const snap=()=>{
  const s=new Set();
  for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++)
    if(q._qi3_mass_get(x,y,z)&&siteW(x,y,z)<med*0.5)s.add(x+','+y+','+z);
  return s;
};
// track voids: lifetime per site-key, paired status, mobility proxy
const life={}, healedAt={};
let prev=snap();
const pairFrac=[], coHeal=[];
let t=0;
for(;t<200;t++){
  const cur=snap();
  // count paired fraction + co-heal events this step
  const vs=[...cur].map(k=>k.split(',').map(Number));
  let pairs=0;const paired=new Set();
  for(let i=0;i<vs.length;i++)for(let j=i+1;j<vs.length;j++){
    const d=Math.abs(vs[i][0]-vs[j][0])+Math.abs(vs[i][1]-vs[j][1])+Math.abs(vs[i][2]-vs[j][2]);
    if(d<=2){pairs++;paired.add(vs[i].join(','));paired.add(vs[j].join(','));}
  }
  pairFrac.push(pairs/vs.length);
  let co=0;
  for(const k of prev){
    if(!cur.has(k)){                                   // healed this step
      life[k]=(life[k]||0);healedAt[k]=t;
      if(paired.has(k))co++;                            // was in a pair when it healed
    }
  }
  coHeal.push(co);
  prev=cur;
  q._qi3_tick();
}
// lifetime for persisted voids = censored at 200
const lifeArr=Object.entries(life).map(([k,v])=>v);
const healed=Object.keys(healedAt).length;
const persisted=prev.size;
// null model: expected adjacent pairs if voids random at this density
const nlumps=16384, nv=prev.size;
const expPairs=(nv*(nv-1)/2)*(18/ (nlumps-1));  // rough: each site ~18 nbrs
const lastPairs=pairFrac[pairFrac.length-1]*nv;
console.log(`healed events: ${healed}   persisted>200t: ${persisted} (${(100*persisted/(persisted+healed)).toFixed(1)}%)`);
console.log(`P1 tail: ${persisted>healed*0.1?'CONFIRMED — long-lived tail':'refuted'}`);
console.log(`P2 pairs: ${lastPairs.toFixed(0)} observed vs ~${expPairs.toFixed(0)} null ${lastPairs>expPairs*1.2?'-> OVER-PAIRED (binding)':'-> ~density'}`);
console.log(`co-heal of paired voids/step: ${(coHeal.reduce((a,b)=>a+b,0)/200).toFixed(2)} (P4)`);
