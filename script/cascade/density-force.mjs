/* density-force.mjs — does offer-density asymmetry write force?
 *
 * Confirmed offers kick momentum[pair] in the packet's travel
 * direction. A structure bombarded asymmetrically should accumulate
 * signed momentum on the asymmetry axis — the substrate's first
 * measured force from density, and the kinetic (shadowing) branch
 * of the Casimir question.
 *
 * Setup: warm half-space reservoir (x < WALL, heat=T, topped up)
 * emits isotropic ambient flux; a lone mass node sits at CX in the
 * cold half. Flux arriving on -x channels outweighs +x -> momentum
 * on the x-facing pairs should accumulate signed-ly.
 *
 * Readout: momentum[e] for pairs 3..6 (+x edges 6,8,10,12);
 * a control run with bath on BOTH halves tests isotropy.
 *
 * Usage: node script/cascade/density-force.mjs --heat=4000 --floor=64
 *        --rate=8 --ticks=300 [--both=1] [--mass=10]
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
const TICKS = +(argv.ticks ?? 300);
const BOTH  = argv.both ? 1 : 0;
const MASS  = +(argv.mass  ?? 10);
const CX = 20, CY = 16, CZ = 16;     // probe node in the cold half
const WALL = 14;                     // warm region x < WALL

const M = await loadM26();

function bath() {                    // thermostat the warm region
  const x1 = BOTH ? SIZE : WALL;
  for (let z = 0; z < SIZE; z++)
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < x1; x++)
        M._moore26_heat_set(x, y, z, HEAT);
}

M._moore26_init(SIZE, SIZE, SIZE);
M._moore26_vac_floor_set(FLOOR);
M._moore26_vac_rate_set(RATE);
M._moore26_mass_set(CX, CY, CZ, MASS);
bath();

/* x-facing pairs: edge channel c -> pair e=c>>1, sign +1 for odd c
 * (-x travel) / -1 for even c (+x travel) per the confirm write.
 * Net x-force readout: signed sum over the four x-facing pairs. */
const XPAIRS = [[6, -1], [8, -1], [10, -1], [12, -1]];
const EIDX = [3, 4, 5, 6];           // pairs for channels 6,8,10,12
const mom = () => {
  let s = 0, all = [];
  for (const e of EIDX) {
    const v = M._moore26_momentum_at_get(CX, CY, CZ, e);
    all.push(v); s += v;
  }
  return { s, all };
};

console.log(`density-force: bath x<${WALL}${BOTH ? ' (BOTH halves)' : ''} ` +
            `T=${HEAT} floor=${FLOOR} rate=1/${RATE}, probe mass=${MASS} at (${CX},${CY},${CZ})`);
console.log('t  netMom  pairs[3..6]           pk   ev10  ev51');
for (let t = 0; t <= TICKS; t++) {
  if (t % 25 === 0) {
    const m = mom();
    console.log(`${t}  ${m.s}  [${m.all.join(',')}]  ${M._moore26_packet_total()}  ` +
                `${M._moore26_events(10)}  ${M._moore26_events(51)}`);
  }
  if (t < TICKS) {
    M._moore26_tick();
    if (t % 4 === 0) bath();
  }
}
