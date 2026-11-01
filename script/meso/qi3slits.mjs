// sparse two-slit: inject 1 photon every 4 ticks — the lottery
// isn't saturated, so both ~ sum is the classical baseline and
// deviations are the coherence term alone.
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
const N = 32, T = 600;
const run = async (pm, top, bot) => {
  const q = await mk();
  q._qi3_init(N, N, N, 0); q._qi3_gap_mode(1); q._qi3_phase_mode(pm);
  for (let y = 4; y <= 28; y++) {
    const isGap = (top && y === 12) || (bot && y === 20);
    if (isGap) continue;
    for (let z = 14; z <= 18; z++) q._qi3_mass_set(20, y, z, 255);
  }
  for (let y = 4; y <= 28; y++) {
    q._qi3_mass_set(28, y, 16, 160);
    for (let c = 0; c < 18; c++) q._qi3_winding_set(28, y, 16, c, 60);
  }
  for (let t = 0; t < T; t++) {
    if (t % 4 === 0)
      for (let z = 14; z <= 18; z += 2) {
        q._qi3_photon_set(12, 16, z, 12, 1);
        q._qi3_photon_nu_set(12, 16, z, 12, 192);
      }
    q._qi3_tick();
  }
  const prof = [];
  for (let y = 4; y <= 28; y++) {
    let s = 0;
    for (let c = 0; c < 18; c++) s += q._qi3_session_strength(28, y, 16, c);
    prof.push(s);
  }
  return prof;
};
console.log('y   top  bot  both  sum  both/sum | pm0 then pm1');
for (const pm of [0, 1]) {
  const top = await run(pm, true, false);
  const bot = await run(pm, false, true);
  const both = await run(pm, true, true);
  console.log(`--- pm=${pm} ---`);
  for (let i = 0; i < 25; i++) {
    const sum = top[i] + bot[i];
    if (sum || both[i])
      console.log(`${String(i + 4).padStart(2)}   ${top[i]}  ${bot[i]}  ${both[i]}   ${sum}   ${sum > 0 ? (both[i] / sum).toFixed(2) : ' - '}`);
  }
}
