// m26mobius — derived 720 detector: walk a ring of cells and check
// whether the +/- member assignment of each edge pair stays coherent
// around the loop (no register needed — the sheet is IN the pairing).
// A Mobius defect = the member preference flips an odd number of times.
import { loadM26 } from '../lib/m26.mjs';
const q = await loadM26();
const N = 32, c0 = N >> 1;

// coherence metric: for a ring of cells, does each cell's dominant
// directed edge member (which of a/b leads) rotate smoothly or flip?
const probe = (label) => {
  const R = 6, S = 16;
  let flips = 0, prev = 0;
  const signs = [];
  for (let i = 0; i <= S; i++) {
    const a = 2 * Math.PI * (i % S) / S;
    const x = Math.round(c0 + R * Math.cos(a)), y = Math.round(c0 + R * Math.sin(a));
    // dominant directedness on the radial-ish edge pair (e=3: ch6/7)
    const d = Number(q._moore26_winding_get(x, y, c0, 6)) - Number(q._moore26_winding_get(x, y, c0, 7));
    signs.push(Math.sign(d));
    if (i > 0 && Math.sign(d) !== 0 && prev !== 0 && Math.sign(d) !== prev) flips++;
    if (Math.sign(d) !== 0) prev = Math.sign(d);
  }
  console.log(`${label}: signs=[${signs.join('')}] flips=${flips} ${flips % 2 === 1 ? '<-- Mobius!' : '(trivial)'}`);
};

// test 1: uniform dd ring — should show 0 flips (trivial cover)
q._moore26_init(N, N, N);
for (let i = 0; i < 16; i++) {
  const a = 2 * Math.PI * i / 16;
  const x = Math.round(c0 + 6 * Math.cos(a)), y = Math.round(c0 + 6 * Math.sin(a));
  for (let e = 0; e < 13; e++) {
    q._moore26_winding_set(x, y, c0, 2*e, 120);
    q._moore26_winding_set(x, y, c0, 2*e + 1, 120);
  }
  q._moore26_winding_set(x, y, c0, 6, 160);  // +dd everywhere
  q._moore26_winding_set(x, y, c0, 7, 80);
}
probe('uniform +dd ring');
for (let t = 0; t < 50; t++) q._moore26_tick();
probe('after 50t');

// test 2: one flipped cell — a seeded defect; does it persist or heal?
q._moore26_init(N, N, N);
for (let i = 0; i < 16; i++) {
  const a = 2 * Math.PI * i / 16;
  const x = Math.round(c0 + 6 * Math.cos(a)), y = Math.round(c0 + 6 * Math.sin(a));
  for (let e = 0; e < 13; e++) {
    q._moore26_winding_set(x, y, c0, 2*e, 120);
    q._moore26_winding_set(x, y, c0, 2*e + 1, 120);
  }
  // dd everywhere except ONE flipped cell (the defect seed)
  const flip = i === 4;
  q._moore26_winding_set(x, y, c0, flip ? 7 : 6, 160);
  q._moore26_winding_set(x, y, c0, flip ? 6 : 7, 80);
}
probe('one flipped cell');
for (let t = 0; t < 50; t++) q._moore26_tick();
probe('defect after 50t');
