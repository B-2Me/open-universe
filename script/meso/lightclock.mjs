// lightclock (E121): the bond's cavity photons ARE a light clock.
// Measure the exchange crossing rate (photons through the gap
// midpoint per tick) — does it slow when the pair drifts?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso3i.js'), 'utf8');
const mod = { exports: {} };
for (const [tag,wind] of [['still',0],['drifting',128]]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso3i.js');return m.exports();})();
  const W=80,H=16,D=16;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
  w._meso3i_phot(5);
  // bound pair: two lumps + photon cavity between them
  for(let z=5;z<11;z++)for(let y=5;y<11;y++){
    for(let x=30;x<36;x++)if(!((x+y+z)&1)){w._meso3i_set(x,y,z,REST,64);if(wind)w._meso3i_rset(x,y,z,12,wind);}
    for(let x=44;x<50;x++)if(!((x+y+z)&1)){w._meso3i_set(x,y,z,REST,64);if(wind)w._meso3i_rset(x,y,z,12,wind);}
  }
  for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=36;x<44;x++)
    if(!((x+y+z)&1)){ w._meso3i_phset(x,y,z,12,32); w._meso3i_phset(x,y,z,13,32); }
  // count photon crossings through gap midpoint x=40 per tick (the clock rate)
  let crossings=0;
  const gapCount=()=>{let s=0;for(let z=5;z<11;z++)for(let y=5;y<11;y++)
    for(let c=0;c<NMOV;c++)s+=w._meso3i_phget(40,y,z,c)+w._meso3i_phget(41,y,z,c);return s;};
  let prev=0;
  for(let t=0;t<150;t++){
    w._meso3i_tick();
    const g=gapCount();
    if(t>30) crossings+=Math.abs(g-prev);  // flux change = exchange activity
    prev=g;
  }
  const cent=()=>{let m=0,sx=0;for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if((x+y+z)&1)continue;const v=w._meso3i_get(x,y,z,REST);m+=v;sx+=v*x;}return m?sx/m:0;};
  // where are the cavity photons — between lumps, behind, or gone?
  const lumpX=cent(); let inCav=0,behind=0,ahead=0,phT=0;
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if((x+y+z)&1)continue;
    for(let c=0;c<NMOV;c++){const v=w._meso3i_phget(x,y,z,c);phT+=v;
      if(x>lumpX-4&&x<lumpX+14)inCav+=v;
      else if(x<lumpX-4)behind+=v; else ahead+=v;}}
  console.log(`${tag}: flux=${crossings} lumpX=${lumpX.toFixed(1)} | photons: cavity=${inCav} behind=${behind} ahead=${ahead} tot=${phT}`);
}
