// qi3 cold-regime census: sparse bath at the ignition edge —
// do nucleated lumps CLUSTER, PAIR, or stay isolated?
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
const N = 32, CV = [[1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],[1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1],[2,0,0],[-2,0,0],[0,2,0],[0,-2,0],[0,0,2],[0,0,-2]];
const wr=(v,m)=>((v%m)+m)%m;
// sparse controlled bath: rho=0.01 (ignition band), nu=200
const q = await mk();
q._qi3_init(N, N, N, 0); q._qi3_gap_mode(5);
let rng = 4242;
const rnd = () => (rng = (rng*1103515245+12345)&0x7fffffff);
const nj = Math.round(0.01*N*N*N/2);
for (let i=0;i<nj;i++){
  let x,y,z;
  do{x=rnd()%N;y=rnd()%N;z=rnd()%N;}while((x+y+z)&1);
  const c=rnd()%18;
  q._qi3_photon_set(x,y,z,c,20); q._qi3_photon_nu_set(x,y,z,c,200);
}
for (let t=0;t<200;t++) q._qi3_tick();

// census: lumps, adjacency graph, cluster sizes, bond topologies
const seen = new Set(), sizes = [];
let bondsTot = 0, bondPairs = 0;
for (let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  if (!q._qi3_mass_get(x,y,z)) continue;
  const key = x+','+y+','+z;
  if (seen.has(key)) continue;
  // BFS cluster of massive neighbors
  const stack=[[x,y,z]]; let sz=0;
  while(stack.length){
    const[cx,cy,cz]=stack.pop();const ck=cx+','+cy+','+cz;
    if(seen.has(ck))continue;seen.add(ck);sz++;
    for(const[dx,dy,dz]of CV){
      const nx=wr(cx+dx,N),ny=wr(cy+dy,N),nz=wr(cz+dz,N);
      if(q._qi3_mass_get(nx,ny,nz))stack.push([nx,ny,nz]);
    }
  }
  sizes.push(sz);
}
for (let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  if(!q._qi3_mass_get(x,y,z))continue;
  for(let e=0;e<9;e++)if(q._qi3_session_state(x,y,z,e*2)===2){bondsTot++;}
  // pair = live bond to an adjacent lump
  for(const[dx,dy,dz]of CV){
    const nx=wr(x+dx,N),ny=wr(y+dy,N),nz=wr(z+dz,N);
    if(q._qi3_mass_get(nx,ny,nz)&&q._qi3_session_state(x,y,z,12)===2)bondPairs++;
  }
}
const hist={}; sizes.forEach(s=>{const b=s===1?'1':s===2?'2':s<=4?'3-4':s<=8?'5-8':'9+';hist[b]=(hist[b]||0)+1;});
console.log(`lumps: ${seen.size}   clusters: ${sizes.length}   live bonds: ${bondsTot}`);
console.log('cluster-size histogram:', JSON.stringify(hist));
console.log('pair-adjacent bonds:', bondPairs);
const iso = hist['1']||0, paired = (hist['2']||0)+(hist['3-4']||0);
console.log(`isolated: ${iso}  small clusters(2-4): ${paired}  large: ${sizes.length-iso-paired}`);
