/* momentum-field.mjs - does the momentum field propagate between
 * structures through a winding filament, and how far?
 *
 * Mechanics: the odd-cell relay fires on mass>=4 OR winding; momentum
 * leads mass - the dominant pair picks the hop channel. A winding-only
 * filament along an edge direction should conduct momentum cell to
 * cell WITHOUT mass - the substrate's field-line candidate.
 *
 * Layout (all odd cells, along the (1,1,0) edge vector):
 *   source (13,16,16): winding + momentum[3] kick
 *   filament (14,17)..(18,21): winding[6] only - conduction path
 *   probe  (19,22,16): free mass - does the field push it?
 *
 * Arms: --fil=1 (default) vs 0. Readout: momentum along the line,
 * probe momentum[3..6], probe mass centroid (x+y)/2 displacement.
 */
import { loadM26 } from '../lib/m26.mjs';

const argv = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue;
  const [k, v] = a.slice(2).split('=');
  argv[k] = v === undefined ? true : v;
}
const SIZE  = +(argv.size  ?? 32);
const TICKS = +(argv.ticks ?? 300);
const FIL   = +(argv.fil   ?? 1);
const KICK  = +(argv.kick  ?? 2000);   // source momentum[3]
const WIND  = +(argv.wind  ?? 8);      // filament winding[6]
const QMASS = +(argv.qmass ?? 10);
const CATCH = +(argv.catch ?? 2);

const M = await loadM26();
const LINE = [];
for (let k = 0; k <= 6; k++) LINE.push([13 + k, 16 + k, 16]);
const SRC = LINE[0], DST = LINE[LINE.length - 1];

M._moore26_init(SIZE, SIZE, SIZE);
M._moore26_catch_gate_set(CATCH);
if (FIL) for (const [x, y, z] of LINE) M._moore26_winding_set(x, y, z, 6, WIND);
M._moore26_momentum_at_set(SRC[0], SRC[1], SRC[2], 3, KICK);
M._moore26_mass_set(DST[0], DST[1], DST[2], QMASS);

function lineMom() {
  return LINE.map(([x, y, z]) => M._moore26_momentum_at_get(x, y, z, 3)).join(',');
}
function probeCX() {
  let num = 0, den = 0;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++)
    for (let dz = -1; dz <= 1; dz++) {
      const m = M._moore26_mass_get(DST[0] + dx, DST[1] + dy, DST[2] + dz);
      num += (DST[0] + dx) * m; den += m;
    }
  return den ? (num / den).toFixed(2) : 'nan';
}
function probeMom() {
  let s = 0;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++)
    for (let dz = -1; dz <= 1; dz++)
      for (let e = 3; e <= 6; e++)
        s += M._moore26_momentum_at_get(DST[0] + dx, DST[1] + dy, DST[2] + dz, e);
  return s;
}

console.log(`momentum-field: filament=${FIL ? 'ON wind=' + WIND : 'OFF'} ` +
            `kick[3]=${KICK}@${SRC} probe mass=${QMASS}@${DST}`);
console.log('t  lineMom3[src..dst]  probeMom  probeCX');
for (let t = 0; t <= TICKS; t++) {
  if (t % 25 === 0)
    console.log(`${t}  ${lineMom()}  ${probeMom()}  ${probeCX()}`);
  if (t < TICKS) M._moore26_tick();
}
