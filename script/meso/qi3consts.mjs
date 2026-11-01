// the substrate's constant table — native dimensionless observables.
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
console.log('=== QI3 CONSTANT TABLE ===\n');
// 1. edge-class emission lines (derived from reach geometry)
const q1 = await mk();
q1._qi3_init(N,N,N,0); q1._qi3_gap_mode(5);
q1._qi3_mass_set(16,16,16,160);
const lines = {};
for (const e of [0,4,6]) {  // diag, body, axis
  const q = await mk();
  q._qi3_init(N,N,N,0); q._qi3_gap_mode(5);
  q._qi3_mass_set(16,16,16,160);
  q._qi3_winding_set(16,16,16,2*e,128); q._qi3_winding_set(16,16,16,2*e+1,128);
  const h={};
  for(let t=0;t<15;t++){q._qi3_tick();
    for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++)
      for(let c=0;c<18;c++){const p=q._qi3_photon_get(x,y,z,c),nu=q._qi3_photon_nu(x,y,z,c);
        if(p&&nu>40&&Math.abs(x-16)+Math.abs(y-16)+Math.abs(z-16)<6)h[nu]=(h[nu]||0)+p;}}
  const ls=Object.keys(h).map(Number).sort((a,b)=>h[b]-h[a]);
  lines[e]=ls[0]||0;
}
console.log(`emission lines: diag=${lines[0]} body=${lines[4]} axis=${lines[6]}`);
console.log(`line ratios: diag/axis=${(lines[0]/lines[6]).toFixed(3)} body/axis=${(lines[4]/lines[6]).toFixed(3)} (expect 2.0, 1.33)`);
// 2. occupancy asymmetry + filling fraction + void fraction (genesis)
const q2 = await mk();
q2._qi3_init(N,N,N,0); q2._qi3_gap_mode(1);
let rng=555;const rnd=()=>(rng=(rng*1103515245+12345)&0x7fffffff);
for(let i=0;i<30000;i++){const x=rnd()%N,y=rnd()%N,z=rnd()%N,c=rnd()%18;
  q2._qi3_photon_set(x,y,z,c,20+rnd()%40);q2._qi3_photon_nu_set(x,y,z,c,150+rnd()%100);}
for(let t=0;t<200;t++)q2._qi3_tick();
const el=new Array(9).fill(0),ws=[];
let mass=0,loops=0,voids=0;
const sw=[];
for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  if(!q2._qi3_mass_get(x,y,z))continue;mass++;
  let w=0;for(let c=0;c<18;c++)w+=q2._qi3_winding_get(x,y,z,c);sw.push(w);
  for(let e=0;e<9;e++){const a=q2._qi3_winding_get(x,y,z,2*e),b=q2._qi3_winding_get(x,y,z,2*e+1);
    if((a<b?a:b)>=128){el[e]++;loops++;}}
}
sw.sort((a,b)=>a-b);const med=sw[Math.floor(sw.length/2)];
for(const w of sw)if(w<med*0.5)voids++;
console.log(`\nedge occupancy: ${el.join(',')}`);
console.log(`axis(e6-8)/diag(e0-2): ${((el[6]+el[7]+el[8])/(el[0]+el[1]+el[2]+1e-9)).toFixed(2)}x`);
console.log(`filling fraction: ${(loops/(mass*9)).toFixed(2)} (${loops}/${mass*9})`);
console.log(`void fraction: ${(voids/mass*100).toFixed(1)}%`);
console.log(`median winding: ${med} (~${(med/256).toFixed(1)} loops)`);
console.log(`\ntunables: qUnwindShift(binding), qGapScale(nu-shift), qPhaseMode`);
console.log(`authored: quantum=128, fusion wall=256, thermal floor=288, drain floor=32`);
