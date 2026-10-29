// repel (E84): does a photon beam PUSH a lump? centroid drift vs beam dir.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
for (const ph of [0, 3]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
  const W=48,H=16,D=16;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
  w._meso3i_phot(ph); w._meso3i_scatter(0);
  // lump centered x=24
  for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=21;x<27;x++)
    if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,64);
  const cent=()=>{let m=0,sx=0;for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if((x+y+z)&1)continue;let v=w._meso3i_get(x,y,z,REST);for(let c=0;c<NMOV;c++)v+=w._meso3i_rget(x,y,z,c);
    m+=v;sx+=v*x;}return m?sx/m:0;};
  const out=[];
  for(let t=0;t<100;t++){
    // photon beam on +x from the LEFT — should push lump right if repel
    for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=4;x<6;x++)
      if(!((x+y+z)&1)) w._meso3i_phset(x,y,z,12,16);
    w._meso3i_drain_edge(3); w._meso3i_tick();
    if(t%25===0) out.push(`t${t}:x=${cent().toFixed(2)}`);
  }
  console.log(`phot=${ph} (0=off,3=ablate): ${out.join(' | ')}`);
}
