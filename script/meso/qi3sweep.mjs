// binding-depth sweep: qUnwindShift 1..4, measure emitted nu
// (transition energy) vs the loop quantum (rest=128/edge-pair).
// coupling analog = transition/rest — does a deeper regime
// give a weaker coupling like nature's alpha?
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
console.log('shift  emitted-nu(range)  coupling(transition/rest)  level@t50');
for (const shift of [1, 2, 3, 4]) {
  const q = await mk();
  q._qi3_init(N, N, N, 0); q._qi3_gap_mode(5); q._qi3_unwind_shift(shift);
  q._qi3_mass_set(16,16,16,160);
  for (const e of [0,2,4]) { q._qi3_winding_set(16,16,16,2*e,128); q._qi3_winding_set(16,16,16,2*e+1,128); }
  const hist = {};
  for (let t = 0; t < 50; t++) {
    q._qi3_tick();
    for (let z=0;z<N;z++) for (let y=0;y<N;y++) for (let x=0;x<N;x++)
      for (let c=0;c<18;c++) {
        const ph = q._qi3_photon_get(x,y,z,c), nu = q._qi3_photon_nu(x,y,z,c);
        if (ph && nu > 30 && Math.abs(x-16)+Math.abs(y-16)+Math.abs(z-16) < 8)
          hist[nu] = (hist[nu]||0)+ph;
      }
  }
  const lines = Object.keys(hist).map(Number).sort((a,b)=>a-b);
  const mid = lines.length ? lines[Math.floor(lines.length/2)] : 0;
  console.log(`${shift}     ${lines.slice(0,5).join(',')}        ${mid}/256=${(mid/256).toFixed(3)}        ${q._qi3_level_get(16,16,16)}`);
}
