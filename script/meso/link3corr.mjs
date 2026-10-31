// link3corr: connected correlation between a bound pair —
// C = <IA*IB> - <IA><IB> over time. Does exchange correlate
// the two lumps' inventories? (quantum-statistical observable)
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const run = async (bound) => {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(64,20,20,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
  w._link3_ieburst(160);w._link3_egate(16);w._link3_phspread(96);w._link3_dwell(4);
  const xa=bound?26:20, xb=bound?34:52;   // bound pair vs far-separated
  for(let z=6;z<13;z++)for(let y=6;y<13;y++){
    for(let x=xa;x<xa+4;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);w._link3_rset(x,y,z,12,96);}
    for(let x=xb;x<xb+4;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);w._link3_rset(x,y,z,13,96);}
  }
  // gap photon-flow correlation: photons on +x vs -x channels in
  // the gap between the lumps — the duplex exchange traffic
  const inv=(c)=>{let s=0;
    for(let z=0;z<20;z++)for(let y=0;y<20;y++)for(let x=28;x<36;x++){
      if((x+y+z)&1)continue;s+=w._link3_phget(x,y,z,c);}
    return s;};
  const Ia=[],Ib=[];
  for(let t=0;t<200;t++){w._link3_tick();
    if(t>50){Ia.push(inv(12));Ib.push(inv(13));}}
  // detrend: correlate the FLUCTUATIONS (first differences),
  // not the levels — common decay makes raw levels corr~1 trivially
  const dA=[],dB=[];
  for(let i=1;i<Ia.length;i++){dA.push(Ia[i]-Ia[i-1]);dB.push(Ib[i]-Ib[i-1]);}
  const mA=dA.reduce((a,b)=>a+b)/dA.length, mB=dB.reduce((a,b)=>a+b)/dB.length;
  let cov=0,vA=0,vB=0;
  for(let i=0;i<dA.length;i++){
    cov+=(dA[i]-mA)*(dB[i]-mB);vA+=(dA[i]-mA)**2;vB+=(dB[i]-mB)**2;}
  return cov/Math.sqrt(vA*vB||1);
};
console.log(`bound pair (gap~8):   corr=${(await run(true)).toFixed(3)}`);
console.log(`far-separated (independent): corr=${(await run(false)).toFixed(3)}`);
