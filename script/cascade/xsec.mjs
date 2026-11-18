// xsec.mjs — bound-object reaction cross-sections at fm scale.
// Nature's measurement: fire probes at a bound object, classify each
// event, get sigma(nu, b) — the reaction matrix, not just totals.
//
// Target: mass-bearing composite self-tuned into the radiating band
//   (4*mass < loop_winding < 8*mass) — settles to a stable line ~34.
// Probe: single packet on ch6=(+1,+1,0) injected 4 hops upstream at
//   (6,y0,16) -> impact b = |12-y0|/sqrt(2) at the object (10,16,16).
//   Short flight (4 hops to contact) limits the lone-quantum drip.
//
// Metrics per event (raw NodeState reads — wasm getters are ~50us):
//   transmitted — probe-energy packet survives past the object on the
//                 forward corridor (nu in [0.6nu,1.6nu])
//   armed       — near-object incipient energy grew by ~probe nu
//                 (mode uptake — the absorption channel)
//   shattered   — probe gone, emitted energy >> spontaneous baseline
//   absorbed    — probe gone after reaching r<4, no big shower
//   drip        — probe never seen in the r<4 sphere (transit death;
//                 excluded from P_int which is quoted per-ARRIVAL)
// Probe tagging: for nu != object line (~34) the nu-window separates
//   probe from the object's own emitted photons. At nu=34 the arm
//   growth (delta incipient energy) is the discriminator.
//
// Scans:
//   --scan=nu   excitation function sigma(nu) at b=0 (resonance curve)
//   --scan=b    opacity profile sigma(b) at fixed nu
// Run: node script/cascade/xsec.mjs --scan=nu --shots=8
import { loadM26, initM26, nodeOff, ev } from '../lib/m26.mjs';
import { opts, loadConfig } from '../lib/p3.mjs';
const { opt, num } = opts(loadConfig());
const N = 32;
const TX = 10, TY = 16, TZ = 16;
const M = num('m', 200) | 0;
const SETTLE = num('settle', 45) | 0;
const FLIGHT = num('flight', 16) | 0;
const SHOTS = num('shots', 8) | 0;
const SCAN = opt('scan', 'nu');
const NUFIX = num('nu', 34) | 0;
const NU_LIST = opt('nus', '8,17,25,34,50,80,150').split(',').map(Number);
const Y0_LIST = opt('y0s', '4,6,8,10,12,14,16,18,20').split(',').map(Number);

const q = await loadM26();
const OFF = nodeOff(q);
let NS = 0;
const heap = () => new Uint8Array(q.wasmMemory.buffer, q._moore26_state_pointer(), NS * N * N * N);
const IDX = (x, y, z) => (z * N * N + y * N + x) * NS;
const op = OFF.packet, on = OFF.packetNu, oi = OFF.incip, oin = OFF.incipNu;

const BLANK = opt('blank');        // vacuum control — no target
function newTarget() {
  initM26(q, N, N, N);
  NS = q._moore26_node_size();
  q._moore26_reflect_set(255);
  q._moore26_res_emit_set(1);
  q._moore26_vac_rate_set(0);
  q._moore26_rung_shift_set(1);
  q._moore26_incip_ttl_set(120);
  q._moore26_mode_ledger_set(1);
  if (BLANK) return;
  q._moore26_mass_set(TX, TY, TZ, M);
  for (const [e, w] of [[3, 160], [4, 240], [5, 320]]) {
    q._moore26_winding_set(TX, TY, TZ, 2 * e, w);
    q._moore26_winding_set(TX, TY, TZ, 2 * e + 1, w);
  }
  for (let t = 0; t < SETTLE; t++) q._moore26_tick();
}

const incipE = (h) => {           // incipient energy within r<=4 of target
  let s = 0;
  for (let x = TX - 4; x <= TX + 4; x++) for (let y = TY - 4; y <= TY + 4; y++) for (let z = TZ - 4; z <= TZ + 4; z++) {
    if (Math.hypot(x - TX, y - TY, z - TZ) > 4) continue;
    const i = IDX(x, y, z);
    for (let c = 6; c < 18; c++) if (h[i + oi + c] > 0) s += h[i + oi + c] * (h[i + oin + c] || 1);
  }
  return s;
};
const objMass = () => Number(q._moore26_mass_get(TX, TY, TZ));

function shot(y0, nu, jitter) {
  // rand_site(si,salt) is deterministic per site+tick: identical shots
  // replay identically. Jitter + 10 cleanup ticks let stray packets
  // from the previous shot decay before this one launches.
  for (let j = 0; j < jitter + 10; j++) q._moore26_tick();
  const h0 = heap();
  const iE0 = incipE(h0), m0 = objMass();
  q._moore26_packet_set(6, y0, TZ, 6, 1);
  q._moore26_packet_nu_set(6, y0, TZ, 6, nu);
  const lo = Math.max(2, nu * 0.6), hi = nu * 1.6;
  // track: seen = probe reached the object's plane on its corridor;
  // fwdSeen = probe got PAST the object (then may still drip — that's
  // vacuum loss, not interaction — the vacuum control normalizes it).
  let seen = false, fwdSeen = false;
  for (let t = 0; t < FLIGHT; t++) {
    q._moore26_tick();
    const h = heap();
    for (let x = TX - 1; x <= TX + 8; x++) for (let y = 0; y < N; y++) for (let z = TZ - 1; z <= TZ + 1; z++) {
      if (Math.abs(y - x - (y0 - 6)) > 2) continue;
      const i = IDX(x, y, z);
      for (let c = 6; c < 18; c++) {
        const pn = h[i + on + c];
        if (h[i + op + c] > 0 && pn >= lo && pn <= hi) {
          seen = true; if (x > TX + 1) fwdSeen = true;
        }
      }
    }
  }
  // final census — forward corridor + near sphere
  const h = heap();
  let fwd = 0, fwdNu = 0, fwdCh = -1, shower = 0, showerE = 0;
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) {
    const beamD = Math.abs(y - x - (y0 - 6));
    const near = Math.hypot(x - TX, y - TY, z - TZ) <= 10;
    const fw = x > TX && beamD <= 2;
    if (!near && !fw) continue;
    const i = IDX(x, y, z);
    for (let c = 6; c < 18; c++) {
      const p = h[i + op + c], pn = h[i + on + c];
      if (p <= 0 || pn <= 0) continue;
      if (x > TX && beamD <= 2 && pn >= lo && pn <= hi && p > fwd) {
        shower += fwd; showerE += fwd * fwdNu;
        fwd = p; fwdNu = pn; fwdCh = c;
      } else { shower += p; showerE += p * pn; }
    }
  }
  const dIE = incipE(h) - iE0, dm = objMass() - m0;
  let cls;
  if (fwd > 0) cls = fwdCh === 6 ? 'transmitted' : 'deflected';
  else if (fwdSeen) cls = 'latedrip';              // past the object, died downstream — vacuum, not target
  else if (!seen) cls = 'drip';                  // died upstream — vacuum
  else if (dIE >= nu * 0.5) cls = 'armed';
  else if (showerE >= nu) cls = 'shattered';
  else cls = 'absorbed';
  return { cls, seen, fwdSeen, fwd, fwdNu, shower, showerE, dIE, dm };
}

if (SCAN === 'nu') {
  console.log(`xsec nu-scan: M=${M} b=0 shots=${SHOTS} (object line~34)`);
  for (const nu of NU_LIST) {
    const t = { transmitted: 0, deflected: 0, absorbed: 0, shattered: 0, armed: 0, drip: 0, latedrip: 0 };
    let shE = 0, dIE = 0, dm = 0;
    for (let s = 0; s < SHOTS; s++) {
      newTarget();
      const r = shot(12, nu, s % 8);
      t[r.cls]++; shE += r.showerE; dIE += r.dIE; dm += r.dm;
    }
    const live = SHOTS - t.drip;                       // reached the object plane
    const past = t.transmitted + t.latedrip;           // survived the object
    const pint = live ? (live - past) / live : 0;
    console.log(`nu=${String(nu).padStart(3)}  T=${t.transmitted} D=${t.deflected} ` +
      `A=${t.absorbed} S=${t.shattered} arm=${t.armed} drip=${t.drip} late=${t.latedrip}  ` +
      `P_int|arr=${pint.toFixed(2)} <showerE>=${(shE / SHOTS).toFixed(0)} ` +
      `<dIncipE>=${(dIE / SHOTS).toFixed(0)} <dmass>=${(dm / SHOTS).toFixed(1)}`);
  }
}

if (SCAN === 'b') {
  // round-robin: ONE object, shots interleaved across all b so target
  // drift hits every b equally. Vacuum control (--blank) gives the
  // normalization: P_int(b) = 1 - P_past(obj,b)/P_past(vac).
  console.log(`xsec b-scan: M=${M} nu=${NUFIX} shots=${SHOTS}/b ${BLANK ? 'VACUUM CONTROL' : ''}`);
  newTarget();
  const tally = {};
  for (const y0 of Y0_LIST) tally[y0] = { n: 0, past: 0, absorbed: 0, armed: 0, shattered: 0 };
  for (let s = 0; s < SHOTS; s++) {
    for (const y0 of Y0_LIST) {
      const r = shot(y0, NUFIX, (s + y0) % 8);
      const t = tally[y0];
      t.n++;
      if (r.cls === 'transmitted' || r.cls === 'latedrip' || r.cls === 'deflected') t.past++;
      if (r.cls === 'absorbed') t.absorbed++;
      if (r.cls === 'armed') t.armed++;
      if (r.cls === 'shattered') t.shattered++;
    }
  }
  for (const y0 of Y0_LIST) {
    const b = Math.abs(12 - y0) / Math.SQRT2, t = tally[y0];
    console.log(`b=${b.toFixed(2)} (y0=${y0})  past=${t.past}/${t.n}  ` +
      `absorbed=${t.absorbed} armed=${t.armed} shattered=${t.shattered}  P_past=${(t.past / t.n).toFixed(2)}`);
  }
}
