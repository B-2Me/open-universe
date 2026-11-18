/* compress-piston — the elastic EOS, clean geometry.
 * compress-spring's block-vs-block vice was polluted: edge hops
 * spray mass laterally, and opposing presses deposit canceling
 * strains on the same conduits. This fixture is single-sided:
 *
 *   PUSHER (3x3x3 full block, x=20..22) --+x edge press-->  WALL
 *   (full odd cells at x=23..25, committed even conduits x=23)
 *
 * The wall's odd cells are already at page limit — every merge
 * refuses — so each refused press banks counter-strain on the
 * committed conduit (qPackPress) and the react press returns it
 * to visitors (qFieldReact). One direction, one interface, no
 * cancellation.
 *
 * PROTOCOL: sustained press for --press ticks, then release.
 * Readings: pusher x-centroid (penetration + rebound), stored
 * strain on the interface plane, dissipated heat, mass audit.
 *
 *   node script/cascade/compress-piston.mjs [--pp=4] [--react=4]
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
  let tot = 0, n = 0, px = 0, pn = 0, wx = 0, wn = 0;
  for (let x = 0; x < 64; x++) for (let y = 0; y < 64; y++) for (let z = 0; z < 64; z++) {
    const m = Number(q._moore26_mass_get(x, y, z));
    if (m) { n++; tot += m; if (x < 23) { px += m * x; pn += m; } else { wx += m * x; wn += m; } }
  }
  return { tot, n, pcx: pn ? px / pn : 0, pm: pn, wcx: wn ? wx / wn : 0, wm: wn };
};
const hsum = () => { let s = 0; for (let x = 0; x < 64; x++) for (let y = 0; y < 64; y++) for (let z = 0; z < 64; z++) s += q._moore26_heat_get(x, y, z); return s; };
const strainSum = () => {
  let s = 0;
  for (let y = 27; y <= 35; y++) for (let z = 27; z <= 35; z++)
    for (let a = 0; a < 3; a++) {
      const v = q._moore26_fluxv_get(23, y, z, a);
      s += v < 0 ? -v : v;
    }
  return s;
};

initM26(q, 64, 64, 64);
q._moore26_vac_rate_set(0);
q._moore26_momentum_set(255);
q._moore26_pack_press_set(PP);
q._moore26_field_react_set(REACT);

/* committed conduits on the x=23 interface plane (even parity) —
 * the strain bank. Wall = full ODD-parity cells at x=23..25 —
 * destinations at page limit, every merge refused. Edge hops
 * preserve parity (odd source -> odd dest, +2), so mass on odd
 * cells NEVER lands on the even conduits: no mass+winding
 * hybrids, the mass<->winding capacitor stays shut. */
for (let x = 23; x <= 25; x++) for (let y = 27; y <= 35; y++) for (let z = 27; z <= 35; z++) {
  if ((x + y + z) % 2 === 0)
    for (let c = 6; c < 18; c++) q._moore26_winding_set(x, y, z, c, 64);
  else
    q._moore26_mass_set(x, y, z, FULL);
}

/* pusher: full ODD-parity cells only in x=20..22, pressed +x via
 * edge elements (conduit lands on the even x+1 cell, destination
 * on odd). Even-parity cells stay empty — mass on them would
 * relay onto the wound conduits and hybridize. */
const XE = [3, 4, 5, 6];
const kick = (x, y, z, s) => { for (const e of XE) q._moore26_momentum_at_set(x, y, z, e, s * P); };
for (let x = 20; x <= 22; x++) for (let y = 29; y <= 33; y++) for (let z = 29; z <= 33; z++) {
  if ((x + y + z) % 2 === 0) continue;
  q._moore26_mass_set(x, y, z, FULL);
  kick(x, y, z, +1);
}
const rekick = () => {
  for (let x = 0; x < 64; x++) for (let y = 0; y < 64; y++) for (let z = 0; z < 64; z++) {
    if (q._moore26_mass_get(x, y, z) >= FULL && x < 23 && (x + y + z) % 2 === 1)
      kick(x, y, z, +1);
  }
};
console.log(`=== compress-piston: pusher vs committed wall ===`);
console.log(`  pp=${PP} react=${REACT} p=${P} press=${PRESS}t rel=${REL}t`);
for (let t = 0; t <= PRESS + REL; t++) {
  if (t % 10 === 0 || t === PRESS + REL) {
    const c = census();
    console.log(`t=${String(t).padStart(3)}${t <= PRESS ? ' PRESS' : ' rel  '}  mass=${c.tot}` +
      ` cells=${c.n}  pusherX=${c.pcx.toFixed(2)}(${c.pm}) wallX=${c.wcx.toFixed(2)}(${c.wm})` +
      `  strain=${strainSum()}  heat=${hsum()}  ev27=${q._moore26_events(27)}` +
      ` ev59=${q._moore26_events(59)}`);
  }
  if (t < PRESS + REL) { q._moore26_tick(); if (t < PRESS) rekick(); }
}
