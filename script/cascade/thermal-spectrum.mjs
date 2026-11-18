/* thermal-spectrum.mjs — the equilibrium-spectrum test.
 *
 * The vacuum mint is a delta (nu = h>>3) — the SOURCE spectrum,
 * not the equilibrium. The honest question: does re-circulation
 * (emit -> catch/arm -> confirm -> deposit -> re-emit via
 * structure lines + declines -> heat -> re-mint) relax the in-
 * flight nu distribution toward a thermal-looking tail, or does
 * the spectrum stay source-dominated?
 *
 * If the steady-state histogram shows an exponential-ish tail with
 * a scale set by the bath temperature, the substrate has free
 * statistical mechanics — the mint rule is just a source term.
 * If it stays peaked at the mint delta / structure lines, the
 * substrate's "temperature" is a ledger, not an equilibrium.
 *
 *   node script/cascade/thermal-spectrum.mjs [--h=2000] [--t=600]
 *        [--every=100] [--flow=0]
 */
import { loadM26, initM26 } from '../lib/m26.mjs';
const arg = (k, d) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=')[1] : d; };
const N = 24;
const H = parseInt(arg('h', '2000'));
const T = parseInt(arg('t', '600'));
const EVERY = parseInt(arg('every', '100'));
const FLOW = parseInt(arg('flow', '0'));
const FLOOR = parseInt(arg('floor', '32'));
const RATE = parseInt(arg('rate', '8'));
const MODES = parseInt(arg('modes', '0'));   /* qModeLedger: heat
   * underpinned by standing-offer modes */
const TOPUP = parseInt(arg('topup', '4'));   /* re-seed bath every N
   * ticks — thermostat hold; 0 = free cooling */

const q = await loadM26();
initM26(q, N, N, N);
q._moore26_vac_floor_set(FLOOR);
q._moore26_vac_rate_set(RATE);
q._moore26_heat_flow_set(FLOW);
q._moore26_mode_ledger_set(MODES);   /* drain is hardcoded h>>7 — the
   * entropy export; the box cools over the run, which is itself
   * useful: watch the spectrum track the mint delta as h falls */

/* uniform bath — every cell hot, the cleanest thermalizer. Emission
 * probability per cell per tick = 1/RATE; nu = h>>3 minted on a
 * random edge channel. */
for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++)
  q._moore26_heat_set(x, y, z, H);

const census = () => {
  const hist = {}, mhist = {};
  let pkN = 0, pkE = 0, heat = 0, wind = 0, mass = 0;
  let moN = 0, moE = 0;   /* standing-offer mode occupation */
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) {
    heat += Number(q._moore26_heat_get(x, y, z));
    mass += Number(q._moore26_mass_get(x, y, z));
    for (let c = 0; c < 26; c++) {
      wind += Number(q._moore26_winding_get(x, y, z, c));
      const p = Number(q._moore26_packet_get(x, y, z, c));
      if (p) {
        const nu = Number(q._moore26_packet_nu_get(x, y, z, c)) || 1;
        pkN += p; pkE += p * nu;
        hist[nu] = (hist[nu] || 0) + p;
      }
      const ic = Number(q._moore26_incipient_get(x, y, z, c));
      if (ic) {
        const inu = (Number(q._moore26_incipient_nu_get(x, y, z, c)) & (MODES ? 255 : 127)) || 1;
        moN += ic; moE += ic * inu;
        mhist[inu] = (mhist[inu] || 0) + ic;
      }
    }
  }
  return { hist, mhist, pkN, pkE, heat, wind, mass, moN, moE };
};

console.log(`=== thermal-spectrum: uniform bath h=${H} floor=${FLOOR} rate=${RATE} flow=${FLOW} modes=${MODES} ===`);
console.log(`  mint delta would sit at nu = ${H >> 3}`);
for (let t = 0; t <= T; t++) {
  if (t % EVERY === 0 || t === T) {
    const s = census();
    /* top-8 nu bins by count + the tail shape */
    const top = Object.entries(s.hist).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([nu, n]) => `${nu}:${n}`).join(' ');
    const nBins = Object.keys(s.hist).length;
    const mtop = Object.entries(s.mhist).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([nu, n]) => `${nu}:${n}`).join(' ');
    console.log(`t=${String(t).padStart(4)}  heat=${s.heat}  pkN=${s.pkN} pkE=${s.pkE} ` +
      `wind=${s.wind} mass=${s.mass}  nubins=${nBins}  moN=${s.moN} moE=${s.moE}\n` +
      `      top: ${top}\n      modes: ${mtop}`);
    if (t === T) {
      /* full histogram — the shape test. Two views:
       *   counts:  P(nu) packet-number spectrum
       *   energy:  nu·P(nu) — the energy spectrum whose peak is
       *            the Wien-analog position */
      const keys = Object.keys(s.hist).map(Number).sort((a, b) => a - b);
      console.log(`\n--- steady-state PACKET histogram (nu : count : nu*count) ---`);
      for (const nu of keys)
        console.log(`${nu}\t${s.hist[nu]}\t${nu * s.hist[nu]}`);
      const mkeys = Object.keys(s.mhist).map(Number).sort((a, b) => a - b);
      console.log(`\n--- steady-state MODE (standing offer) histogram ---`);
      for (const nu of mkeys)
        console.log(`${nu}\t${s.mhist[nu]}\t${nu * s.mhist[nu]}`);
    }
  }
  q._moore26_tick();
  if (TOPUP && t % TOPUP === TOPUP - 1)
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++)
      q._moore26_heat_set(x, y, z, H);
}
