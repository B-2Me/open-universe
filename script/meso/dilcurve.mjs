// dilcurve (E120): speed vs dilation — does the emission-rate drop
// follow a relativistic curve? Vary winding -> vary drift speed,
// measure emission rate and actual drift velocity per level.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso3i.js'), 'utf8');
const mod = { exports: {} };
for (const wind of [0, 16, 48, 128, 255]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso3i.js');return m.exports();})();
  const W=96,H=16,D=16;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
  w._meso3i_phot(5); w._meso3i_recoil(1);
  for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=28;x<36;x++)
    if(!((x+y+z)&1)){ w._meso3i_set(x,y,z,REST,64); w._meso3i_eset(x,y,z,240);
                      if(wind)w._meso3i_rset(x,y,z,12,wind); }
  w._meso3i_ev_reset();
  const cent=()=>{let m=0,sx=0;for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if((x+y+z)&1)continue;let v=w._meso3i_get(x,y,z,REST);
    for(let c=0;c<NMOV;c++)v+=w._meso3i_rget(x,y,z,c);
    m+=v;sx+=v*x;}return m?sx/m:0;};
  const x0=cent();
  let ph0=w._meso3i_photons();
  for(let t=0;t<120;t++) w._meso3i_tick();
  const x1=cent(), ph=w._meso3i_photons()-ph0;
  const v=(x1-x0)/120;
  console.log(`wind=${wind}: v=${v.toFixed(3)} sites/tick  emit=${(ph/120).toFixed(1)}/tick`);
}
