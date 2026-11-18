/* knot-radius.mjs — the compactness measurement R(M).
 *
 * Nature's two branches (in hbar=c=1):
 *   hadrons:        R*M ~ 4-5   (confined bound states — Compton-like)
 *   nuclear bulk:   R ~ M^(1/3) (packed matter at constant density)
 * The substrate's bulk EOS already packs at ~92% page (exclusion
 * equilibrium) -> bulk follows the nuclear branch trivially. The
 * open question is the BOUND-KNOT branch: do accreted/emitted
 * structures carry a characteristic density (R~M^1/3) or a
 * Compton-like R*M?
 *
 * PROTOCOL: wound anchor (committed winding draws accretion) under
 * a seeded thermal bath; census the mass cloud's mass-weighted RMS
 * radius + fullness profile every --every ticks. Several anchor
 * sizes -> several (R,M) trajectories.
 *
 * CONTROL ARM (--arm=blob): seeded packed odd-parity block — the
 * constructed R~M^1/3 reference slope (no dynamics).
 *
 *   node script/cascade/knot-radius.mjs [--t=400] [--every=50]
 *        [--arms=grow,blob]
 */
import { loadM26, initM26 } from '../lib/m26.mjs';
const arg = (k, d) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=')[1] : d; };
const N = 32, T = parseInt(arg('t', '400')), EVERY = parseInt(arg('every', '50'));
const HEAT = 4000, FLOOR = 64, RATE = 8;
const C = 16;                                  /* anchor center */

const q = await loadM26();
const setup = () => {
  initM26(q, N, N, N);
  q._moore26_vac_floor_set(FLOOR);
  q._moore26_vac_rate_set(RATE);
};
const bath = () => {
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
    if (x === 0 || y === 0 || z === 0 || x === N - 1 || y === N - 1 || z === N - 1)
      q._moore26_heat_set(x, y, z, HEAT);
};
/* mass census within a 24^3 box around the anchor: total mass,
 * mass-weighted centroid, RMS radius, per-shell mean fullness */
const census = () => {
  let M = 0, cx = 0, cy = 0, cz = 0;
  const cells = [];
  for (let z = 2; z < 30; z++) for (let y = 2; y < 30; y++) for (let x = 2; x < 30; x++) {
    const m = Number(q._moore26_mass_get(x, y, z));
    if (!m) continue;
    cells.push([x, y, z, m]); M += m; cx += m * x; cy += m * y; cz += m * z;
  }
  if (!M) return null;
  cx /= M; cy /= M; cz /= M;
  let r2 = 0;
  for (const [x, y, z, m] of cells) r2 += m * ((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2);
  const rms = Math.sqrt(r2 / M);
  /* radial fullness profile: mean mass/cell in unit shells */
  const sh = {};
  for (const [x, y, z, m] of cells) {
    const r = Math.round(Math.sqrt((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2));
    (sh[r] = sh[r] || []).push(m);
  }
  const prof = Object.keys(sh).sort((a, b) => a - b)
    .map(r => `${r}:${Math.round(sh[r].reduce((a, b) => a + b) / sh[r].length)}`).join(' ');
  return { M, n: cells.length, cx, cy, cz, rms, prof, fill: M / cells.length };
};

const ARMS = String(arg('arms', 'grow4,grow8,blob')).split(',');
console.log(`=== knot-radius: R(M) compactness ===`);
for (const arm of ARMS) {
  setup();
  let anchor = 0;
  if (arm.startsWith('grow')) {
    anchor = parseInt(arm.slice(4));
    /* committed winding core + small mass seed — the bath accretes
     * mass onto the structure, as in knot-source's 'living' arm */
    for (let dx = -anchor; dx <= anchor; dx += 2)
      for (let dy = -anchor; dy <= anchor; dy += 2)
        for (let dz = 0; dz <= 0; dz++) {
          const x = C + dx, y = C + dy, z = C + dz;
          for (const c of [6, 7, 8, 9]) q._moore26_winding_set(x, y, z, c, 200);
        }
    q._moore26_mass_set(C, C, C, 256);
  } else if (arm === 'blob') {
    /* packed control: odd-parity block at ~full page density */
    for (let dx = 0; dx < 6; dx++) for (let dy = 0; dy < 6; dy++) for (let dz = 0; dz < 6; dz++) {
      const x = C + dx, y = C + dy, z = C + dz;
      if ((x + y + z) & 1) q._moore26_mass_set(x, y, z, 60000);
    }
  }
  console.log(`\n== arm ${arm} ==`);
  console.log(`t    M        cells  R_rms   fill/cell  profile r:mean`);
  for (let t = 0; t <= T; t++) {
    if (t % EVERY === 0 || t === T) {
      const s = census();
      if (s) console.log(`${String(t).padStart(3)}  ${String(s.M).padStart(8)} ${String(s.n).padStart(5)}  ` +
        `${s.rms.toFixed(2).padStart(6)}  ${s.fill.toFixed(0).padStart(6)}   ${s.prof}`);
    }
    if (arm.startsWith('grow') && t % 4 === 0) bath();
    q._moore26_tick();
  }
}
