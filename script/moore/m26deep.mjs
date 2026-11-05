// m26deep — trace every register at the seed + downstream cells per tick
// to find where "vanished" packets stage.
import { loadM26 } from '../lib/m26.mjs';
const q = await loadM26();
const N = 40;
q._moore26_init(N, N, N);
q._moore26_packet_set(12, 12, 20, 6, 100);
q._moore26_packet_nu_set(12, 12, 20, 6, 200);
// read raw node struct via state_pointer + node_size
const ptr = Number(q._moore26_state_pointer());
const sz = Number(q._moore26_node_size());
console.log(`state ptr=0x${ptr.toString(16)} nodeSize=${sz} sites=${N*N*N}`);
// dump the raw node: field offsets unknown — print all nonzero bytes
const cell = (x, y, z) => ptr + (z*N*N + y*N + x) * sz;
const dump = (x, y, z, tag) => {
  const off = cell(x, y, z);
  const u8 = q.HEAPU8.subarray(off, off + sz);
  const nz = [];
  for (let i = 0; i < sz; i++) if (u8[i]) nz.push(`+${i}:${u8[i]}`);
  console.log(`  (${x},${y},${z}) ${tag}: ${nz.slice(0, 30).join(' ') || 'empty'}`);
};
for (let t = 0; t <= 3; t++) {
  console.log(`t=${t}`);
  for (let d = 0; d <= 2; d++) dump(12 + d, 12 + d, 20, `hop+${d}`);
  if (t < 3) q._moore26_tick();
}
