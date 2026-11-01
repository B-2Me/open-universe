import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const DIR = join(process.cwd(), 'docs/public/wasm/ember');
const src = readFileSync(join(DIR, 'qi3.js'), 'utf8');
const q = await (() => {
  const m = { exports: {} };
  new Function('module','exports','require','__dirname','__filename',src)(m, m.exports, require, DIR, 'qi3.js');
  return m.exports();
})();
q._qi3_init(32,32,32,0); q._qi3_gap_mode(1);
q._qi3_mass_set(24,20,20,160); q._qi3_charge_set(24,20,20,500);
console.log('t  held  wins  absorbs  winding  lvl  charge');
for(let t=0;t<15;t++){
  q._qi3_photon_set(16,20,20,12,1); q._qi3_photon_nu_set(16,20,20,12,192);
  q._qi3_tick();
  let w=0;for(let c=0;c<18;c++)w+=q._qi3_winding_get(24,20,20,c);
  let d=0;for(let e=0;e<9;e++)d+=q._qi3_deposit_edge(24,20,20,2*e);
  console.log(`${String(t).padStart(2)}  ${q._qi3_held_get(24,20,20,12)}     ${d}     ${Number(q._qi3_event(3))}        ${w}        ${q._qi3_level_get(24,20,20)}    ${q._qi3_charge_get(24,20,20)}`);
}
