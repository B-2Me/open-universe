/* charge-coupling.mjs — charge as a coupling constant, and the
 * displacement speed limit (cloud-reformation hypothesis).
 *
 * MODE=charge:
 *   An absorber (even cell, mass + winding pairs for catch lvl,
 *   charge=Q set directly) sits on a ch6 lane fed by a +parity
 *   packet stream. Same-sign arrivals hit the reduced arming cap
 *   (ev45) and REFLECT (qReflect=255): the refuser takes a recoil
 *   kick — that's the repulsive force, measured as momentum[3] +
 *   drift vs a neutral control.
 *   Arms: Q sweep {0,±8,±16,±32,±64} at fixed flux -> alpha_eff =
 *   excess decline/recoil per unit charge. Sign flip on -Q shows
 *   the attraction direction.
 *
 * MODE=drift:
 *   A bound knot (mass + sub-floor committed winding) kicked along
 *   +x+y. Track per-cell along the path: first tick incip>0 (cloud
 *   front) vs first tick mass>0 (body front). Hypothesis: the body
 *   front trails the cloud front — displacement rate = cloud
 *   reformation rate, not hop rate.
 *
 * Usage:
 *   node script/cascade/charge-coupling.mjs --mode=charge --q=0,8,16,32,64
 *   node script/cascade/charge-coupling.mjs --mode=charge --q=0,16 --par=-1
 *   node script/cascade/charge-coupling.mjs --mode=drift --kick=600
 */
import { loadM26 } from '../lib/m26.mjs';

const argv = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue;
  const [k, v] = a.slice(2).split('=');
  argv[k] = v === undefined ? true : v;
}
const SIZE  = +(argv.size  ?? 64);
const TICKS = +(argv.ticks ?? 400);
const MODE  = argv.mode ?? 'charge';
const PK    = +(argv.pk ?? 32);
const M = await loadM26();

/* ---------------- charge mode ---------------- */
/* Edge-channel vectors (6..17): ±(1,1,0),±(1,-1,0),±(1,0,1),±(1,0,-1),
 * ±(0,1,1),±(0,1,-1) — read straight from QChannelVec in the engine */
const EDGE_VEC = [
  [1, 1, 0], [-1, -1, 0], [1, -1, 0], [-1, 1, 0],
  [1, 0, 1], [-1, 0, -1], [1, 0, -1], [-1, 0, 1],
  [0, 1, 1], [0, -1, -1], [0, 1, -1], [0, -1, 1],
];
function runCharge(Q, par) {
  M._moore26_init(SIZE, SIZE, SIZE);
  M._moore26_reflect_set(255);
  M._moore26_momentum_set(1);
  if (argv.burst) M._moore26_arm_burst_set(+argv.burst);
  if (argv.capsame !== undefined) M._moore26_cap_same_set(+argv.capsame);
  if (argv.capbase !== undefined) M._moore26_cap_base_set(+argv.capbase);
  if (argv.capshift !== undefined) M._moore26_cap_shift_set(+argv.capshift);
  const A = { x: 32, y: 32, z: 32 };            // absorber (even)
  M._moore26_mass_set(A.x, A.y, A.z, 50);
  /* committed pairs on 4 edges: lvl = 1 + 1000>>7 = 8 (max catch);
   * sub-floor (250<512) so it stays dark; cap raised to stay
   * confirmable (mA+nu<=4000) */
  for (const c of [8, 9, 10, 11, 12, 13, 14, 15])
    M._moore26_winding_set(A.x, A.y, A.z, c, 250);
  M._moore26_confirm_cap_set(4000);
  /* isotropic parity bath: one emitter on EVERY edge channel aimed at
   * A — arming is 1 packet/channel/tick, so a single beam can never
   * push armed past ~1/tick. The bath delivers up to ~12 arms/tick,
   * well above cap (4 same-sign / 13-|q|>>3 opposite), making the
   * decline rate a clean readout of the gate, not the noise floor. */
  const EM = EDGE_VEC.map(([dx, dy, dz], i) => ({
    c: 6 + i, x: A.x - dx, y: A.y - dy, z: A.z - dz,
  }));
  if (Q) M._moore26_charge_set(A.x, A.y, A.z, Q);
  let m0 = -1, armedSum = 0, armedN = 0;
  for (let t = 0; t < TICKS; t++) {
    for (const e of EM) {
      M._moore26_packet_set(e.x, e.y, e.z, e.c, PK);
      M._moore26_packet_nu_set(e.x, e.y, e.z, e.c, 64);
      M._moore26_packet_par_set(e.x, e.y, e.z, e.c, par);
    }
    M._moore26_tick();
    M._moore26_charge_set(A.x, A.y, A.z, Q);    // pin: charge drifts
    /* via charge>>4 flight-shedding and ±1 confirm minting — the
     * coupling must be read at fixed Q, not its decayed remnant */
    if (m0 < 0 && t === 50) m0 = M._moore26_mass_get(A.x, A.y, A.z);
    if (t >= TICKS >> 1) {                     /* time-averaged armed
      * occupancy = the effective cap under saturation */
      for (let c = 0; c < 26; c++) armedSum += M._moore26_incipient_get(A.x, A.y, A.z, c);
      armedN++;
    }
  }
  const armedMid = armedN ? armedSum / armedN : 0;
  let mom = 0;
  for (let e = 0; e < 13; e++) mom += Math.abs(M._moore26_momentum_at_get(A.x, A.y, A.z, e));
  return {
    mom,
    mass0: m0, mass1: M._moore26_mass_get(A.x, A.y, A.z),
    charge1: M._moore26_charge_get(A.x, A.y, A.z), armedMid,
    ev5: M._moore26_events(5), ev45: M._moore26_events(45),
    ev46: M._moore26_events(46), ev53: M._moore26_events(53),
    ev50: M._moore26_events(50), ev52: M._moore26_events(52),
  };
}

/* ---------------- drift mode ---------------- */
function runDrift(kick) {
  M._moore26_init(SIZE, SIZE, SIZE);
  M._moore26_momentum_set(1);
  const K = { x: 9, y: 9, z: 31 };              // odd cell
  M._moore26_mass_set(K.x, K.y, K.z, 400);
  for (const c of [8, 9, 10, 11]) M._moore26_winding_set(K.x, K.y, K.z, c, 120);
  M._moore26_momentum_at_set(K.x, K.y, K.z, 3, kick);
  const NPATH = 14;
  const tCloud = new Array(NPATH).fill(-1), tBody = new Array(NPATH).fill(-1);
  const hist = [];
  for (let t = 0; t < TICKS; t++) {
    M._moore26_tick();
    for (let k = 0; k < NPATH; k++) {
      const x = K.x + k, y = K.y + k;           // knot path (odd cells)
      if (x >= SIZE || y >= SIZE) break;
      if (tCloud[k] < 0) {
        /* the cloud lives on EVEN conduit cells: for a (1,1,0) hop the
         * stall-check conduit is the x-offset face neighbor (x+1,y,z)
         * — parity even, the cell whose incipient load gates the hop */
        let ic = 0;
        for (let c = 0; c < 26; c++)
          ic += M._moore26_incipient_get(x + 1, y, K.z, c) || 0;
        if (ic) tCloud[k] = t;
      }
      if (tBody[k] < 0 && M._moore26_mass_get(x, y, K.z)) tBody[k] = t;
    }
    if (t % 40 === 0) {
      let m = 0, cx = 0;
      for (let k = -2; k < 20; k++) {
        const x = K.x + k, y = K.y + k;
        if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
        const mm = M._moore26_mass_get(x, y, K.z);
        m += mm; cx += mm * x;
      }
      hist.push(`t=${t}: ${m ? 'cx=' + (cx / m).toFixed(1) : 'gone'} m=${m}`);
    }
  }
  return { tCloud, tBody, hist };
}

if (MODE === 'drift') {
  const r = runDrift(+(argv.kick ?? 600));
  console.log(`drift: bound knot kick=${argv.kick ?? 600}, ${TICKS}t`);
  for (const s of r.hist) console.log(`  ${s}`);
  console.log(`  k : cloud body`);
  for (let k = 0; k < r.tCloud.length; k++)
    console.log(`  ${String(k).padStart(2)}: ${String(r.tCloud[k]).padStart(5)} ${String(r.tBody[k]).padStart(5)}`);
} else {
  const QS  = String(argv.q ?? '0,8,-8,16,-16,32,-32,48,-48,64,-64')
    .split(',').map(Number);
  const PARS = String(argv.par ?? '1').split(',').map(Number);
  console.log(`charge-coupling: isotropic parity bath (12 edge emitters), ` +
    `reflect=255, ${TICKS}t, charge pinned, burst=${argv.burst ?? 1}` +
    (argv.capsame !== undefined ? ` capSame=${argv.capsame}` : '') +
    (argv.capbase !== undefined ? ` capBase=${argv.capbase}` : '') +
    (argv.capshift !== undefined ? ` capShift=${argv.capshift}` : ''));
  for (const par of PARS) {
    console.log(`  par=${par > 0 ? '+' : ''}${par}: same-sign declines are ev45, ` +
      `opposite/neutral are ev46`);
    console.log(`  Q    |mom|  armed   mass    ev5  ev45 ev46 ev53 ev50  ev52`);
    for (const Q of QS) {
      const r = runCharge(Q, par);
      console.log(`  ${String(Q).padStart(3)}  ${String(r.mom).padStart(6)} ` +
        `${String(r.armedMid).padStart(5)}  ${r.mass0}->${r.mass1}  ` +
        `${String(r.ev5).padStart(4)} ${String(r.ev45).padStart(4)} ` +
        `${String(r.ev46).padStart(4)} ${String(r.ev53).padStart(4)} ` +
        `${String(r.ev50).padStart(4)} ${String(r.ev52).padStart(5)}`);
    }
  }
}
