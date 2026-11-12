#!/usr/bin/env node
/* interferometer.mjs — two-arm transactional interferometry on the torus.
 *
 * The torus IS the beam splitter: one emitter fires both members of an
 * edge pair. Arm A takes the short geodesic to the detector (k hops);
 * arm B wraps the long way (32-k hops). Same wavefront, deterministic
 * arm-length asymmetry Δ = (32-2k) ticks — no deflectors required.
 *
 * Detector D is a catch node (small mass so site_level>0). Each arrival
 * carries a real phase: op = nu*age mod 256, where age = qTick - born.
 * Arm B's quanta arrive Δ ticks later, so op_B = op_A + nu*Δ mod 256 —
 * the path-length phase shift. qPhaseGate at D scans the receptive
 * window: sweeping emitter nu shifts both arms' phases coherently —
 * the fringe is detector acceptance vs phase offset.
 *
 * Arms (32-torus, edge pair 3 = ch6/ch7, E=(8,8,15) D=(16,16,15)):
 *   A: ch6 [1,1,0]  — 8 hops to D
 *   B: ch7 [-1,-1,0] — 24 hops (wraparound)
 *
 * Readout per tick after emission: packets/winding/incipient near D,
 * and the journal confirm events at D. Fringe sweep: --nuscan varies
 * emitter nu; record settle count at D per nu value.
 *
 * Usage: node script/cascade/interferometer.mjs [--nu=64] [--nuscan=1]
 *        [--wall=1] [--dmass=40] [--catch=4] [--phasegate=0]
 */

import { loadM26 } from '../lib/m26.mjs';

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true];
}));
const SIZE  = 32;
const E = [8, 8, 14], D = [16, 16, 14];  /* even-parity cells only */
const ARM_A = 6, ARM_B = 7;
const DMASS = +argv.dmass || 40;
const CATCH = +argv.catch || 4;
const PGATE = +argv.phasegate || 0;
const WALL  = !!argv.wall;
const CARVE = +argv.carve || 0;  /* pre-warm arm B's lane for N ticks */
const DRAIN = +argv.drain || 0;  /* empty ticks after carve — residue dies, wear persists */

const M = await loadM26();

/* per-tick snapshot at D: winding on the two arrival channels,
 * mass, heat — plus packet occupancy on each arm's final approach */
function snapD() {
    return {
        w6: M._moore26_winding_get(D[0], D[1], D[2], 6),
        w7: M._moore26_winding_get(D[0], D[1], D[2], 7),
        mass: M._moore26_mass_get(D[0], D[1], D[2]),
        heat: M._moore26_heat_get(D[0], D[1], D[2]),
        p6: M._moore26_packet_get(D[0], D[1], D[2], 6),
        p7: M._moore26_packet_get(D[0], D[1], D[2], 7),
    };
}

function run(nu, verbose) {
    M._moore26_init(SIZE, SIZE, SIZE);
    M._moore26_catch_gate_set(CATCH);
    M._moore26_axial_catch_set ? M._moore26_axial_catch_set(0) : 0;
    if (PGATE && M._moore26_phase_gate_set) M._moore26_phase_gate_set(PGATE);
    /* detector: modest mass — enough level to arm, not enough to
     * self-structure */
    M._moore26_mass_set(D[0], D[1], D[2], DMASS);
    if (WALL) {
        /* dispersive arm: saturated wall one hop off arm-B's path,
         * covering a few cells — packets deflect, delay becomes a
         * distribution rather than a fixed Δ */
        for (const [wx, wy, wz] of [[4, 4, 14], [5, 5, 14], [6, 6, 14]])
            M._moore26_mass_set(wx, wy, wz, 60000);
    }
    /* carve phase — pre-stream arm B's lane so transactional history
     * lowers its drip floor before the wavefront is emitted */
    for (let t = 0; t < CARVE; t++) {
        M._moore26_packet_set(E[0], E[1], E[2], ARM_B, 6);
        M._moore26_packet_nu_set(E[0], E[1], E[2], ARM_B, 1);
        M._moore26_tick();
    }
    /* drain: circulating carve residue dies to the drip floor;
     * the wear records persist — warm lane, clear field */
    for (let t = 0; t < DRAIN; t++) M._moore26_tick();
    /* the pulse: one wavefront, both arms, born same tick.
     * nu is scaled to the detector's level so arrivals are on-shell */
    let line = DMASS >> 2; if (line < 1) line = 1;
    const onu = Math.max(line, Math.min(127, nu - (nu % line)));
    M._moore26_packet_set(E[0], E[1], E[2], ARM_A, 3);
    M._moore26_packet_set(E[0], E[1], E[2], ARM_B, 3);
    M._moore26_packet_nu_set(E[0], E[1], E[2], ARM_A, onu);
    M._moore26_packet_nu_set(E[0], E[1], E[2], ARM_B, onu);
    M._moore26_packet_par_set(E[0], E[1], E[2], ARM_A, 1);
    M._moore26_packet_par_set(E[0], E[1], E[2], ARM_B, 1);

    const trace = [];
    let prev = snapD();
    for (let t = 0; t < 44; t++) {
        /* sustained wavefront: refresh the emitter for the first
         * 6 ticks so both arms get statistics (and arm B's own
         * traffic warms its lane — measured reach physics) */
        if (t < 6) {
            M._moore26_packet_set(E[0], E[1], E[2], ARM_A, 4);
            M._moore26_packet_set(E[0], E[1], E[2], ARM_B, 4);
            M._moore26_packet_nu_set(E[0], E[1], E[2], ARM_A, onu);
            M._moore26_packet_nu_set(E[0], E[1], E[2], ARM_B, onu);
            M._moore26_packet_par_set(E[0], E[1], E[2], ARM_A, 1);
            M._moore26_packet_par_set(E[0], E[1], E[2], ARM_B, 1);
        }
        M._moore26_tick();
        const s = snapD();
        const dw6 = s.w6 - prev.w6, dw7 = s.w7 - prev.w7;
        /* phase readout: each arriving packet's born-tick gives its
         * age -> op = nu*age mod 256 — the arm's path-length phase */
        if (verbose) for (const c of [6, 7]) {
            const pk = M._moore26_packet_get(D[0], D[1], D[2], c);
            if (pk) {
                const born = M._moore26_packet_born_get(D[0], D[1], D[2], c);
                const pnu = M._moore26_packet_nu_get(D[0], D[1], D[2], c);
                const qt = CARVE + DRAIN + t;
                const age = (qt - born + 256) & 255;
                console.log(`t=${t} arm${c === 6 ? 'A' : 'B'} arrived pk=${pk} nu=${pnu} born=${born} age=${age} op=${(pnu * age) & 255}`);
            }
        }
        if (verbose && (dw6 > 0 || dw7 > 0))
            console.log(`t=${t} +w6=${dw6} +w7=${dw7} w6=${s.w6} w7=${s.w7} heat=${s.heat}`);
        trace.push({ t, dw6, dw7, w6: s.w6, w7: s.w7 });
        prev = s;
    }
    /* settle counts: winding growth above wear (+1 per transit) */
    const sA = trace.reduce((a, r) => a + Math.max(0, r.dw6 - 1), 0);
    const sB = trace.reduce((a, r) => a + Math.max(0, r.dw7 - 1), 0);
    return { sA, sB, trace };
}

if (argv.nuscan) {
    console.log('nu   armA_deposits  armB_deposits');
    for (let nu = 16; nu <= 128; nu += 8) {
        const r = run(nu - (nu % (DMASS>>2) || 0), false);
        console.log(`${nu}   ${String(r.sA).padStart(10)}   ${String(r.sB).padStart(10)}`);
    }
} else {
    const nu = +argv.nu || 64;
    console.log(`interferometer: E=${E} D=${D} nu=${nu} armA=8hop armB=24hop wall=${WALL}`);
    run(nu, true);
}
