// qi3 ACK correlator: offer flow out (c12) vs confirm flow home (c13)
// in the gap — the true TI exchange observable. Should correlate at
// the round-trip lag: offers spike, ACKs follow ~2*tau later.
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

const T = 120, offer = [], ack = [];
for (let t = 0; t < T; t++) {
  q._qi3_tick();
  let off = 0, ak = 0;
  for (let x = 17; x < 24; x++) {
    off += q._qi3_photon_get(x,20,20,12);   // offers A->B
    ak  += q._qi3_ack_get(x,20,20,13);      // confirms B->A
  }
  offer.push(off); ack.push(ak);
}
const corr = (a,b,lag) => {
  const n = a.length - lag;
  const ma = a.slice(0,n).reduce((s,v)=>s+v)/n, mb = b.slice(lag).reduce((s,v)=>s+v)/n;
  let num=0,da=0,db=0;
  for (let i=0;i<n;i++){ num+=(a[i]-ma)*(b[i+lag]-mb); da+=(a[i]-ma)**2; db+=(b[i+lag]-mb)**2; }
  return num/Math.sqrt(da*db+1e-9);
};
console.log('lag  corr(offer[t], ack[t+lag])');
for (let lag = 0; lag <= 24; lag += 2)
  console.log(`${String(lag).padStart(3)}   ${corr(offer, ack, lag).toFixed(3)}`);
