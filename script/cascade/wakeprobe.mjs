// wakeprobe.mjs — does motion write an anisotropic age field?
// The drifting knot under isotropic BATH=0.02 (the verified
// photon-rocket regime, wcx ~ +1/2000t). If translation is real,
// the leading face accretes fresh material (young) while the
// trailing face persists (old) -> mean bondAge skews along v.
// Isotropic bath => axis asymmetry is signal ONLY if it tracks the
// measured drift direction. Hemispheric age split per axis + drift.
import { loadM26, rng } from '../lib/m26.mjs';

const TICKS = parseInt((process.argv.find(a => a.startsWith('--ticks=')) || '--ticks=2000').split('=')[1]);
const BATH = 0.02;
const q = await loadM26();
const N = 32;
q._moore26_init(N, N, N); q._moore26_evap_shift_set(4);

const OFF = { bondTick: 448, workAge: 452, winding: 0 };
const nodeSize = q._moore26_node_size();
const idx = (x, y, z) => (z * N * N + y * N + x);
const heap = () => new Uint8Array(q.wasmMemory.buffer, q._moore26_state_pointer(), nodeSize * N * N * N);
const u32 = (i) => { const b = heap(); return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0; };
const u16 = (i) => { const b = heap(); return b[i] | (b[i + 1] << 8); };

const CV = [,,,,,, [1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],[1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1]];
for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
  q._moore26_winding_set(16 + dx, 16 + dy, 16 + dz, 6, 60);
  q._moore26_winding_set(16 + dx, 16 + dy, 16 + dz, 7, 60);
  q._moore26_mass_set(16 + dx, 16 + dy, 16 + dz, 10);
}
const rnd = rng(42);
const bath = () => {
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) {
    if (x > 1 && x < N - 2 && y > 1 && y < N - 2 && z > 1 && z < N - 2) continue;
    for (let c = 6; c < 18; c++) {
      const nx = x + CV[c][0], ny = y + CV[c][1], nz = z + CV[c][2];
      if (nx < 0 || nx >= N || ny < 0 || ny >= N || nz < 0 || nz >= N) continue;
      if (rnd() / 0x7fffffff < BATH) { q._moore26_packet_set(x, y, z, c, 1); q._moore26_packet_nu_set(x, y, z, c, 96); }
    }
  }
};
const drain = () => { for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) {
  if (x > 1 && x < N - 2 && y > 1 && y < N - 2 && z > 1 && z < N - 2) continue;
  for (let c = 0; c < 26; c++) { q._moore26_packet_set(x, y, z, c, 0); q._moore26_winding_set(x, y, z, c, 0); } } };

// winding-weighted centroid over the knot box
const wcent = () => {
  const s = [0, 0, 0]; let sm = 0;
  for (let x = 6; x <= 26; x++) for (let y = 6; y <= 26; y++) for (let z = 6; z <= 26; z++) {
    const i = idx(x, y, z) * nodeSize;
    let w = 0; for (let c = 0; c < 26; c++) w += u16(i + OFF.winding + 2 * c);
    if (w) { s[0] += w * x; s[1] += w * y; s[2] += w * z; sm += w; }
  }
  return sm ? s.map(v => v / sm) : [16, 16, 16];
};

// hemispheric bondAge around the centroid, per axis
// (primordial bondTick=0 nodes excluded — they never bonded)
const hemis = (c, t) => {
  const out = {};
  for (const ax of ['x', 'y', 'z']) out[ax] = { lo: { n: 0, s: 0, w: 0 }, hi: { n: 0, s: 0, w: 0 } };
  const cc = { x: c[0], y: c[1], z: c[2] };
  for (let x = 6; x <= 26; x++) for (let y = 6; y <= 26; y++) for (let z = 6; z <= 26; z++) {
    const i = idx(x, y, z) * nodeSize;
    const bt = u32(i + OFF.bondTick), wa = u32(i + OFF.workAge);
    if (!bt && !wa) continue;
    const age = bt ? t - bt : 0;
    for (const ax of ['x', 'y', 'z']) {
      const p = { x, y, z }[ax];
      const side = p < cc[ax] ? 'lo' : p > cc[ax] ? 'hi' : null;
      if (!side) continue;
      out[ax][side].n++; out[ax][side].s += age; out[ax][side].w += wa;
    }
  }
  return out;
};

console.log(`wakeprobe: ticks=${TICKS} bath=${BATH} — hemispheric bondAge vs drift`);
let t = 0;
for (let e = 0; e < TICKS / 500; e++) {
  for (let i = 0; i < 500; i++) { bath(); q._moore26_tick(); drain(); t++; }
  const c = wcent(), h = hemis(c, t);
  const f = (a) => a.n ? (a.s / a.n).toFixed(0) : '-';
  const g = (a) => a.n ? (a.w / a.n).toFixed(1) : '-';
  console.log(`t=${t} c=(${c.map(v => v.toFixed(1))}) ` +
    ['x', 'y', 'z'].map(ax =>
      `${ax}: age ${f(h[ax].lo)}/${f(h[ax].hi)} work ${g(h[ax].lo)}/${g(h[ax].hi)}`).join(' '));
}
