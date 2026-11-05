// m26nuccurve — emission spectrum vs bound structure: a wound knot's
// emitted nu should equal geo_gap = (weakest committed edge >>2)*2/L^2.
// Seed knots at several committed levels, read the emitted packet nu.
// Port of qi3nuccurve. moore26 has no nu getter — read raw photonNu
// bytes from the state blob instead (offset: photon(26)+mass(2)+...
// discover dynamically: photonNu sits right after photon in NodeState).
import { loadM26, ev } from '../lib/m26.mjs';
const q = await loadM26();
const N = 32, c0 = N >> 1;

// NodeState layout probe: packet[26](u8), packetNu[26](u8), mass(u16)...
// instead of guessing offsets, scan emitted packets via packet_get and
// read nu from a neighbor — simplest: use mass_flight + packet presence.
// Emit: seed a saturated knot, tick, find packets with born==recent —
// no born getter either. Use spatial: emitted packets appear OUTSIDE
// the seed ball. Count their channels.
const seedKnot = (comm) => {
  q._moore26_init(N, N, N);
  for (let dz = -3; dz <= 3; dz++) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    if (dx*dx + dy*dy + dz*dz > 9) continue;
    const x = c0 + dx, y = c0 + dy, z = c0 + dz;
    for (let e = 0; e < 13; e++) {
      q._moore26_winding_set(x, y, z, 2*e, comm);
      q._moore26_winding_set(x, y, z, 2*e + 1, comm);
    }
  }
};

for (const comm of [64, 128, 192, 255]) {
  seedKnot(comm);
  let emitted = 0, emittedEdge = new Array(26).fill(0);
  for (let t = 0; t < 30; t++) q._moore26_tick();
  // packets outside the seed ball = emitted radiation
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = x - c0, dy = y - c0, dz = z - c0;
    if (dx*dx + dy*dy + dz*dz <= 16) continue;
    for (let c = 6; c < 18; c++) {
      const p = Number(q._moore26_packet_get(x, y, z, c));
      emitted += p; emittedEdge[c] += p;
    }
  }
  console.log(`comm=${String(comm).padStart(3)} emitted=${emitted} emit-ev4=${ev(q,4)} edgeCh=[${emittedEdge.map((v,i)=>v?`${i}:${v}`:0).filter(v=>v!==0).join(',')}]`);
}
