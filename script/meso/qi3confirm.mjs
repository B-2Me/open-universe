// qi3 heartbeat sampling: read qConfirm EVERY tick while the beam
// transits — catch the armed reverse pulses. Plus fusion + annih.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here, '../../docs/public/wasm/ember');
const src = readFileSync(join(DIR, 'qi3.js'), 'utf8');
const mk = () => (() => {
  const m = { exports: {} };
  new Function('module','exports','require','__dirname','__filename',src)(m, m.exports, require, DIR, 'qi3.js');
  return m.exports();
})();

// 1. CONFIRM SAMPLING — beam at nu=192 hits mass-160 lump, sample each tick
{
  const q = await mk();
  q._qi3_init(32, 32, 32, 0); q._qi3_gap_mode(1);
  q._qi3_mass_set(16, 16, 16, 160);   // level 1 (no winding) — absorbs
  for (let i = 6; i < 15; i++) { q._qi3_photon_set(i,16,16,12,20); q._qi3_photon_nu_set(i,16,16,12,228); }
  // nu=228 = 1->3 upward gap at a level-1 site: should ABSORB + confirm
  let pulses = [];
  for (let t = 0; t < 10; t++) {
    q._qi3_tick();
    const cf = q._qi3_confirm_get(16, 16, 16, 13); // reverse of c12
    if (cf) pulses.push(`t${t}=${cf}`);
  }
  console.log('CONFIRM pulses on reverse link:', pulses.join(' ') || 'none');
}
// 2. FUSION — opposing beams collide at vacuum site (16,16,16), no mass
{
  const q = await mk();
  q._qi3_init(32, 32, 32, 0);
  for (let i = 2; i < 12; i++) {  // +x beam approaching from left
    q._qi3_photon_set(i, 16, 16, 12, 30); q._qi3_photon_nu_set(i, 16, 16, 12, 200);
    q._qi3_photon_set(30-i, 16, 16, 13, 30); q._qi3_photon_nu_set(30-i, 16, 16, 13, 200);
  }
  for (let t = 0; t < 14; t++) q._qi3_tick();
  console.log('FUSION: mass at site =', q._qi3_mass_get(16,16,16),
    ' charge =', q._qi3_charge_get(16,16,16), ' events =', Number(q._qi3_event(23)));
}
// 3. ANNIHILATION — antipodal winding on c12/c13 decays to 2 photons
{
  const q = await mk();
  q._qi3_init(32, 32, 32, 0); q._qi3_gap_mode(1);
  q._qi3_mass_set(16, 16, 16, 160);
  q._qi3_winding_set(16, 16, 16, 12, 300);  // +x wound
  q._qi3_winding_set(16, 16, 16, 13, 300);  // -x wound (the antiparticle)
  for (let t = 0; t < 14; t++) q._qi3_tick();
  let c12 = 0, c13 = 0;
  for (let z=0;z<32;z++)for(let y=0;y<32;y++)for(let x=0;x<32;x++){
    c12 += q._qi3_photon_get(x,y,z,12); c13 += q._qi3_photon_get(x,y,z,13);
  }
  console.log('ANNIH: annih events =', Number(q._qi3_event(5)),
    ' back-to-back photons c12 =', c12, ' c13 =', c13);
}
