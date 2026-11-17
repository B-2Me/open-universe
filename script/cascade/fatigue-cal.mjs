/* fatigue-cal — the wall's stress-strain calibration: sustained
 * pressure vs medium healing.
 *
 * A stall conduit denies a hop when lane wear ws+dep >= stall;
 * every denied attempt ratchets ws+1 (work-hardening) AND absorbs
 * pd into fluxV. With qWearDecay>0 the medium HEALS winding at
 * w>>decay per tick. So a cell pressing a wall forever drives a
 * competition: denial rate ratchets the wall up, decay grinds it
 * back down. Equilibrium ws* = where ratchet = decay.
 *
 * If stall sits BELOW ws* the wall always locks (pressure wins);
 * ABOVE ws* it heals faster than it wears — the lane never closes
 * and the presser eventually gets through (or keeps pressing
 * forever without locking). The (stall, decay) boundary IS the
 * wall's fatigue curve — the rheology's phase diagram.
 *
 * Fixture: one presser (mass+momentum pair3 toward the conduit),
 * one wall conduit (8,8,16), creep=0. Sweep stall x decay.
 * Metrics per arm: winding on pair6/7 over time (does ws pin at
 * stall -> LOCK, or saturate below -> HEALED), ev27 denials,
 * mass escape.
 *
 * Usage: node script/cascade/fatigue-cal.mjs
 *        [--p=3200] [--stall=4] [--decay=5] [--ticks=120]
 *        or sweep: default runs the boundary map
 */
import { loadM26, initM26 } from '../lib/m26.mjs';
const arg = (k, d) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=')[1] : d; };
const q = await loadM26();

const W = 64;
const P = parseInt(arg('p', '3200'));
const TICKS = parseInt(arg('ticks', '120'));
const MASS = 256;
const WALL = [8, 8, 16], A = [7, 8, 16];

const run = (stall, decay, cy) => {
  initM26(q, W, W, W);
  q._moore26_wall_press_set(1);
  q._moore26_wall_stall_set(stall);
  q._moore26_wear_decay_set(decay);
  if (cy) q._moore26_creep_yield_set(cy);
  /* marginal wall: ws just above the stall threshold so the
   * ratchet-vs-decay equilibrium decides immediately instead
   * of decaying from a deep-fatigue 400. */
  const seed = stall + 20;
  q._moore26_winding_set(...WALL, 6, seed >> 1);
  q._moore26_winding_set(...WALL, 7, seed - (seed >> 1));
  q._moore26_mass_set(...A, MASS);
  q._moore26_momentum_set(255);
  let maxW = 0, escT = -1, ws = 0;
  const wsSeries = [];
  for (let t = 0; t <= TICKS; t++) {
    /* SUSTAINED pressure: a denial absorbs the whole momentum
     * register (inelastic catch), so re-kick every tick — the
     * cell presses the wall at P per tick, always. */
    q._moore26_momentum_at_set(...A, 3, P);
    ws = q._moore26_winding_get(...WALL, 6) + q._moore26_winding_get(...WALL, 7);
    wsSeries.push(ws);
    if (ws > maxW) maxW = ws;
    if (escT < 0 && q._moore26_mass_get(...A) < MASS / 2) escT = t;
    if (t < TICKS) q._moore26_tick();
  }
  const denials = q._moore26_creep_get(...A);   /* creep counts denied attempts */
  const mAtA = q._moore26_mass_get(...A);
  const yields = q._moore26_events(64);         /* creep-yield escapes */
  return { ws, wsSeries, maxW, denials, escT, yields, held: mAtA >= MASS / 2 };
};

const oneStall = arg('stall', ''), oneDecay = arg('decay', ''), oneCy = arg('creep', '0');
if (process.argv.includes('--race')) {
  /* creepYield x decay race: which failure opens first —
   * the cell's plastic rupture (~cy denials) or the wall's
   * heal (~ws decay to stall). stall is deep (200) so the
   * wall can't open elastically soon; vary cy to see where
   * plastic yield beats healing. */
  console.log(`=== race: stall=200 creepYield x decay — 'y'=yielded(rupture) 'h'=healed 'L'=locked, =t ===`);
  const decays = [4, 5, 6];
  process.stdout.write('creep\\decay |' + decays.map(d => String(d).padStart(10)).join('') + '\n');
  for (const cy of [20, 40, 80, 120]) {
    const cells = [];
    for (const d of decays) {
      const r = run(200, d, cy);
      const tag = r.yields > 0 ? 'y' : (r.held ? 'L' : 'h');
      cells.push(`${tag}${r.escT >= 0 ? '@' + r.escT : ''}`.padStart(10));
    }
    console.log(`  ${String(cy).padStart(4)}    |` + cells.join(''));
  }
} else if (process.argv.includes('--repeat')) {
  /* successive carriers vs one wall: does a yield-through DAMAGE
   * the lane, or only spend the carrier's own creep record? Seat
   * fresh carriers at A back to back; each should need the full
   * ~cy denials (creep reset at yield), while the wall's ws keeps
   * ratcheting — plastic flow HARDENS the wall. */
  const stall = +arg('stall', '200'), decay = +arg('decay', '0'), cy = +arg('creep', '30');
  const NCYC = +arg('ncyc', '4');
  initM26(q, W, W, W);
  q._moore26_wall_press_set(1);
  q._moore26_wall_stall_set(stall);
  q._moore26_wear_decay_set(decay);
  if (cy) q._moore26_creep_yield_set(cy);
  const seed = stall + 20;
  q._moore26_winding_set(...WALL, 6, seed >> 1);
  q._moore26_winding_set(...WALL, 7, seed - (seed >> 1));
  const wsNow = () => q._moore26_winding_get(...WALL, 6) + q._moore26_winding_get(...WALL, 7);
  console.log(`=== repeat: stall=${stall} decay=${decay} creep=${cy} — ${NCYC} successive carriers, one wall ===`);
  for (let cyc = 1; cyc <= NCYC; cyc++) {
    q._moore26_mass_set(...A, MASS);
    let yT = -1, yWs = wsNow();
    for (let t = 0; t <= TICKS; t++) {
      q._moore26_momentum_at_set(...A, 3, P);
      if (q._moore26_mass_get(...A) < MASS / 2) { yT = t; yWs = wsNow(); break; }
      q._moore26_tick();
    }
    console.log(`carrier#${cyc}: yield@${yT} ws@yield=${yWs} ev64=${q._moore26_events(64)} wsNow=${wsNow()}`);
  }
} else if (oneStall && oneDecay) {
  const r = run(+oneStall, +oneDecay, +oneCy);
  console.log(`stall=${oneStall} decay=${oneDecay} creep=${oneCy}: ws=${r.ws} maxW=${r.maxW} denials=${r.denials} escT=${r.escT} yields=${r.yields} held=${r.held}`);
} else {
  console.log(`=== fatigue-cal: wall=stall+20 p=${P} — (stall x decay) boundary map, ${TICKS}t ===`);
  console.log(`rows=stall, cols=wearDecay: 'L'=locked(held), 'h'=healed(escaped), trailing = final ws / denials`);
  const decays = [4, 5, 6, 7, 8];
  process.stdout.write('stall\\decay |' + decays.map(d => String(d).padStart(11)).join('') + '\n');
  for (const stall of [16, 32, 64, 128, 256]) {
    const cells = [];
    for (const d of decays) {
      const r = run(stall, d);
      cells.push(`${r.held ? 'L' : 'h'}${r.escT >= 0 ? '@' + r.escT : ''}/${r.denials}`.padStart(11));
    }
    console.log(`  ${String(stall).padStart(3)}     |` + cells.join(''));
  }
}
