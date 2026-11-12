/* noise-spectrum.mjs — is Gaussian "free" in a structured medium?
 * Drive a single lane stream; count stray packets per tick in a probe
 * patch off the lane (displaced diagonals the sidescatter halo feeds).
 * Coarse-grain the count series at bin widths 1..64 ticks and report
 * Fano factor (var/mean), skewness, excess kurtosis, autocorrelation.
 * Poisson floor: F=1, skew=1/sqrt(lambda), exkurt=1/lambda.
 * Structured noise shows up as F!=1 persisting at coarse bins and/or
 * nonzero autocorrelation beyond the transit time.
 *   node script/cascade/noise-spectrum.mjs [--ticks=4000] [--nu=60]
 */
import { loadM26 } from '../lib/m26.mjs';
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true];
}));
const M = await loadM26();
const SIZE = 32, E = [8, 8, 14];
const TICKS = +argv.ticks || 4000;
const NU = +argv.nu || 60;
/* probe patch: off-lane diagonals adjacent to the ch6 lane (x==y).
 * cells (12..16, 10..14, z=14) minus the lane diagonal — catches
 * sidescattered parallel flow on displaced diagonals x-y in [-2..6] */
const PATCH = [];
for (let x = 12; x <= 16; x++) for (let y = 10; y <= 14; y++)
    if (x !== y) PATCH.push([x, y, 14]);

M._moore26_init(SIZE, SIZE, SIZE);
M._moore26_catch_gate_set(4);
M._moore26_phase_gate_set(0);
M._moore26_phase_sync_set(1);
if (argv.ttl) M._moore26_incip_ttl_set(+argv.ttl);

const series = new Float64Array(TICKS);
for (let t = 0; t < TICKS; t++) {
    M._moore26_packet_set(...E, 6, 8);
    M._moore26_packet_nu_set(...E, 6, NU);
    M._moore26_packet_par_set(...E, 6, 1);
    M._moore26_tick();
    let s = 0;
    for (const [x, y, z] of PATCH)
        for (let c = 0; c < 26; c++) s += M._moore26_packet_get(x, y, z, c);
    series[t] = s;
}

function binned(a, w) {
    const n = Math.floor(a.length / w), out = new Float64Array(n);
    for (let i = 0; i < n; i++) for (let j = 0; j < w; j++) out[i] += a[i * w + j];
    return out;
}
function stats(a) {
    const n = a.length, m = a.reduce((s, v) => s + v, 0) / n;
    let m2 = 0, m3 = 0, m4 = 0;
    for (const v of a) { const d = v - m; m2 += d * d; m3 += d * d * d; m4 += d * d * d * d; }
    const v = m2 / n;
    return { mean: m, var: v, fano: m > 0 ? v / m : 0,
             skew: v > 0 ? (m3 / n) / Math.pow(v, 1.5) : 0,
             kurt: v > 0 ? (m4 / n) / (v * v) - 3 : 0 };
}
/* autocorrelation of the raw series */
const mu = stats(series).mean;
let num = [];
for (let lag = 1; lag <= 24; lag++) {
    let s = 0, v0 = 0;
    for (let t = 0; t < series.length - lag; t++) s += (series[t] - mu) * (series[t + lag] - mu);
    for (let t = 0; t < series.length - lag; t++) v0 += (series[t] - mu) * (series[t] - mu);
    num.push(v0 > 0 ? s / v0 : 0);
}
console.log(`noise spectrum: nu=${NU} ticks=${TICKS} patch=${PATCH.length} cells`);
console.log('autocorr lag1..24:', num.map(v => v.toFixed(2)).join(' '));
console.log('W     mean    var     Fano    skew    exkurt   [Poisson: F=1 skew=1/sqrt(lam) kurt=1/lam]');
for (const w of [1, 2, 4, 8, 16, 32, 64]) {
    const b = binned(series, w), s = stats(b);
    console.log(`${String(w).padStart(3)}   ${s.mean.toFixed(3)}  ${s.var.toFixed(3)}   ${s.fano.toFixed(3)}   ${s.skew.toFixed(3)}   ${s.kurt.toFixed(3)}`);
}
process.exit(0);
