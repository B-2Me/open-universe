/* casimir.mjs — two absorbing plates in a seeded thermal bath.
 *
 * Theory prediction (docs/paradox/quantum.md §4): the vacuum is a
 * hot ambient medium; two plates restrict the field between them so
 * outside tension pushes harder than inside -> attraction.
 *
 * Substrate mechanism under test: plates are mass walls that absorb
 * ambient flux. Each plate shadows the other from bath flux, so the
 * inter-plate gap should show DEPLETED packet density vs a matched
 * control volume — the pressure imbalance is the Casimir force proxy.
 *
 * Bath: heat=T seeded on all nodes, topped up every `topup` ticks
 * (thermostat vs the h>>7 drain). Emission: vac_floor/vac_rate.
 *
 * Measurements over the trailing `burn` ticks:
 *   gap density  = avg packet count in inter-plate volume
 *   ctrl density = avg packet count in equal control volume (far side)
 *   depletion    = 1 - gap/ctrl   (0 = no shadowing; >0 = Casimir-like)
 * Sweep separations d; also a no-plate isotropy control.
 *
 * Usage: node script/cascade/casimir.mjs --size=32 --heat=4000
 *        --floor=64 --rate=8 --topup=4 --d=2,4,6,8,12 --ticks=200
 */
import { loadM26 } from '../lib/m26.mjs';

const argv = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue;
  const [k, v] = a.slice(2).split('=');
  argv[k] = v === undefined ? true : v;
}
const SIZE  = +(argv.size  ?? 32);
const HEAT  = +(argv.heat  ?? 4000);
const FLOOR = +(argv.floor ?? 64);
const RATE  = +(argv.rate  ?? 8);
const TOPUP = +(argv.topup ?? 4);
const TICKS = +(argv.ticks ?? 200);
const BURN  = +(argv.burn  ?? 100);
const DS    = String(argv.d ?? '2,4,6,8,12').split(',').map(Number);

const M = await loadM26();

const X0 = 12;                       // left plate plane
const PY0 = 12, PY1 = 20;            // plate y-span
const PZ0 = 12, PZ1 = 20;            // plate z-span
const PMASS = 2000;

function seedBath() {
  for (let z = 0; z < SIZE; z++)
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++)
        M._moore26_heat_set(x, y, z, HEAT);
}
function seedPlate(x) {
  for (let y = PY0; y <= PY1; y++)
    for (let z = PZ0; z <= PZ1; z++)
      M._moore26_mass_set(x, y, z, PMASS);
}
function volPk(x0, x1) {             // packet count in x0..x1, plate span
  let n = 0;
  for (let z = PZ0; z <= PZ1; z++)
    for (let y = PY0; y <= PY1; y++)
      for (let x = x0; x <= x1; x++)
        for (let c = 0; c < 26; c++) n += M._moore26_packet_get(x, y, z, c) || 0;
  return n;
}

function run(d) {
  M._moore26_init(SIZE, SIZE, SIZE);
  M._moore26_vac_floor_set(FLOOR);
  M._moore26_vac_rate_set(RATE);
  seedBath();
  if (d > 0) { seedPlate(X0); seedPlate(X0 + d); }
  const gref = d > 0 ? d : 6;         // no-plate control uses a nominal gap
  const ctrlX0 = X0 + gref + 4, ctrlX1 = Math.min(ctrlX0 + gref - 1, SIZE - 1);
  let gap = 0, ctrl = 0, n = 0;
  for (let t = 0; t < TICKS; t++) {
    M._moore26_tick();
    if (t % TOPUP === 0) seedBath();
    if (t >= TICKS - BURN) {          // trailing-window densities
      gap += volPk(X0 + 1, X0 + gref - 1);
      ctrl += volPk(ctrlX0, ctrlX1);
      n++;
    }
  }
  const gapD = gap / n, ctrlD = ctrl / n;
  const gw = gref - 1, cw = ctrlX1 - ctrlX0 + 1;
  // normalize per unit cell-volume width so gap/control compare fairly
  const gapPer = gw > 0 ? gapD / gw : 0, ctrlPer = ctrlD / cw;
  return { d, gapPer, ctrlPer, depl: ctrlPer > 0 ? 1 - gapPer / ctrlPer : 0,
           pk: M._moore26_packet_total(), ev51: M._moore26_events(51) };
}

console.log(`bath T=${HEAT} floor=${FLOOR} rate=1/${RATE} topup=${TOPUP}t  ` +
            `plates 9x9 mass=${PMASS} at x=${X0},x+d  size=${SIZE}^3`);
console.log(`ctrl volume x=${X0 + 4}.. shifted by d`);
let base = null;
for (const d of DS) {
  const r = run(d);
  if (base === null) base = r.ctrlPer;
  console.log(`d=${d}  gap/width=${r.gapPer.toFixed(2)}  ctrl/width=${r.ctrlPer.toFixed(2)}` +
              `  depletion=${(r.depl * 100).toFixed(1)}%  pk_total=${r.pk}  minted=${r.ev51}`);
}
// isotropy control: no plates, "gap" volume vs control volume should match
const iso = run(0);
console.log(`no-plate control: same-volume check ctrl/width=${iso.ctrlPer.toFixed(2)} (isotropy baseline)`);
