// qi3 level-shape sweep: same wound site under each E_n candidate —
// harmonic comb / E0/n2 / E0/n / E0*n / E0*n2. What does each emit?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here, '../../docs/public/wasm/ember');
const src = readFileSync(join(DIR, 'qi3.js'), 'utf8');
for (const [tag, mode] of [['E0/n^2',1],['E0/n',2],['E0*n',3],['E0*n^2',4]]) {
  const q = await (() => {
    const m = { exports: {} };
    new Function('module','exports','require','__dirname','__filename',src)(m, m.exports, require, DIR, 'qi3.js');
    return m.exports();
  })();
  q._qi3_init(32,32,32,0); q._qi3_gap_mode(mode);
  q._qi3_mass_set(16,16,16,160);
  q._qi3_charge_set(16,16,16,255);
  for (let c=0;c<4;c++) q._qi3_winding_set(16,16,16,c,400); // level ~7
  for (let t=0;t<12;t++) q._qi3_tick();
  const hist={};
  for(let z=4;z<28;z++)for(let y=4;y<28;y++)for(let x=4;x<28;x++)
    for(let c=0;c<18;c++){
      const ph=q._qi3_photon_get(x,y,z,c);
      if(ph){const nu=q._qi3_photon_nu(x,y,z,c);hist[nu]=(hist[nu]||0)+ph;}
    }
  console.log(tag.padEnd(6), 'emitted:', JSON.stringify(hist));
}
