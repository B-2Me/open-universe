// void mobility: match each void to the NEAREST void next census —
// same site = frozen defect, moved = quasiparticle drift,
// unmatched = healed (or appeared).
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
const siteW=(x,y,z)=>{let w=0;for(let c=0;c<18;c++)w+=q._qi3_winding_get(x,y,z,c);return w;};
const med=1028;
const snap=()=>{
  const vs=[];
  for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++)
    if(q._qi3_mass_get(x,y,z)&&siteW(x,y,z)<med*0.5)vs.push([x,y,z]);
  return vs;
};
let prev=snap();
let same=0,moved=0,healed=0,distTot=0;
const disp={};
for(let T=0;T<200;T+=10){
  const cur=snap();
  const taken=new Set();
  for(const[px,py,pz]of prev){
    let best=-1,bd=1e9;
    for(let i=0;i<cur.length;i++){
      if(taken.has(i))continue;
      const dx=px-cur[i][0],dy=py-cur[i][1],dz=pz-cur[i][2];
      const d=dx*dx+dy*dy+dz*dz;
      if(d<bd){bd=d;best=i;}
    }
    if(best>=0&&bd<=16){                       // match within 4 cells
      taken.add(best);
      if(bd===0)same++;else{moved++;distTot+=Math.sqrt(bd);disp[Math.round(Math.sqrt(bd))]=(disp[Math.round(Math.sqrt(bd))]||0)+1;}
    } else healed++;
  }
  prev=cur;
  for(let i=0;i<10;i++)q._qi3_tick();
}
console.log(`per 10t window: same-site ${same}  moved ${moved}  healed ${healed}`);
console.log(`moved fraction: ${(100*moved/(same+moved+healed)).toFixed(1)}%   mean displacement: ${moved?(distTot/moved).toFixed(2):0}`);
console.log('displacement histogram:', JSON.stringify(disp));
console.log(`verdict: ${moved>same?'MOBILE quasiparticles':same>moved?'FROZEN defects':'mixed'}`);
