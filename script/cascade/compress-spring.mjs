/* compress-spring — the ELASTIC half of the equation of state.
 * compress-collide measured the dissipative channel: pressing two
 * full-density blocks rattles ~50 heat/tick at the interface,
 * magnitude-blind. Nature's compression also stores — degeneracy
 * pressure is elastic: it pushes back when you let go.
 *
 * qPackPress: the mass share a full destination page refuses
 * reflects (ref>>shift) off the shared conduit's fluxV as counter-
 * strain, funded by the destination's just-received momentum.
 * qFieldReact then delivers the stored strain back to touching
 * cells — the interface is a spring, not only a brake.
 *
 * PROTOCOL: vice the blocks together for --press ticks, then
 * RELEASE. If compression is stored, the interface should push
 * the blocks apart; if it's only dissipated, nothing recoils.
 *
 *   node script/cascade/compress-spring.mjs [--pp=4] [--react=4]
 *        [--p=3200] [--press=60] [--rel=120]
 */
import { loadM26, initM26 } from '../lib/m26.mjs';
const arg = (k, d) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=')[1] : d; };
const q = await loadM26();
const PRESS = parseInt(arg('press', '60'));
const REL = parseInt(arg('rel', '120'));
const P = parseInt(arg('p', '3200'));
const PP = parseInt(arg('pp', '4'));
const REACT = parseInt(arg('react', '4'));
const FULL = 65535;

const census = () => {
  let tot = 0, n = 0, lx = 0, ln = 0, rx = 0, rn = 0;
  for (let x = 0; x < 64; x++) for (let y = 0; y < 64; y++) for (let z = 0; z < 64; z++) {
    const m = Number(q._moore26_mass_get(x, y, z));
    if (m) { n++; tot += m; if (x < 32) { lx += m * x; ln += m; } else { rx += m * x; rn += m; } }
  }
  return { tot, n, lcx: ln ? lx / ln : 0, rcx: rn ? rx / rn : 0 };
};
const hsum = () => { let s = 0; for (let x = 0; x < 64; x++) for (let y = 0; y < 64; y++) for (let z = 0; z < 64; z++) s += q._moore26_heat_get(x, y, z); return s; };
/* stored elastic impulse — |fluxV| on the committed interface slab */
const strainSum = () => {
  let s = 0;
  for (let x = 21; x <= 26; x++) for (let y = 27; y <= 35; y++) for (let z = 27; z <= 35; z++)
    for (let a = 0; a < 3; a++) {
      const v = q._moore26_fluxv_get(x, y, z, a);
      s += v < 0 ? -v : v;
    }
  return s;
};

initM26(q, 64, 64, 64);
q._moore26_vac_rate_set(0);
q._moore26_momentum_set(255);
q._moore26_pack_press_set(PP);
q._moore26_field_react_set(REACT);

/* committed interface plane — the shared conduits the refused
 * press banks strain on. x=23, EVEN PARITY ONLY. Edge hops keep
 * the sublattice clean: a (1,+-1,0)/(1,0,+-1) hop's conduit is
 * (x+1,y,z) — an even cell — while its destination lands on an
 * ODD cell (x+1,y+-1,z). No mass+winding hybrids (those run the
 * mass<->winding capacitor: a real conversion that reads as a
 * leak in a mass-only audit). */
for (let y = 27; y <= 35; y++) for (let z = 27; z <= 35; z++)
  if ((23 + y + z) % 2 === 0)
    for (let c = 6; c < 18; c++) q._moore26_winding_set(23, y, z, c, 64);

/* +x/-x press rides the four +-x edge elements (3,4,5,6) — the
 * volumetric draw gives composite x-drift while every hop writes
 * its conduit on the true FCC exchange cell, not the destination */
const XE = [3, 4, 5, 6];
const kick = (x, y, z, s) => { for (const e of XE) q._moore26_momentum_at_set(x, y, z, e, s * P); };

/* two adjacent full-density blocks: A at x=20..22, B at x=24..26 */
for (let x = 20; x <= 22; x++) for (let y = 29; y <= 33; y++) for (let z = 29; z <= 33; z++) {
  q._moore26_mass_set(x, y, z, FULL);
  kick(x, y, z, +1);
}
for (let x = 24; x <= 26; x++) for (let y = 29; y <= 33; y++) for (let z = 29; z <= 33; z++) {
  q._moore26_mass_set(x, y, z, FULL);
  kick(x, y, z, -1);
}
const rekick = () => {
  for (let x = 0; x < 64; x++) for (let y = 0; y < 64; y++) for (let z = 0; z < 64; z++) {
    if (q._moore26_mass_get(x, y, z) >= FULL)
      kick(x, y, z, x < 32 ? +1 : -1);
  }
};
console.log(`=== compress-spring: vice ${PRESS}t then release ${REL}t ===`);
console.log(`  pp=${PP} react=${REACT} p=${P} — strain stored vs heat paid vs recoil`);
for (let t = 0; t <= PRESS + REL; t++) {
  if (t % 10 === 0 || t === PRESS + REL) {
    const c = census();
    console.log(`t=${String(t).padStart(3)}${t <= PRESS ? ' PRESS' : ' rel  '}  mass=${c.tot}` +
      ` cells=${c.n}  Lx=${c.lcx.toFixed(2)} Rx=${c.rcx.toFixed(2)}` +
      ` gap=${(c.rcx - c.lcx).toFixed(2)}  strain=${strainSum()}` +
      ` heat=${hsum()}  ev27=${q._moore26_events(27)}` +
      ` ev52=${q._moore26_events(52)} ev64=${q._moore26_events(64)}`);
  }
  if (t < PRESS + REL) { q._moore26_tick(); if (t < PRESS) rekick(); }
}
