// fusion threshold vs the band quantum: if 256 is a real quantum,
// pair creation should cost ~2 quanta — sweep the gate and see
// whether the SHARP wall sits exactly at nua+nub=256.
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
console.log('nua  nub  sum   fused?');
for (const [na, nb] of [[128,128],[127,128],[100,156],[64,200],[90,166],[110,146],[120,136],[125,131]]) {
  const q = await mk();
  q._qi3_init(N, N, N, 0); q._qi3_gap_mode(1);
  q._qi3_photon_set(14, 16, 16, 12, 10); q._qi3_photon_nu_set(14, 16, 16, 12, na);
  q._qi3_photon_set(18, 16, 16, 13, 10); q._qi3_photon_nu_set(18, 16, 16, 13, nb);
  for (let t = 0; t < 4; t++) q._qi3_tick();
  const fused = Number(q._qi3_event(23)) > 0;
  console.log(`${na}  ${nb}   ${na+nb}    ${fused ? 'YES' : 'no'}`);
}
