// iqprobe (E105): does iQ fire? Counter-propagating mass beams
// crossing a region — antipodal moving pairs should condense.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso3i.js'), 'utf8');
const mod = { exports: {} };
for (const qm of [0, 3]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso3i.js');return m.exports();})();
  const W=48,H=16,D=16;
  w._meso3i_init(W,H,D,1);
  w._meso3i_collmode(0);w._meso3i_friction(0);w._meso3i_fricmode(0);  // NO friction — keep pairs live
  w._meso3i_drest(0);w._meso3i_reflect(0);w._meso3i_phot(0);
  if(w._meso3i_qmode) w._meso3i_qmode(qm);
  // counter-propagating beams: +x (ch12) from left, -x (ch13) from right
  for(let z=4;z<12;z++)for(let y=4;y<12;y++){
    for(let x=8;x<14;x++)if(!((x+y+z)&1))w._meso3i_set(x,y,z,12,64);
    for(let x=34;x<40;x++)if(!((x+y+z)&1))w._meso3i_set(x,y,z,13,64);
  }
  const out=[];
  for(let t=0;t<80;t++){
    w._meso3i_tick();
    if(t%20===0){
      let qT=0,mx=0;
      for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
        if((x+y+z)&1)continue;const v=w._meso3i_qget(x,y,z);qT+=v;if(v>mx)mx=v;}
      out.push(`t${t}:iQ=${qT} mx=${mx}`);
    }
  }
  console.log(`qmode=${qm}: ${out.join(' | ')}`);
}
