/* compress-probe — does localization COST energy in the substrate?
 *
 * Nature's mass-spread floor is confinement economics: packing
 * energy tighter than ~1fm costs MORE (hbar*c/dx > m*c^2). Here we
 * ask whether the substrate charges anything for the same trick:
 * same total mass, packed into 1 cell vs 27 vs 81 — does the dense
 * blob bleed (launch sheds k=min(mass>>4, dd>>2) along its winding
 * gradient), mint heat, radiate, or sit inert? If dense==spread,
 * spread-out-ness is authored; if dense pays, a spread floor is
 * emergent and measurable.
 *
 * All in vacuum, no external drive: whatever happens is the
 * substrate's own response to local density.
 *
 * Usage: node script/cascade/compress-probe.mjs [--ticks=200] [--evap=0]
 */
import { loadM26, initM26 } from '../lib/m26.mjs';
const arg = (k, d) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=')[1] : d; };
const q = await loadM26();
const TICKS = parseInt(arg('ticks', '200'));
const EVAP = parseInt(arg('evap', '0'));
const C = 32;

/* three fixtures, same total mass ~64800 */
const FIXTURES = {
  dense1:  [[C, C, C]],                          /* 1 cell, mass=64800 */
  blob27:  [],                                    /* 3^3 = 27 cells, 2400 each */
  blob125: [],                                    /* 5^3 = 125 cells, ~518 each */
};
for (let x = C - 1; x <= C + 1; x++) for (let y = C - 1; y <= C + 1; y++) for (let z = C - 1; z <= C + 1; z++)
  FIXTURES.blob27.push([x, y, z]);
for (let x = C - 2; x <= C + 2; x++) for (let y = C - 2; y <= C + 2; y++) for (let z = C - 2; z <= C + 2; z++)
  FIXTURES.blob125.push([x, y, z]);
const TOTAL = 64800;

const msum = () => { let s = 0; for (let x = 0; x < 64; x++) for (let y = 0; y < 64; y++) for (let z = 0; z < 64; z++) s += Number(q._moore26_mass_get(x, y, z)); return s; };
const hsum = () => { let s = 0; for (let x = 0; x < 64; x++) for (let y = 0; y < 64; y++) for (let z = 0; z < 64; z++) s += q._moore26_heat_get(x, y, z); return s; };
/* census of mass-bearing cells — how spread is it now? */
const cells = () => { let n = 0; for (let x = 0; x < 64; x++) for (let y = 0; y < 64; y++) for (let z = 0; z < 64; z++) if (q._moore26_mass_get(x, y, z) > 0) n++; return n; };

for (const [name, cells0] of Object.entries(FIXTURES)) {
  initM26(q, 64, 64, 64);
  q._moore26_vac_rate_set(0);
  if (EVAP) q._moore26_evap_shift_set(EVAP);
  const per = Math.floor(TOTAL / cells0.length);
  for (const [x, y, z] of cells0) q._moore26_mass_set(x, y, z, per);
  console.log(`\n=== ${name}: ${cells0.length} cells x ${per} = ${msum()} mass ===`);
  for (let t = 0; t <= TICKS; t++) {
    if (t % 50 === 0 || t === TICKS) {
      console.log(`t=${String(t).padStart(3)}  mass=${msum()} cells=${cells()} heat=${hsum()}` +
        `  ev27=${q._moore26_events(27)} ev43=${q._moore26_events(43)} ev52=${q._moore26_events(52)}` +
        `  ev59=${q._moore26_events(59)} ev64=${q._moore26_events(64)}`);
    }
    if (t < TICKS) q._moore26_tick();
  }
}
