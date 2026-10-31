// qi3 exchange correlator: do the facing channels' photon flows
// correlate/anticorrelate through a bound pair? (link3 got -0.81)
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
q._qi3_init(40, 40, 40, 0); q._qi3_gap_mode(5);
q._qi3_mass_set(16, 20, 20, 160); q._qi3_charge_set(16, 20, 20, 2048);
q._qi3_mass_set(24, 20, 20, 160); q._qi3_charge_set(24, 20, 20, 2048);
// control: a far-apart independent pair
q._qi3_mass_set(4, 34, 34, 160); q._qi3_charge_set(4, 34, 34, 2048);
q._qi3_mass_set(36, 6, 6, 160); q._qi3_charge_set(36, 6, 6, 2048);

const T = 120, plus = [], minus = [], plusC = [], minusC = [];
for (let t = 0; t < T; t++) {
  q._qi3_tick();
  // gap flux: photons on +x (c12) and -x (c13) in the gap cells
  let fp = 0, fm = 0, cp = 0, cm = 0;
  for (let x = 17; x < 24; x++) { fp += q._qi3_photon_get(x,20,20,12); fm += q._qi3_photon_get(x,20,20,13); }
  for (let x = 5; x < 12; x++) { cp += q._qi3_photon_get(x,34,34,12); cm += q._qi3_photon_get(x,34,34,13); }
  plus.push(fp); minus.push(fm); plusC.push(cp); minusC.push(cm);
}
const corr = (a, b) => {
  const ma = a.reduce((s,v)=>s+v)/a.length, mb = b.reduce((s,v)=>s+v)/b.length;
  let num=0, da=0, db=0;
  for (let i=0;i<a.length;i++){ num+=(a[i]-ma)*(b[i]-mb); da+=(a[i]-ma)**2; db+=(b[i]-mb)**2; }
  return num/Math.sqrt(da*db+1e-9);
};
const diff = a => a.slice(1).map((v,i)=>v-a[i]);
console.log('raw bound pair:', corr(plus, minus).toFixed(3), ' raw control:', corr(plusC, minusC).toFixed(3));
console.log('DETRENDED bound pair:', corr(diff(plus), diff(minus)).toFixed(3));
console.log('DETRENDED control:   ', corr(diff(plusC), diff(minusC)).toFixed(3));
