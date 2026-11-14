/* light-cone.mjs — does the conducted-signal cone curve in a
 * density gradient?  (Tajik et al. analog: v(z) = f(density))
 *
 * Two propagation speeds exist in the substrate:
 *   ballistic  — free packets hop 1 cell/tick; density only
 *                attenuates (decay = count*live>>8), never slows.
 *   conducted  — a deposit -> unwind -> re-emit relay. The emission
 *                step is density-refused (P = localDensity/255), so
 *                local density IS the metric for conducted signals.
 *
 * Lane: even cells L_k = (10+k, 10+k, 32), k=0..23, each a bare
 * emitter: committed winding pair (6,7) biased forward (600/400)
 * plus (8,9)=(300,300) for volume — committed ~700 > ground floor.
 * A pulse of packets on ch6 relays: arm -> confirm -> deposit on
 * the (6,7) pair -> unwind -> re-emit forward on ch6.
 *
 * Density band: lane cells k in [B0,B1] get P of their 26 odd
 * neighbors seeded mass — live=P -> dens=P*255/26 -> refusal P%.
 * P=26 should asymptotically stall the conducted front (horizon).
 *
 * Per-cell front markers:
 *   t_fly  — first packet on ch6 with born<=t0+2 (ballistic pulse)
 *   t_arm  — first incip[6]>0 (transaction record)
 *   t_dep  — winding[6]+winding[7] exceeds seed (settled energy)
 *   t_emit — first packet on ch6 with born>t0+2 (fresh re-emission)
 *
 * 'drift' arm instead: an odd-cell mass knot momentum-kicked along
 * +x+y crawls through a wall seeded incip[6]=LOAD — the backpressure
 * stall (incip>=32) is the matter-horizon analog.
 *
 * Usage:
 *   node script/cascade/light-cone.mjs --p=0,10,20,26
 *   node script/cascade/light-cone.mjs --drift=1 --load=0,16,31,32,64
 */
import { loadM26 } from '../lib/m26.mjs';

const argv = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue;
  const [k, v] = a.slice(2).split('=');
  argv[k] = v === undefined ? true : v;
}
const SIZE  = +(argv.size  ?? 64);
const BURN  = +(argv.burn  ?? 140);   // bleed lane cells to the floor
const TICKS = +(argv.ticks ?? 200);   // post-pulse window
const NL    = +(argv.nlane ?? 24);
const B0    = +(argv.b0    ?? 10), B1 = +(argv.b1 ?? 13);
const PINJ  = +(argv.pinj  ?? 40);
const NU    = +(argv.nu    ?? 74);
const X0 = 10, Y0 = 10, Z = 32;

const M = await loadM26();
const CV = [,,,,,, [1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],
            [1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1]];

const lane = k => ({ x: X0+k, y: Y0+k, z: Z });

/* the 26 Moore neighbors of a cell, odd cells only (even cell's
 * neighbors are all odd) — the live-density shell */
function nbrShell(x, y, z, pick) {
  const out = [];
  for (let dz = -1; dz <= 1; dz++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy && !dz) continue;
        out.push([x+dx, y+dy, z+dz]);
      }
  return out.slice(0, pick);
}

function seedLane() {
  for (let k = 0; k < NL; k++) {
    const L = lane(k);
    M._moore26_winding_set(L.x, L.y, L.z, 6, 600);
    M._moore26_winding_set(L.x, L.y, L.z, 7, 400);
    M._moore26_winding_set(L.x, L.y, L.z, 8, 300);
    M._moore26_winding_set(L.x, L.y, L.z, 9, 300);
  }
}
const SEED67 = 600 + 400;

function seedBand(P) {
  for (let k = B0; k <= B1 && k < NL; k++) {
    const L = lane(k);
    for (const [x, y, z] of nbrShell(L.x, L.y, L.z, P))
      M._moore26_mass_set(x, y, z, 32);
  }
}

function run(P) {
  M._moore26_init(SIZE, SIZE, SIZE);
  M._moore26_rail_gate_set(65535);   /* rails OFF — a wired lane would
    * re-channel packets past the transaction; the conducted front
    * must arm->confirm->deposit->emit at every cell to count */
  /* bridge the emit/absorb gap: default qConfirmCap (~160) refuses
   * deposits on pairs >86 — a committed (emittable) cell can never
   * confirm, a thin (catchable) cell can never emit. Raising the cap
   * is the only way a relay cell both receives AND radiates. */
  M._moore26_confirm_cap_set(4000);
  M._moore26_catch_gate_set(8);      /* lvl~5 -> ~60% catch */
  seedLane();
  if (P) seedBand(P);
  /* burn-in: every lane cell unwinds to the ground floor (vol<=512
   * can't unwind). After it, cells are DARK — no spontaneous emit.
   * A deposit that lifts the committed volume back above the floor
   * is the only thing that fires a relay: conducted signal only. */
  for (let t = 0; t < BURN; t++) M._moore26_tick();
  const base = [];
  for (let k = 0; k < NL; k++) {
    const L = lane(k);
    base[k] = M._moore26_winding_get(L.x, L.y, L.z, 6) +
              M._moore26_winding_get(L.x, L.y, L.z, 7);
  }
  const t0 = BURN + 8;
  const tFly = new Array(NL).fill(-1), tArm = new Array(NL).fill(-1),
        tDep = new Array(NL).fill(-1), tEmit = new Array(NL).fill(-1);
  let densBand = 0;
  for (let t = BURN; t < BURN + TICKS; t++) {
    if (t === t0) {
      const L = lane(0);
      M._moore26_packet_set(L.x, L.y, L.z, 6, PINJ);
      M._moore26_packet_nu_set(L.x, L.y, L.z, 6, NU);
    }
    M._moore26_tick();
    if (t <= t0) continue;
    for (let k = 0; k < NL; k++) {
      const L = lane(k);
      const p = M._moore26_packet_get(L.x, L.y, L.z, 6);
      if (p && t > t0) {
        const born = M._moore26_packet_born_get(L.x, L.y, L.z, 6);
        let dt = (t & 255) - born; if (dt < 0) dt += 256;
        const dInj = (t0 & 255) - born;   // pulse carrier's age
        const dInjA = ((dInj % 256) + 256) % 256;
        if (tFly[k] < 0 && dInjA <= 2) tFly[k] = t;       // the pulse itself
        if (tEmit[k] < 0 && dt <= 2) tEmit[k] = t;        // fresh carrier
      }
      if (tArm[k] < 0 && M._moore26_incipient_get(L.x, L.y, L.z, 6)) tArm[k] = t;
      if (tDep[k] < 0) {
        const w = M._moore26_winding_get(L.x, L.y, L.z, 6) +
                  M._moore26_winding_get(L.x, L.y, L.z, 7);
        if (w > base[k] + 4) tDep[k] = t;
      }
    }
  }
  if (P) {
    for (let k = B0; k <= B1; k++) {
      const L = lane(k);
      densBand += M._moore26_localdensity_get(L.x, L.y, L.z);
    }
    densBand = Math.round(densBand / (B1 - B0 + 1));
  }
  return { tFly, tArm, tDep, tEmit, densBand, base,
           ev28: M._moore26_events(28), ev5: M._moore26_events(5) };
}

/* ---- drift arm: knot vs incipient wall (backpressure horizon) ---- */
function runDrift(load) {
  M._moore26_init(SIZE, SIZE, SIZE);
  M._moore26_momentum_set(1);               /* inertial drift ON */
  if (argv.stall !== undefined) M._moore26_stall_load_set(+argv.stall);
  if (argv.carve !== undefined) M._moore26_carve_load_set(+argv.carve);
  const K = { x: 9, y: 9, z: 31 };          // odd cell
  M._moore26_mass_set(K.x, K.y, K.z, 2048);
  /* a bare mass cell is not a knot — committed winding binds it,
   * else the kick tears it into a wake (knot broke, not moved) */
  for (const c of [6,7,8,9]) M._moore26_winding_set(K.x, K.y, K.z, c, 300);
  M._moore26_momentum_at_set(K.x, K.y, K.z, 3, 600);
  /* wall: the backpressure gate reads incip[2*be] on the conduit
   * cell (x+v0, y, z) — the +1x row offset from the knot's diagonal,
   * NOT the destination. Cover both rows plus a z-slab. */
  const wall = [];
  if (load) for (let k = 4; k <= 10; k++)
    for (let dz = -1; dz <= 1; dz++) {
      wall.push({ x: K.x+k+1, y: K.y+k,   z: K.z+dz });   // conduit row
      wall.push({ x: K.x+k,   y: K.y+k,   z: K.z+dz });   // knot row
    }
  const seedWall = () => {
    for (const w of wall) M._moore26_incipient_set(w.x, w.y, w.z, 6, load);
    /* sustained drive: re-kick every odd cell on the path row — a
     * single kick spends out before the wall is reached, so the
     * remnant parked at the boundary without ever testing the gate */
    for (let k = 0; k < 16; k++)
      M._moore26_momentum_at_set(K.x+k, K.y+k, K.z, 3, 600);
  };
  seedWall();
  let cx0 = -1, hist = [];
  for (let t = 0; t < TICKS; t++) {
    if (t % 20 === 0) seedWall();            // TTL + kick refresh
    M._moore26_tick();
    if (t % 25 === 0 || t === TICKS-1) {
      let m = 0, cx = 0, cy = 0;
      for (let k = -2; k < 16; k++) {
        const x = K.x+k, y = K.y+k;
        if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
        const mm = M._moore26_mass_get(x, y, K.z);
        m += mm; cx += mm*x; cy += mm*y;
      }
      if (m) { cx /= m; cy /= m; if (cx0 < 0) { cx0 = cx; }
               hist.push(`t=${t}:c=(${(cx).toFixed(2)},${(cy).toFixed(2)}) m=${m}`); }
      else hist.push(`t=${t}: mass gone`);
    }
  }
  return hist;
}

if (argv.drift) {
  const LOADS = String(argv.load ?? '0,16,31,32,64').split(',').map(Number);
  console.log(`drift horizon: knot mass=2048 momentum[3]=+400, wall incip[6] sweep, ${TICKS}t` +
    ` stall=${argv.stall ?? 32} carve=${argv.carve ?? 16}`);
  for (const L of LOADS) {
    const h = runDrift(L);
    console.log(`load=${L}:`);
    for (const s of h) console.log(`   ${s}`);
    console.log();
  }
} else {
  const PS = String(argv.p ?? '0,10,20,26').split(',').map(Number);
  console.log(`light-cone: lane ${NL} cells, burn=${BURN}t, band k=[${B0},${B1}], pulse ${PINJ}@nu${NU}, +${TICKS}t`);
  for (const P of PS) {
    const r = run(P);
    console.log(`\nP=${P} (band dens=${r.densBand}/255, ev28=${r.ev28} refused, ev5=${r.ev5} armed)`);
    console.log(`  base=${r.base.join(',')}`);
    console.log(`  k : fly arm dep emit`);
    for (let k = 0; k < NL; k++)
      console.log(`  ${String(k).padStart(2)}: ${String(r.tFly[k]).padStart(4)} ${String(r.tArm[k]).padStart(4)} ` +
                  `${String(r.tDep[k]).padStart(4)} ${String(r.tEmit[k]).padStart(4)}`);
  }
}
