// derive the band quantum: seed isolated sites with winding
// 16..512, find the smallest that PERSISTS vs drains away.
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
console.log('w0   w(t=200)  persists?');
for (const w0 of [16, 32, 64, 128, 192, 256, 384, 512]) {
  const q = await mk();
  q._qi3_init(N, N, N, 0); q._qi3_gap_mode(1);
  q._qi3_mass_set(16, 16, 16, 160);
  // seed as a LOOP (matched pair on edge 0, channels 0+1)
  q._qi3_winding_set(16, 16, 16, 0, Math.round(w0 / 2));
  q._qi3_winding_set(16, 16, 16, 1, Math.round(w0 / 2));
  for (let t = 0; t < 200; t++) q._qi3_tick();
  let w = 0;
  for (let c = 0; c < 18; c++) w += q._qi3_winding_get(16, 16, 16, c);
  console.log(`${String(w0).padStart(3)}   ${w}        ${w > w0 * 0.5 ? 'PERSISTS' : 'drained'}`);
}
