// lensing (E66): does a lump PULL nearby light? Beam aimed PAST the lump
// (offset y so it misses). Measure photons captured by the lump region.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso3i.js'), 'utf8');
const mod = { exports: {} };
for (const sc of [0, 128, -128, -128.5]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso3i.js');return m.exports();})();
  const W=48,H=24,D=24;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
  w._meso3i_phot(2);
  if (sc === -128.5) { w._meso3i_scatter(-128); w._meso3i_lens(8); }
  else w._meso3i_scatter(sc);  /* phot(2): no absorb->iE; capture = fusion/ablate only */
  // lump centered (24,12,12) r=3
  for(let z=9;z<16;z++)for(let y=9;y<16;y++)for(let x=21;x<28;x++)
    if(!((x+y+z)&1)&&(x-24)**2+(y-12)**2+(z-12)**2<=12) w._meso3i_set(x,y,z,REST,128);
  // beam at y=4..7 (misses lump at y=9..15), +x channel, x=4..8
  let seeded=0;
  for(let t=0;t<40;t++){
    if(t<20&&t%2===0)for(let z=8;z<16;z++)for(let y=4;y<8;y++)for(let x=4;x<8;x++)
      if(!((x+y+z)&1)){w._meso3i_phset_nu(x,y,z,12,1,8);seeded+=8;}
    w._meso3i_tick();
  }
  // count photons + mass events inside lump bbox
  let inLump=0;
  for(let z=6;z<18;z++)for(let y=6;y<18;y++)for(let x=18;x<30;x++)
    if(!((x+y+z)&1))for(let c=12;c<18;c++)for(let nu=1;nu<=4;nu++)
      inLump+=w._meso3i_phget_nu(x,y,z,c,nu);
  console.log(`scatter=${sc}: seeded=${seeded} photons-in-lump-region=${inLump} absorbed-events=${w._meso3i_ev(5)}`);
}
