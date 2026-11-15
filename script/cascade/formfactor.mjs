// formfactor.mjs — probe-beam scattering off wound structures vs nu.
// Measures deflection count (ev30 congestion-diverts + ev50 merge declines)
// and surviving flux in a box around the knot, swept over probe nu and
// structure extent L. Bare-mass control included.
// Finding: response is nu-structured — a transmission dip at nu=24
// (zero deflections at every length) and rising deflection above ~48;
// extent dependence saturates once the tube intercepts the beam.
import { loadM26 } from '../lib/m26.mjs';

const M = await loadM26();
const SIZE = 24;
const K = [12, 12, 12];
const SRC = [12, 11, 11];
const CH = 14;
const ev = i => Number(M._moore26_events(i));
const NUS = [8, 16, 24, 32, 48, 64, 96, 128];

function shoot(nu, build) {
  M._moore26_init(SIZE, SIZE, SIZE);
  M._moore26_wear_decay_set(0);
  M._moore26_incip_ttl_set(249);
  build();
  const e30 = ev(30), e50 = ev(50);
  for (let t = 0; t < 60; t++) {
    for (let k = 0; k < 8; k++) {
      M._moore26_packet_set(...SRC, CH, 4);
      M._moore26_packet_nu_set(...SRC, CH, nu);
    }
    M._moore26_tick();
  }
  let out = 0;
  for (let x = 9; x < 16; x++) for (let y = 9; y < 16; y++) for (let z = 9; z < 16; z++)
    for (let c = 0; c < 26; c++) out += M._moore26_packet_get(x, y, z, c);
  return { out, def: ev(30) - e30, dec: ev(50) - e50 };
}

const bare = () => M._moore26_mass_set(...K, 512);
const wound = () => {
  M._moore26_mass_set(...K, 512);
  for (const ch of [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]) M._moore26_winding_set(...K, ch, 96);
};
const tube = L => () => {
  M._moore26_mass_set(...K, 512);
  for (let d = -L; d <= L; d++) {
    const p = [12, 12 - d, 12 - d];
    for (const ch of [6, 7, 8, 9, 10, 11, 12, 13]) M._moore26_winding_set(...p, ch, 96);
  }
};

for (const nu of NUS) {
  const row = [`nu=${nu}`];
  for (const [n, b] of [['bare', bare], ['wound', wound], ['tube2', tube(2)]]) {
    const r = shoot(nu, b);
    row.push(`${n}: out=${r.out} def=${r.def} dec=${r.dec}`);
  }
  console.log(row.join(' | '));
}
console.log('length sweep at nu=64:');
for (const L of [0, 1, 2, 4]) {
  const r = shoot(64, tube(L));
  console.log(`  L=${L} len=${2 * L + 1}: out=${r.out} def=${r.def}`);
}
