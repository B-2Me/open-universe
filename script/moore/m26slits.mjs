// m26slits — two-source interference: emit same-nu packets from two
// points separated along y, measure arrival density vs y on a screen
// downstream. Coherent substrate => fringes (density oscillation).
import { loadM26, each3 } from '../lib/m26.mjs';
const q = await loadM26();
const N = 64, c0 = N >> 1;
q._moore26_init(N, N, N);
const SEP = 8;                       // source separation along y
const screenZ = c0 + 20;             // detector plane
// two coherent emitters: packets born same nu, same tick, aimed +z-ish
// (no +z edge — ch10=(1,0,1)/ch11=(-1,0,-1), ch14=(0,1,1)/ch15=(0,-1,-1))
// emit on ch14 (0,+1,+1) from source A, ch16 (0,+1,-1)... use (0,1,1)
// which drifts +y — emitters at c0±SEP/2 in y both send (0,±1,+1)
// toward the screen plane at z+20.
for (const dy of [-SEP/2, SEP/2]) {
  const y0 = c0 + dy;
  // sustained emitters: re-seed every 2 ticks during the run
}
// emit each tick from both source cells — packets carry nu=100
for (let t = 0; t < 40; t++) {
  q._moore26_packet_set(c0, c0 - SEP/2, c0, 14, 8);   // (0,+1,+1) source A
  q._moore26_packet_nu_set(c0, c0 - SEP/2, c0, 14, 100);
  q._moore26_packet_set(c0, c0 + SEP/2, c0, 15, 8);   // (0,-1,-1) source B
  q._moore26_packet_nu_set(c0, c0 + SEP/2, c0, 15, 100);
  q._moore26_tick();
}
// arrival density on screen planes z = c0+10 .. c0+22, histogram vs y
console.log('z   | ' + Array.from({length: 17}, (_, i) => String(c0 - 8 + i).padStart(3)).join(''));
for (let z = c0 + 8; z <= c0 + 24; z += 4) {
  const row = [];
  for (let y = c0 - 8; y <= c0 + 8; y++) {
    let d = 0;
    for (let x = 0; x < N; x++) for (let c = 6; c < 18; c++)
      d += Number(q._moore26_packet_get(x, y, z, c));
    row.push(d);
  }
  console.log(`z=${String(z).padStart(2)} | ` + row.map(v => String(v).padStart(3)).join(''));
}
