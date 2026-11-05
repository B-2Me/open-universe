// m26slits — two-source interference: emit same-nu packets from two
// sources separated in y, converging onto a screen downstream (+x).
// Forward = the four +x edge channels (1,±1,0)/(1,0,±1). If the
// substrate has phase-coherent transport, arrival density vs y
// oscillates; if packets are pure billiards it's smooth.
import { loadM26 } from '../lib/m26.mjs';
const q = await loadM26();
const N = 64, c0 = N >> 1;
q._moore26_init(N, N, N);
const SEP = 8, SRCX = c0 - 14, SCRX = c0 + 14;
const FWD = [6, 8, 10, 12];           // (1,±1,0) (1,0,±1)
for (let t = 0; t < 30; t++) {
  for (const s of [-SEP/2, SEP/2]) for (const ch of FWD) {
    q._moore26_packet_set(SRCX, c0 + s, c0, ch, 6);
    q._moore26_packet_nu_set(SRCX, c0 + s, c0, ch, 100);
  }
  q._moore26_tick();
}
// arrival density vs y on screen planes near x=SRCX+28
console.log(' y | ' + Array.from({length: 25}, (_, i) => String(c0 - 12 + i).padStart(3)).join(''));
for (let x = SCRX - 2; x <= SCRX + 2; x++) {
  const row = [];
  for (let y = c0 - 12; y <= c0 + 12; y++) {
    let d = 0;
    for (let z = c0 - 4; z <= c0 + 4; z++) for (let c = 6; c < 18; c++)
      d += Number(q._moore26_packet_get(x, y, z, c));
    row.push(d);
  }
  console.log(`x=${String(x).padStart(2)} | ` + row.map(v => String(Math.min(v, 999)).padStart(3)).join(''));
}
