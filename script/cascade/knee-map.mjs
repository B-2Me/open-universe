/* knee-map.mjs — map the merge-gate arbitration boundary.
 * Fix nu, scan emitter position E=(k,k,14) along the diagonal so each
 * placement yields a different arm-length difference DeltaL and hence
 * a different relative phase dphi = nu*DeltaL at detector D=(16,16,14).
 * For each E: merge=48 and merge=0 runs on fresh grids; the observable
 * is B-arm admission relative to the no-law baseline at matched flux.
 *   node script/cascade/knee-map.mjs [--nu=8] [--merge=48] [--window=80]
 */
import { loadM26 } from '../lib/m26.mjs';
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true];
}));
const M = await loadM26();
const SIZE = 32, D = [16, 16, 14], ARM_A = 6, ARM_B = 7;
const NU = +argv.nu || 8;
const MERGE = argv.merge !== undefined ? +argv.merge : 48;
const W = +argv.window || 80;
const DMASS = 40;

function run(k, merge) {
    const E = [k, k, 14];
    const LB = ((E[0] - D[0]) % SIZE + SIZE) % SIZE;
    M._moore26_init(SIZE, SIZE, SIZE);
    M._moore26_catch_gate_set(4);
    M._moore26_phase_gate_set(0);
    M._moore26_phase_adv_set(8);
    M._moore26_phase_sync_set(1);
    M._moore26_incip_ttl_set(32);
    M._moore26_merge_min_set(40);
    M._moore26_merge_gate_set(merge);
    M._moore26_mass_set(D[0], D[1], D[2], DMASS);
    for (let t = 0; t < 100; t++) {
        M._moore26_packet_set(...E, ARM_A, 6);
        M._moore26_packet_set(...E, ARM_B, 6);
        M._moore26_packet_nu_set(...E, ARM_A, 1);
        M._moore26_packet_nu_set(...E, ARM_B, 1);
        M._moore26_tick();
    }
    for (let t = 0; t < 140; t++) M._moore26_tick();
    /* nominal arm-B arrival phase: measured arrivals show age = LB-1;
     * strict attribution = ch7 incipient whose frozen op is within
     * +-24 units (3 hops at nu=8) of the nominal lane phase — rejects
     * off-route wanderers that sneak in carrying arm-A-like phases */
    const expB = (NU * (LB - 1)) & 255;
    const circ = d => { d = Math.abs(d); return d > 128 ? 256 - d : d; };
    let aA = 0, aB = 0, aBs = 0, both = 0;
    const ev0 = Number(M._moore26_events(50));
    const h0 = M._moore26_heat_get(...D);
    for (let t = 0; t < W; t++) {
        const w6a = M._moore26_winding_get(...D, 6),
              w7a = M._moore26_winding_get(...D, 7);
        M._moore26_packet_set(...E, ARM_A, 8);
        M._moore26_packet_set(...E, ARM_B, 8);
        M._moore26_packet_nu_set(...E, ARM_A, NU);
        M._moore26_packet_nu_set(...E, ARM_B, NU);
        M._moore26_packet_par_set(...E, ARM_A, 1);
        M._moore26_packet_par_set(...E, ARM_B, 1);
        M._moore26_tick();
        const i7 = M._moore26_incipient_get(...D, 7);
        const okA = (M._moore26_winding_get(...D, 6) - w6a > 1)
                 || (M._moore26_incipient_get(...D, 6) > 0);
        const okB = (M._moore26_winding_get(...D, 7) - w7a > 1) || (i7 > 0);
        const okBs = i7 > 0 && circ(M._moore26_incipop_get(...D, 7) - expB) <= 24;
        if (okA) aA++; if (okB) aB++; if (okBs) aBs++;
        if (okA && okB) both++;
    }
    return {
        pA: aA / W, pB: aB / W, pBs: aBs / W, joint: both / W,
        pd: Number(M._moore26_events(50)) - ev0,
        dh: M._moore26_heat_get(...D) - h0,
    };
}

console.log(`knee map: nu=${NU} merge=${MERGE} window=${W}`);
console.log('k    LA   LB   dL   dphi  dist  P(A)on P(B)on P(B)strict joint  pd    P(B)off  suppr  +hOn  +hOff');
const KS = argv.ks ? argv.ks.split(',').map(Number)
    : Array.from({ length: 15 }, (_, i) => i + 1);
for (const k of KS) {
    const E = [k, k, 14];
    const LA = ((D[0] - E[0]) % SIZE + SIZE) % SIZE;
    const LB = ((E[0] - D[0]) % SIZE + SIZE) % SIZE;
    const dL = LB - LA;
    const dphi = (NU * dL) & 255;
    const dist = Math.min(dphi, 256 - dphi);
    const on = run(k, MERGE);
    const off = run(k, 0);
    const sup = off.pB > 0.01 ? (1 - on.pBs / off.pB).toFixed(2) : '  - ';
    console.log(
        `${String(k).padStart(2)}   ${String(LA).padStart(2)}   ${String(LB).padStart(2)}   ${String(dL).padStart(2)}   ${String(dphi).padStart(3)}   ${String(dist).padStart(3)}   ` +
        `${on.pA.toFixed(2)}   ${on.pB.toFixed(2)}   ${on.pBs.toFixed(2)}   ${on.joint.toFixed(2)}   ${String(on.pd).padStart(3)}   ${off.pB.toFixed(2)}    ${sup}   ${on.dh}   ${off.dh}`
    );
}
process.exit(0);
