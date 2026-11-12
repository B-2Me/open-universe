#!/usr/bin/env node
/* pair-cone.mjs — joint-coincidence axial measurement on scar-produced pairs.
 *
 * Stage-4 of the Bell program: two products of one annihilation scar are
 * probed SIMULTANEOUSLY on independently chosen analyzer settings, and the
 * joint outcome table E(a,b) = <outcomeA * outcomeB> is measured.
 *
 * Analyzer setting = (edge-pair, probe parity): the probe is an offer
 * quantum injected one edge-hop upstream of the product so it arrives on
 * the chosen channel with the chosen parity stamp.
 * Outcome = +1 if the offer settles (channel winding jumps >=4 — a real
 * confirm deposit, vs the +1 transport wear of a mere transit), else -1.
 *
 * Axis control: --axis=x|y|z seeds the annihilating parents separated on
 * that face axis; the acceptance cone (minted bondDist + mirrored dd
 * skeleton on the axis-containing edge pairs) must FOLLOW the scar axis —
 * a grid-bias artifact would not rotate.
 *
 * Honest expectation: this substrate is an explicitly local, deterministic
 * hidden-variable model — the parity sub-table should saturate the
 * classical CHSH bound |S|=2 (perfect anti-correlation under matched
 * settings), not exceed it. S>2 means a bug or a genuinely non-classical
 * statistics emerging from transaction mechanics — either way, report it.
 *
 * Usage: node script/cascade/pair-cone.mjs [--trials=N] [--axis=x|y|z]
 *        [--gate=N] [--size=32] [--seedparents=1]
 */

import { loadM26 } from '../lib/m26.mjs';

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true];
}));
const TRIALS = +argv.trials || 40;
const AXIS   = argv.axis || 'x';
const GATE   = argv.gate !== undefined ? +argv.gate : 200;
const SIZE   = +argv.size || 32;
const AXIAL  = argv.axial !== undefined ? +argv.axial : 1;  /* axial catch shift (0=off) */
const SHOTS  = +argv.shots || 3;                            /* quanta per probe arm */
const CATCH  = +argv.catch || 4;                            /* catch gate (P=lvl/CATCH) */
const CHARGE = +argv.charge || 0;                           /* on-cone feed ticks before probing */

/* FCC edge-channel transport vectors, channels 6..17 */
const V = [[1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],
           [1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1]];

/* axis-containing edge pairs per face axis (from production AXP table) */
const CONE = { x: [3,4,5,6], y: [3,4,7,8], z: [5,6,7,8] };
const ALLP = [3,4,5,6,7,8];
const inCone = (axis, pair) => CONE[axis].includes(pair);

/* parent seeding: two opposite-parity masses separated on the face axis */
const PSEP = { x: [[15,15,15],[17,15,15]],
               y: [[15,15,15],[15,17,15]],
               z: [[15,15,15],[15,15,17]] };

const M = await loadM26();

function findProducts() {
    const out = [];
    for (let x = 6; x < 26; x++)
        for (let y = 9; y < 22; y++)
            for (let z = 9; z < 22; z++) {
                const m = M._moore26_mass_get(x, y, z);
                if (m > 50) out.push([x, y, z, m, M._moore26_bondpar_get(x, y, z)]);
            }
    return out;
}

/* one joint trial: produce pair, settle, probe BOTH arms at once.
 * settings: {aPair, aPar, bPair, bPar} — pair index 3..8, parity +1/-1.
 * returns [okA, okB] booleans, or null if the pair didn't form. */
function trial(st) {
    M._moore26_init(SIZE, SIZE, SIZE);
    M._moore26_par_gate_set(1);
    M._moore26_align_gate_set(GATE);
    M._moore26_catch_gate_set(CATCH);
    if (M._moore26_axial_catch_set) M._moore26_axial_catch_set(AXIAL);
    const [pa, pb] = PSEP[AXIS];
    M._moore26_mass_set(...pa, 500); M._moore26_bondpar_set(...pa, 127);
    M._moore26_mass_set(...pb, 500); M._moore26_bondpar_set(...pb, -127);
    for (let k = 0; k < 8; k++) M._moore26_tick();
    const ps = findProducts();
    const A = ps.find(p => p[4] > 0), B = ps.find(p => p[4] < 0);
    if (!A || !B) return null;

    /* CHARGE phase — feed each product matched-parity offers on its
     * containing pairs so the skeleton accretes real committed
     * exchange through transactions (the species-inverse rebuild),
     * not just the minted seed that bleeds thin during the hop. */
    if (CHARGE) {
        for (let k = 0; k < CHARGE; k++) {
            for (const [P, par] of [[A, 1], [B, -1]]) {
                for (const pair of CONE[AXIS]) {
                    const c = 2 * pair, v = V[c - 6];
                    const sx = P[0] - v[0], sy = P[1] - v[1], sz = P[2] - v[2];
                    if (sx < 1 || sy < 1 || sz < 1 || sx >= SIZE-1 || sy >= SIZE-1 || sz >= SIZE-1) continue;
                    let line = (P[3] + (M._moore26_winding_get(P[0],P[1],P[2],c) >> 2)) >> 2;
                    if (line < 1) line = 1;
                    M._moore26_packet_set(sx, sy, sz, c, 2);
                    M._moore26_packet_nu_set(sx, sy, sz, c, line > 127 ? 127 : line);
                    M._moore26_packet_par_set(sx, sy, sz, c, par);
                }
            }
            M._moore26_tick();
        }
        /* settle gap — let the feed's armed incipients confirm or
         * expire, else probes hit a congested table (ev46 deflects
         * and the feed's own residue pollutes the readout) */
        for (let k = 0; k < 6; k++) M._moore26_tick();
        /* re-locate — accretion may have moved the products */
        const ps2 = findProducts();
        const A2 = ps2.find(p => p[4] > 0), B2 = ps2.find(p => p[4] < 0);
        if (A2 && B2) { A[0]=A2[0]; A[1]=A2[1]; A[2]=A2[2]; A[3]=A2[3]; B[0]=B2[0]; B[1]=B2[1]; B[2]=B2[2]; B[3]=B2[3]; }
    }

    /* sustained probe stream — a packet visits the cell one tick, so
     * each tick re-seeds fresh quanta upstream of BOTH products: every
     * tick is a new arming draw (the refusal-verified geometry). */
    const shots = [];
    const arms = st.solo ? [[A, st.aPair, st.aPar]] : [[A, st.aPair, st.aPar], [B, st.bPair, st.bPar]];
    for (const [P, pair, par] of arms) {
        const c = 2 * pair; /* + member of the pair */
        const w0 = M._moore26_winding_get(P[0], P[1], P[2], c)
            + M._moore26_winding_get(P[0], P[1], P[2], c ^ 1);
        let line = (P[3] + (w0 >> 2)) >> 2; if (line < 1) line = 1;
        const v = V[c - 6];
        const sx = P[0] - v[0], sy = P[1] - v[1], sz = P[2] - v[2];
        if (sx < 1 || sy < 1 || sz < 1 || sx >= SIZE-1 || sy >= SIZE-1 || sz >= SIZE-1) return null;
        shots.push([P, c, w0, sx, sy, sz, line > 127 ? 127 : line, par]);
    }
    for (let k = 0; k < 6; k++) {
        for (const [, c, , sx, sy, sz, nu, par] of shots) {
            M._moore26_packet_set(sx, sy, sz, c, SHOTS);
            M._moore26_packet_nu_set(sx, sy, sz, c, nu);
            M._moore26_packet_par_set(sx, sy, sz, c, par);
        }
        M._moore26_tick();
    }
    return shots.map(([P, c, w0]) => M._moore26_winding_get(P[0], P[1], P[2], c)
        + M._moore26_winding_get(P[0], P[1], P[2], c ^ 1) - w0 >= 8);
}

/* settings matrix: arms use (cone-membership × parity) on the pair axis.
 * onC = a containing pair (first member), offC = transverse pair,
 * +P = probe parity matching arm's bondPar sign, -P = crossed.
 * Setting labels: [cone, parity] e.g. on+ = containing pair, matched. */
const settings = [
    { aPair: CONE[AXIS][0], aPar: +1, bPair: CONE[AXIS][0], bPar: +1, tag: 'onC + | onC +' },
    { aPair: CONE[AXIS][0], aPar: +1, bPair: CONE[AXIS][0], bPar: -1, tag: 'onC + | onC -' },
    { aPair: CONE[AXIS][0], aPar: -1, bPair: CONE[AXIS][0], bPar: +1, tag: 'onC - | onC +' },
    { aPair: CONE[AXIS][0], aPar: -1, bPair: CONE[AXIS][0], bPar: -1, tag: 'onC - | onC -' },
    { aPair: ALLP.find(p => !inCone(AXIS, p)), aPar: +1, bPair: CONE[AXIS][0], bPar: +1, tag: 'offC + | onC +' },
    { aPair: CONE[AXIS][0], aPar: +1, bPair: ALLP.find(p => !inCone(AXIS, p)), bPar: +1, tag: 'onC + | offC +' },
];

console.log(`pair-cone: axis=${AXIS} gate=${GATE} trials=${TRIALS} size=${SIZE} charge=${CHARGE}`);
console.log(`cone pairs: ${CONE[AXIS].join(',')}  transverse: ${ALLP.filter(p=>!inCone(AXIS,p)).join(',')}`);

/* --sweep mode: single-arm angular response curve — probe A with
 * matched parity on each of the six edge pairs, report settle rate.
 * This is the substrate's E(theta): acceptance vs measurement axis. */
if (argv.sweep) {
    console.log('pair     P(settle)  N   cone?');
    for (const pair of ALLP) {
        let n = 0, ok = 0;
        for (let t = 0; t < TRIALS; t++) {
            const r = trial({ aPair: pair, aPar: +1, bPair: pair, bPar: -1, solo: true });
            if (!r) continue;
            n++; if (r[0]) ok++;
        }
        console.log(`p${pair}      ${(n ? ok / n : NaN).toFixed(3).padStart(7)} ${String(n).padStart(5)}   ${inCone(AXIS, pair) ? 'CONE' : 'transverse'}`);
    }
    process.exit(0);
}

console.log('setting            E(A,B)   P(A+)   P(B+)   P(both)  N');
for (const st of settings) {
    let n = 0, sum = 0, aA = 0, aB = 0, both = 0;
    for (let t = 0; t < TRIALS; t++) {
        const r = trial(st);
        if (!r) continue;
        n++;
        const oA = r[0] ? 1 : -1, oB = r[1] ? 1 : -1;
        sum += oA * oB; aA += r[0]; aB += r[1]; both += (r[0] && r[1]);
    }
    console.log(`${st.tag.padEnd(18)} ${(n ? sum / n : NaN).toFixed(3).padStart(7)} ${(n ? aA / n : NaN).toFixed(3).padStart(7)} ${(n ? aB / n : NaN).toFixed(3).padStart(7)} ${(n ? both / n : NaN).toFixed(3).padStart(8)} ${String(n).padStart(4)}`);
}
