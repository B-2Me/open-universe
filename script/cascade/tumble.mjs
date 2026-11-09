// tumble.mjs — does a frozen dd pattern rotate, diffuse, or lock?
// Seed a 3x3x3 knot with a strong dd imbalance on ONE channel pair
// (w6=90, w7=30 -> dd=+60 on pair 3), then watch the dd VECTOR on
// all 6 pairs. A tumbling jam rotates the dd vector through
// orientations; a dissipating jam decays |dd|->0; a locked jam
// holds it fixed. The emit/reabsorb cycle is the substrate's only
// channel-conversion path — this measures whether it can tumble.
import { loadM26 } from '../lib/m26.mjs';

const TICKS = parseInt((process.argv.find(a => a.startsWith('--ticks=')) || '--ticks=1500').split('=')[1]);
const FEED = process.argv.includes('--feed');
const q = await loadM26();
const N = 32;
q._moore26_init(N, N, N); q._moore26_evap_shift_set(4);

const CV = [,,,,,, [1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],[1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1]];
// pair index -> channel pair: e=3 is ch6/7 ({1,1,0}); all pairs are ch(2e)/ch(2e+1), e=3..8 for edges
const PAIRS = [[6,7],[8,9],[10,11],[12,13],[14,15],[16,17]];
for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
  q._moore26_winding_set(16 + dx, 16 + dy, 16 + dz, 6, 90);
  q._moore26_winding_set(16 + dx, 16 + dy, 16 + dz, 7, 30);
  q._moore26_mass_set(16 + dx, 16 + dy, 16 + dz, 10);
}
const spokes = [[6, -8, 0], [8, -8, 0], [10, 0, -8], [14, 0, -8]];
const feed = () => { for (const [c, ox, oz] of spokes) {
  let sx = 16 - ox - CV[c][0], sy = 16 - oz - CV[c][1], sz = 16 - CV[c][2];
  if ((sx + sy + sz) & 1) sz++;
  q._moore26_packet_set(sx, sy, sz, c, 2); q._moore26_packet_nu_set(sx, sy, sz, c, 96); } };

// dd vector over the knot box: dd_e = sum(w[2e]-w[2e+1]), W_e = sum(w[2e]+w[2e+1])
function ddvec() {
  const dd = [0,0,0,0,0,0], W = [0,0,0,0,0,0];
  for (let x = 10; x <= 22; x++) for (let y = 10; y <= 22; y++) for (let z = 10; z <= 22; z++) {
    for (let e = 0; e < 6; e++) {
      const a = Number(q._moore26_winding_get(x, y, z, PAIRS[e][0]));
      const b = Number(q._moore26_winding_get(x, y, z, PAIRS[e][1]));
      dd[e] += a - b; W[e] += a + b;
    }
  }
  return { dd, W };
}
const fmt = (dd, W) => {
  const mag = Math.hypot(...dd).toFixed(0);
  const dom = dd.indexOf(Math.max(...dd.map(Math.abs))) ?? -1;
  return `dd=[${dd.map(v => String(v).padStart(5))}] |dd|=${mag} dom=pair${dom + 3} W=[${W.map(v => String(v).padStart(5))}]`;
};

console.log(`tumble: seed dd=+60/pair3 on 27 nodes, feed=${FEED}, ticks=${TICKS}`);
{ const { dd, W } = ddvec(); console.log(`t=0   ${fmt(dd, W)}`); }
for (let t = 100; t <= TICKS; t += 100) {
  for (let i = 0; i < 100; i++) { if (FEED) feed(); q._moore26_tick(); }
  const { dd, W } = ddvec(); console.log(`t=${t} ${fmt(dd, W)} ev4=${q._moore26_events(4)}`);
}
