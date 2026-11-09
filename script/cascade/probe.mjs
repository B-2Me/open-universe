// probe.mjs — oscilloscope probe: does a knot actually tick?
// Primes a wound knot (openbox geometry, 600t feed), then clamps
// onto a core node and records winding[6/7] + phase tick-by-tick
// for 256 ticks. Autocorrelates the series — a clean peak at
// lag τ = the knot's native internal period; flat = static
// plateau (no internal clock to dilate).
import { loadM26 } from '../lib/m26.mjs';
const q = await loadM26();
const N = 32;
q._moore26_init(N, N, N); q._moore26_evap_shift_set(4);
const CV = [,,,,,, [1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],[1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1]];
for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
  q._moore26_winding_set(16 + dx, 16 + dy, 16 + dz, 6, 60);
  q._moore26_winding_set(16 + dx, 16 + dy, 16 + dz, 7, 60);
  q._moore26_mass_set(16 + dx, 16 + dy, 16 + dz, 10);
}
const spokes = [[6, -8, 0], [8, -8, 0], [10, 0, -8], [14, 0, -8]];
const feed = () => { for (const [c, ox, oz] of spokes) {
  let sx = 16 - ox - CV[c][0], sy = 16 - oz - CV[c][1], sz = 16 - CV[c][2];
  if ((sx + sy + sz) & 1) sz++;
  q._moore26_packet_set(sx, sy, sz, c, 2); q._moore26_packet_nu_set(sx, sy, sz, c, 96); } };
// warm up the knot into the emitting plateau
for (let t = 0; t < 600; t++) { feed(); q._moore26_tick(); }
// scan 14..18^3 over 128 ticks — find which sites/channels
// actually vary (the interior is holographically shielded;
// metabolism happens on the surface shell)
const sites = [];
for (let x = 14; x <= 18; x++) for (let y = 14; y <= 18; y++) for (let z = 14; z <= 18; z++)
  if (((x + y + z) & 1) === 0) sites.push([x, y, z]);
const series = sites.map(() => ({ w: [], dd: [], ph: [], m: [] }));
for (let t = 0; t < 128; t++) {
  feed(); q._moore26_tick();
  sites.forEach(([x, y, z], idx) => {
    let sw = 0, sdd = 0;
    for (let c = 6; c < 18; c += 2) {
      const a = Number(q._moore26_winding_get(x, y, z, c));
      const b = Number(q._moore26_winding_get(x, y, z, c + 1));
      sw += a + b; sdd += a - b;
    }
    series[idx].w.push(sw);
    series[idx].dd.push(sdd);
    series[idx].ph.push(Number(q._moore26_phase_get(x, y, z)));
    series[idx].m.push(Number(q._moore26_mass_get(x, y, z)));
  });
}
const acf = (s) => {
  const m = s.reduce((a, b) => a + b, 0) / s.length;
  const v = s.reduce((a, b) => a + (b - m) ** 2, 0);
  if (!v) return null;
  const lags = [];
  for (let k = 1; k <= 16; k++) {
    let c = 0;
    for (let i = 0; i < s.length - k; i++) c += (s[i] - m) * (s[i + k] - m);
    lags.push(`${k}:${(c / v).toFixed(2)}`);
  }
  return { var: (v / s.length).toFixed(1), lags: lags.slice(0, 8).join(' '), head: s.slice(0, 16).join(',') };
};
let active = 0;
sites.forEach(([x, y, z], idx) => {
  const rw = acf(series[idx].w), rdd = acf(series[idx].dd), rph = acf(series[idx].ph), rm = acf(series[idx].m);
  if (rw || rdd || rph || rm) {
    active++;
    if (active <= 12) console.log(`(${x},${y},${z}) w=${rw ? rw.var + ' [' + rw.lags + '] ' + rw.head : 'flat'} | dd=${rdd ? rdd.var + ' [' + rdd.lags + ']' : 'flat'} | m=${rm ? rm.var + ' ' + rm.head : 'flat'} | ph=${rph ? rph.head : 'flat'}`);
  }
});
console.log(`active even-parity sites in 14..18^3: ${active} / ${sites.length}`);
