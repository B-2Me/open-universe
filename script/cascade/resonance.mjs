/* resonance.mjs — stimulated-emission resonance of a wound knot.
 *
 * Mechanism (authored, src/moore26.c:1831,2011-2052):
 *   geo_gap(K) = weakest committed pair's rung energy / reach² —
 *   for 6 pairs at w=128, bondDist=0: (128>>2)*2/edgeLen2 = 32.
 *   An offer arming on K with nu==gap gets bit7 (stim flag);
 *   on the next tick's confirm scan it calls site_unwind (sheds a
 *   rung from the weakest committed edge) and emits ONE clone
 *   packet on the STIMULATOR'S channel — collimated — instead of
 *   depositing. ev17 counts stim events.
 *
 * Activation prerequisites (measured, this harness):
 *   - committed volume must EXCEED qGroundFloor (512): site_unwind
 *     refuses at/below the floor — 4 pairs @128 (=512) blocks stim.
 *   - the offer must ARM on the wound cell — seed it 1 hop upstream
 *     so it arrives during Phase 1 and offers same-tick (seeding on
 *     the cell puts it in flight before Phase 2 can arm it; bare
 *     upstream cells can also catch it first — gap=0 there).
 *
 * Fixture: 6 committed pairs @128 (tv=768>floor), pumped back to 128
 * each tick (external excitation holds the line fixed — otherwise
 * self-emission drifts the gap, see qResEmit spectrum). Probe = one
 * packet/tick on ch14 at (8,7,7) arriving at K=(8,8,8).
 *
 * Readout: ev17 (stim), ev3 (normal confirms), clone packets on
 * ch14 downstream (nu + born = phase-coherence test), winding shed,
 * heat. Sweep nu 26..38 -> the resonance curve.
 *
 * Controls: (a) floor-blocked — 4 pairs only (tv=512): flags set
 * but site_unwind refuses, ev17 must be 0; (b) no structure — bare
 * grid: geo_gap=0, nothing flags.
 *
 * Run: node script/cascade/resonance.mjs
 */
import { loadM26 } from '../lib/m26.mjs';

const SIZE = 16, T = 80;
const K = [8, 8, 8];
const PAIRS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]; /* pairs e3..e8 */
const SRC = [8, 7, 7], CH = 14;   /* probe channel: (0,+1,+1) -> arrives K */
const DOWN = [8, 9, 9];           /* clone detector, one hop past K */
const M = await loadM26();
const ev = i => Number(M._moore26_events(i));

function run(nu, { pump = true, windAll = true, watchClones = false } = {}) {
  M._moore26_init(SIZE, SIZE, SIZE);
  M._moore26_wear_decay_set(0);
  M._moore26_incip_ttl_set(249);
  const wind = windAll ? PAIRS : PAIRS.slice(0, 8); /* 6 pairs vs 4 (floor) */
  const seed = () => { for (const ch of wind) M._moore26_winding_set(...K, ch, 128); };
  seed();
  const e17 = ev(17), e3 = ev(3);
  const clones = [];
  for (let t = 0; t < T; t++) {
    if (pump) seed();            /* hold the excited state pinned */
    M._moore26_packet_set(...SRC, CH, 1);
    M._moore26_packet_nu_set(...SRC, CH, nu);
    const before = ev(17);
    M._moore26_tick();
    if (watchClones && ev(17) > before) {
      const pk = M._moore26_packet_get(...K, CH);
      clones.push({
        t, at: pk ? 'K' : 'down',
        nu: pk ? M._moore26_packet_nu_get(...K, CH) : M._moore26_packet_nu_get(...DOWN, CH),
        born: pk ? M._moore26_packet_born_get(...K, CH) : M._moore26_packet_born_get(...DOWN, CH),
      });
    }
  }
  return { stim: ev(17) - e17, confirms: ev(3) - e3, clones,
           gap: M._moore26_geo_gap(...K) };
}

console.log('=== RESONANCE SWEEP (pumped, 6 pairs, tv=768) ===');
for (let nu = 26; nu <= 38; nu++) {
  const r = run(nu);
  console.log(`nu=${nu}  stim=${r.stim}  confirms=${r.confirms}`);
}

console.log('\n=== CONTROL: floor-blocked (4 pairs, tv=512=floor) ===');
{
  const r = run(32, { windAll: false });
  console.log(`nu=32  stim=${r.stim}  confirms=${r.confirms}  (expect stim=0: unwind refused at floor)`);
}

console.log('\n=== CONTROL: bare grid (gap=0) ===');
{
  M._moore26_init(SIZE, SIZE, SIZE);
  const e17 = ev(17);
  for (let t = 0; t < T; t++) {
    M._moore26_packet_set(...SRC, CH, 1);
    M._moore26_packet_nu_set(...SRC, CH, 32);
    M._moore26_tick();
  }
  console.log(`nu=32  stim=${ev(17) - e17}  (expect 0: no committed structure)`);
}

console.log('\n=== CLONE CHARACTERIZATION (nu=32) ===');
{
  const r = run(32, { watchClones: true });
  for (const c of r.clones.slice(0, 12))
    console.log(`stim@${c.t}  clone@${c.at}  nu=${c.nu}  born=${c.born}`);
  console.log(`total stim=${r.stim}`);
}

console.log('\n=== GAIN: downstream flux at the line ===');
for (const nu of [30, 31, 32, 33, 34]) {
  M._moore26_init(SIZE, SIZE, SIZE);
  M._moore26_wear_decay_set(0);
  M._moore26_incip_ttl_set(249);
  const e0 = ev(17);
  let flux = 0;
  for (let t = 0; t < T; t++) {
    for (const ch of PAIRS) M._moore26_winding_set(...K, ch, 128);
    M._moore26_packet_set(...SRC, CH, 1);
    M._moore26_packet_nu_set(...SRC, CH, nu);
    M._moore26_tick();
    flux += M._moore26_packet_get(...DOWN, CH);
  }
  console.log(`nu=${nu}  stim=${ev(17) - e0}  downstreamFlux=${flux}`);
}
