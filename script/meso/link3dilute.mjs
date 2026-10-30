// link3dilute: pure light dilution — continuous isotropic source at
// center, count photons in distance shells at steady state.
// Conserved flux => density should fall as 1/r^2 (FCC lattice).
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
w._link3_init(64,24,24,1);
const NMOV=w._link3_nch()-1,REST=NMOV;
w._link3_friction(0);w._link3_phot(0);w._link3_drain_edge(0);  // no absorption, no decay — pure propagation
const cx=32,cy=12,cz=12;
// inject isotropically every tick: all 18 channels at the center site
for(let t=0;t<40;t++){
  for(let c=0;c<NMOV;c++)w._link3_phset(cx,cy,cz,c,4);
  w._link3_tick();
}
// radial histogram — count photons per distance bin
const bins=[0,4,8,12,16,20,24,28];
const dens=bins.slice(0,-1).map(()=>({n:0,sites:0}));
for(let z=0;z<24;z++)for(let y=0;y<24;y++)for(let x=0;x<64;x++){
  if((x+y+z)&1)continue;
  const r=Math.sqrt((x-cx)*(x-cx)+(y-cy)*(y-cy)+(z-cz)*(z-cz));
  for(let i=0;i<dens.length;i++)if(r>=bins[i]&&r<bins[i+1]){
    for(let c=0;c<NMOV;c++)dens[i].n+=w._link3_phget(x,y,z,c);
    dens[i].sites++;
  }
}
console.log('shell | photons | per-site | r^2*dens (const if 1/r^2)');
dens.forEach((d,i)=>{
  const rm=(bins[i]+bins[i+1])/2, dn=d.n/Math.max(1,d.sites);
  console.log(`r~${rm}: n=${d.n} per-site=${dn.toFixed(3)} r2*d=${(dn*rm*rm).toFixed(1)}`);
});
