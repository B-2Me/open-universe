/* compress-collide — the ACTIVE confinement probe. Passive result:
 * holding 64800 mass in one cell costs nothing (compress-probe —
 * localization is free once achieved). So ask the harder question:
 * does the substrate RESIST active compression? Two full-density
 * 3x3x3 blocks (65535/cell — every cell at the u16 page limit, no
 * room to merge) kicked into each other. In nature, compressing
 * matter costs confinement energy + builds degeneracy pressure.
 * Here: full cells can't accept handoff — pressure has nowhere to
 * write. Watch what pays: fragmentation (the body sheds pieces),
 * creep yields, heat mints, or the blobs just bounce/slide.
 *
 * Usage: node script/cascade/compress-collide.mjs [--p=3200] [--ticks=120]
 */
import { loadM26, initM26 } from '../lib/m26.mjs';
const arg = (k, d) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=')[1] : d; };
const q = await loadM26();
const TICKS = parseInt(arg('ticks', '120'));
const P = parseInt(arg('p', '3200'));
const FULL = 65535;

const census = () => {
  let tot = 0, n = 0, full = 0, maxc = 0, frags = 0;
  for (let x = 0; x < 64; x++) for (let y = 0; y < 64; y++) for (let z = 0; z < 64; z++) {
    const m = Number(q._moore26_mass_get(x, y, z));
    if (m) { n++; tot += m; if (m >= FULL) full++; else if (m < 1000) frags++; if (m > maxc) maxc = m; }
  }
  return { tot, n, full, frags, maxc };
};
const hsum = () => { let s = 0; for (let x = 0; x < 64; x++) for (let y = 0; y < 64; y++) for (let z = 0; z < 64; z++) s += q._moore26_heat_get(x, y, z); return s; };

initM26(q, 64, 64, 64);
q._moore26_vac_rate_set(0);
q._moore26_momentum_set(255);
/* two adjacent full-density blocks: A at x=20..22, B at x=24..26 */
for (let x = 20; x <= 22; x++) for (let y = 29; y <= 33; y++) for (let z = 29; z <= 33; z++) {
  q._moore26_mass_set(x, y, z, FULL);
  q._moore26_momentum_at_set(x, y, z, 0, +P);   /* +x kick, edge pair 0 */
}
for (let x = 24; x <= 26; x++) for (let y = 29; y <= 33; y++) for (let z = 29; z <= 33; z++) {
  q._moore26_mass_set(x, y, z, FULL);
  q._moore26_momentum_at_set(x, y, z, 0, -P);   /* -x kick */
}
console.log(`=== compress-collide: 2x (3x3x3 @65535) head-on, p=${P} ===`);
console.log('  every cell at page limit — merging impossible; what pays?');
const rekick = () => {   /* sustained press: every full cell in the
                           left half pushed +x, right half -x — a
                           static vice, not a single tap */
  for (let x = 0; x < 64; x++) for (let y = 0; y < 64; y++) for (let z = 0; z < 64; z++) {
    if (q._moore26_mass_get(x, y, z) >= FULL)
      q._moore26_momentum_at_set(x, y, z, 0, x < 32 ? +P : -P);
  }
};
for (let t = 0; t <= TICKS; t++) {
  if (t % 20 === 0 || t === TICKS) {
    const c = census();
    console.log(`t=${String(t).padStart(3)}  mass=${c.tot} cells=${c.n}` +
      ` full=${c.full} frags=${c.frags} max=${c.maxc} heat=${hsum()}` +
      `  ev64=${q._moore26_events(64)} ev52=${q._moore26_events(52)}` +
      `  ev59=${q._moore26_events(59)} ev27=${q._moore26_events(27)}`);
  }
  if (t < TICKS) { q._moore26_tick(); rekick(); }
}
