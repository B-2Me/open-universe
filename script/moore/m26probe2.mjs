import { loadM26, each3 } from '../lib/m26.mjs';
const q = await loadM26();
const N = 40;
q._moore26_init(N, N, N);
// same geometry, dense + hot like the fuse seeds
for (let i = 0; i < 4; i++)
  q._moore26_packet_set(12 + i, 12 + i, 20, 6, 100),
  q._moore26_packet_nu_set(12 + i, 12 + i, 20, 6, 200);
for (let t = 0; t <= 4; t++) {
  const pos = [];
  each3(N, (x, y, z) => {
    for (let c = 6; c < 18; c++) {
      const p = Number(q._moore26_packet_get(x, y, z, c));
      if (p > 0) pos.push(`(${x},${y},${z})ch${c}=${p}`);
    }
  });
  console.log(`t=${t} ${pos.slice(0, 10).join(' ')}`);
  q._moore26_tick();
}
