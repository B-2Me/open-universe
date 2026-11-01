// absorption-side spectrum: fire nu at a known loop config,
// measure which nu the edge ACCEPTS (session strength grows).
// clean discriminator — no drain background.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const DIR = join(process.cwd(), 'docs/public/wasm/ember');
const src = readFileSync(join(DIR, 'qi3.js'), 'utf8');
const mk = () => (() => {
  const m = { exports: {} };
  new Function('module','exports','require','__dirname','__filename',src)(m, m.exports, require, DIR, 'qi3.js');
  return m.exports();
})();
const N = 32;
for (const [tag, chans, w] of [['diag loops',[0,1],2048],['axis loops',[12,13],2048]]) {
  for (const mode of [1, 5]) {
    const q = await mk();
    q._qi3_init(N, N, N, 0); q._qi3_gap_mode(mode);
    q._qi3_mass_set(16,16,16,160);
    for (const c of chans) q._qi3_winding_set(16,16,16,c,w);
    const accepted = [];
    for (let nu = 20; nu <= 255; nu += 10) {
      const s0 = q._qi3_session_strength(16,16,16,0);
      // fire nu on channel 0 for 20 ticks
      for (let t = 0; t < 20; t++) {
        q._qi3_photon_set(14,14,16,0,1); q._qi3_photon_nu_set(14,14,16,0,nu);
        q._qi3_tick();
      }
      if (q._qi3_session_strength(16,16,16,0) > s0) accepted.push(nu);
    }
    console.log(`${tag} mode=${mode}: accepted nu = ${JSON.stringify(accepted)}`);
  }
}
