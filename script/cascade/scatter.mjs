/* scatter.mjs — interaction profile of a knot vs beam offset.
 *
 * Nature analog: elastic scattering measures a composite's matter
 * distribution (proton: exponential, rms ~0.8 fm). Here: a ch6
 * packet stream sweeps transverse offset (x-y = const lines on
 * z=Z) past a knot; the observable that fires is MOMENTUM
 * TRANSFER — the knot catches flux and surfs downwind.
 *
 * Per offset d, report the knot's displacement (cells traveled)
 * and peak downstream position. The transition offset = the
 * knot's effective interaction radius. Knot variants (--type):
 *   bare   — mass only (delta-function distribution -> hard edge?)
 *   wound  — mass + committed winding pair (does structure widen
 *            the interaction footprint? conduits reach further)
 *   blob   — 2x2 odd-cell mass block (geometric cross-section)
 *
 * Usage: node script/cascade/scatter.mjs --type=wound [--ticks=250]
 */
import { loadM26 } from '../lib/m26.mjs';

const argv = {};
for (const a of process.argv.slice(2)) {
    if (!a.startsWith('--')) continue;
    const [k, v] = a.slice(2).split('=');
    argv[k] = v === undefined ? true : v;
}
const SIZE  = +(argv.size  ?? 32);
const TICKS = +(argv.ticks ?? 250);
const NU    = +(argv.nu    ?? 140);
const GAP   = +(argv.gap   ?? 2);
const QMASS = +(argv.mass  ?? 2000);
const Z     = 15;
const KX = 15, KY = 15;
const SRC_X = 4, DST_X = 26;
const TYPE  = argv.type ?? 'bare';

const M = await loadM26();

const seedKnot = () => {
    if (TYPE === 'blob') {
        for (const [dx, dy] of [[0,0],[2,0],[0,2],[2,2]])
            M._moore26_mass_set(KX+dx, KY+dy, Z, QMASS/4);
    } else {
        M._moore26_mass_set(KX, KY, Z, QMASS);
        if (TYPE === 'wound') {
            M._moore26_winding_set(KX, KY, Z, 6, 160);
            M._moore26_winding_set(KX, KY, Z, 7, 160);
        }
    }
};
const knotCell = () => {
    let bm = 0, bx = 0, by = 0, tot = 0;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        const m = M._moore26_mass_get(x, y, Z);
        tot += m;
        if (m > bm) { bm = m; bx = x; by = y; }
    }
    return { x: bx, y: by, m: bm, tot };
};

function run(d) {
    const sx = SRC_X, sy = sx - d;
    if (sy < 0 || sy >= SIZE) return null;
    M._moore26_init(SIZE, SIZE, SIZE);
    M._moore26_recoil_law_set(4);
    M._moore26_wear_decay_set(0);
    seedKnot();

    let maxDisp = 0, firstHopT = -1;
    for (let t = 0; t < TICKS; t++) {
        if (t % GAP === 0) {
            M._moore26_packet_set(sx, sy, Z, 6, 2);
            M._moore26_packet_nu_set(sx, sy, Z, 6, NU);
        }
        M._moore26_tick();
        const p = knotCell();
        const disp = (p.x - KX) + (p.y - KY);   // +6 direction metric
        if (disp > maxDisp) { maxDisp = disp; if (firstHopT < 0) firstHopT = t; }
    }
    const p = knotCell();
    return { maxDisp, firstHopT, end: p };
}

console.log(`scatter: type=${TYPE} knot(${KX},${KY},${Z}) m=${QMASS} nu=${NU} gap=${GAP} T=${TICKS}`);
console.log('d   firstHopT   maxDisp   end');

for (let d = -7; d <= 7; d += 2) {
    const r = run(d);
    if (!r) { console.log(`${d}  skip`); continue; }
    console.log(`${d}   ${r.firstHopT}   ${r.maxDisp}   (${r.end.x},${r.end.y})m${r.end.m} tot${r.end.tot}`);
}
