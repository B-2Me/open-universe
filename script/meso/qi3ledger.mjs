// qi3 energy-ledger audit: conservation accounting across the
// transaction pass — deposited vs capped vs emitted vs stim shortfall.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here, '../../docs/public/wasm/ember');
const src = readFileSync(join(DIR, 'qi3.js'), 'utf8');
const q = await (() => {
  const m = { exports: {} };
  new Function('module','exports','require','__dirname','__filename',src)(m, m.exports, require, DIR, 'qi3.js');
  return m.exports();
})();
q._qi3_init(40, 40, 40, 0);
q._qi3_gap_mode(1);
q._qi3_mass_set(16, 20, 20, 160); q._qi3_charge_set(16, 20, 20, 1024);
q._qi3_mass_set(24, 20, 20, 160); q._qi3_charge_set(24, 20, 20, 1024);
for (let t = 0; t < 60; t++) q._qi3_tick();
const ev = n => Number(q._qi3_event(n));
// field photon energy census: count x nu
let fieldE = 0;
for (let z=0;z<40;z++)for(let y=0;y<40;y++)for(let x=0;x<40;x++)
  for(let c=0;c<18;c++){
    const ph=q._qi3_photon_get(x,y,z,c);
    if(ph) fieldE += ph*(q._qi3_photon_nu(x,y,z,c)||1);
  }
console.log('--- qi3 energy ledger (60 ticks, pair) ---');
console.log('absorbed photons (3):', ev(3));
console.log('E deposited to charge (18):', ev(18));
console.log('E capped away at 255 (19):', ev(19));
console.log('E emitted (20):', ev(20));
console.log('stim shortfall — E created (21):', ev(21));
console.log('junction E (22):', ev(22));
console.log('stimulated clones (17):', ev(17));
console.log('field photon E now:', fieldE);
const absE = ev(18), capped = ev(19), emitE = ev(20), stimLeak = ev(21);
console.log('cap-loss fraction:', (capped/(absE+1)).toFixed(3));
console.log('emitted/deposited:', (emitE/(absE+1)).toFixed(3));
