// void healing — ONE shared window: snapshot voids + neighbors,
// tick once, classify where each healed void's winding came from.
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
// snapshot ALL voids + their mean neighbor winding
const vmap=new Map(), nbsum=new Map();
for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  if(!q._qi3_mass_get(x,y,z))continue;
  const w=siteW(x,y,z);
  if(w<med*0.5){
    let s=0;for(const[dx,dy,dz]of CV)s+=siteW(wr(x+dx),wr(y+dy),wr(z+dz));
    vmap.set(x+','+y+','+z,w);nbsum.set(x+','+y+','+z,s/18);
  }
}
for(let t=0;t<30;t++)q._qi3_tick();
let heal=0,cond=0,self=0,amb=0,persist=0;
for(const[k,w0]of vmap){
  const[x,y,z]=k.split(',').map(Number);
  const w1=siteW(x,y,z);
  if(w1<med*0.5){persist++;continue;}
  heal++;
  let s=0;for(const[dx,dy,dz]of CV)s+=siteW(wr(x+dx),wr(y+dy),wr(z+dz));
  const nb1=s/18, nb0=nbsum.get(k);
  if(nb1<nb0*0.75)cond++;          // neighbors dropped -> donated
  else if(w1>w0*2.5)self++;        // self re-wound
  else amb++;
}
console.log(`voids: ${vmap.size}  healed: ${heal}  persisted: ${persist}`);
console.log(`  conduction (neighbors donated): ${cond}`);
console.log(`  self-re-wind (exciton):         ${self}`);
console.log(`  gradual/ambiguous:              ${amb}`);
