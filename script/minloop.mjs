#!/usr/bin/env node
/*
 * minloop.mjs — minimum Phase-Locked circulating loop on the 12-port
 * True-FCC graph (the pseudo-orbit floor).
 *
 * BFS over states (cell, lastPort, depth) from a seed: shortest return
 * to seed with every hop satisfying DOTS[d][lastPort] >= 128 (≤60° turn,
 * the Phase-Lock gate used by pathfinder/sweep). Enumerates the first
 * --count loops at minimum length + reports their port sequences and
 * cell coordinates, then writes the first loop as a seed-style JSON
 * compatible with the C orbit harness (cells carry the OUTGOING port).
 *
 *   node script/minloop.mjs [--maxlen=12] [--count=8]
 */
import { HOFF, ZU as ZU3, ZD as ZD3, V3 } from './lib/p3.mjs';

const arg = (k, d) => {
  const m = process.argv.find(a => a === `--${k}` || a.startsWith(`--${k}=`));
  return m ? (m.includes('=') ? m.split('=')[1] : true) : d;
};
const num = (k, d) => parseFloat(arg(k, d));
const MAXLEN = num('maxlen', 12), COUNT = num('count', 8);
const DFSLEN = num('dfslen', 0);      /* >0: enumerate exact-length loops via DFS */
const DEDUP = !arg('nodup', false);

const W = 40, H = 40, D = 40;
const SX = 20, SY = 20, SZ = 20;
const idx = (x, y, z) => (z * H + y) * W + x;

const POFF = [[], []];
for (let par = 0; par < 2; par++) {
  for (let d = 1; d <= 6; d++) POFF[par][d] = [HOFF[par][d][0], HOFF[par][d][1], 0];
  for (let j = 0; j < 3; j++) {
    POFF[par][7 + j] = [HOFF[par][ZU3[j]][0], HOFF[par][ZU3[j]][1], 1];
    POFF[par][10 + j] = [HOFF[par][ZD3[j]][0], HOFF[par][ZD3[j]][1], -1];
  }
}
const DOTS = [new Int16Array(13)];
for (let a = 1; a <= 12; a++) {
  DOTS.push(new Int16Array(13));
  for (let b = 1; b <= 12; b++)
    DOTS[a][b] = (V3[a][0] * V3[b][0] + V3[a][1] * V3[b][1] + V3[a][2] * V3[b][2]) >> 8;
}
const nbr = (x, y, z, d) => {
  const o = POFF[y & 1][d], nz = z + o[2];
  if (nz < 0 || nz >= D) return null;
  return [(x + o[0] + W) % W, (y + o[1] + H) % H, nz];
};

const seedI = idx(SX, SY, SZ);

/* ---------- DFS exact-length enumerator (for the L-sweep) ---------- */
if (DFSLEN) {
  const loops = [];
  const seenSig = new Set();
  const path = [], seen = new Set([seedI]);
  const dfs = (x, y, z, lp, depth) => {
    if (loops.length >= COUNT * 8) return;
    for (let d = 1; d <= 12; d++) {
      if (lp && DOTS[d][lp] < 128) continue;
      const n = nbr(x, y, z, d);
      if (!n) continue;
      const [nx, ny, nz] = n;
      if (idx(nx, ny, nz) === seedI) {
        if (depth + 1 === DFSLEN) {
          const first = path[1].port;          // seed's outgoing = first hop
          if (DOTS[d][first] < 128) continue;  // wrap turn at the seed
          // outgoing port of cell i = arrival port of cell i+1 (d for last)
          const cells = path.map((c, i) => ({
            x: c.x, y: c.y, z: c.z,
            port: i + 1 < path.length ? path[i + 1].port : d,
          }));
          if (DEDUP) {
            const sig = cells.map(c => idx(c.x, c.y, c.z)).sort((a, b) => a - b).join(',');
            if (seenSig.has(sig)) continue;
            seenSig.add(sig);
          }
          loops.push(cells);
        }
        continue;
      }
      const ni = idx(nx, ny, nz);
      if (seen.has(ni) || depth + 1 >= DFSLEN) continue;
      seen.add(ni); path.push({ x: nx, y: ny, z: nz, port: d });
      dfs(nx, ny, nz, d, depth + 1);
      path.pop(); seen.delete(ni);
    }
  };
  path.push({ x: SX, y: SY, z: SZ, port: 0 });
  // seed's first hop has no lock constraint; handled by lp=0
  dfs(SX, SY, SZ, 0, 0);
  console.log(`DFS exact-len ${DFSLEN}: ${loops.length} distinct loops (dedup=${DEDUP})`);
  for (const l of loops.slice(0, COUNT)) {
    const pts = l.map(c => `${c.x - SX},${c.y - SY},${c.z - SZ},${c.port}`).join(';');
    const zspan = Math.max(...l.map(c => c.z)) - Math.min(...l.map(c => c.z));
    console.log(`  L=${DFSLEN} zspan=${zspan} :: ${pts}`);
  }
  process.exit(0);
}

/* BFS: state = [x,y,z,lastPort]; parent map for path reconstruction. */
const key = (x, y, z, p) => idx(x, y, z) * 13 + p;
const parent = new Map();
let frontier = [[SX, SY, SZ, 0]];      // lastPort 0 = start (no lock)
const found = [];
for (let depth = 1; depth <= MAXLEN && frontier.length && found.length < COUNT; depth++) {
  const next = [];
  for (const [x, y, z, lp] of frontier) {
    for (let d = 1; d <= 12; d++) {
      if (lp && DOTS[d][lp] < 128) continue;      // Phase-Lock ≤60°
      const n = nbr(x, y, z, d);
      if (!n) continue;
      const [nx, ny, nz] = n;
      if (idx(nx, ny, nz) === seedI) {
        if (depth >= 3) {                         // 2-step = backtrack
          // reconstruct state chain: [seed, s1, s2, ..., (x,y,z,lp)]
          const states = [[x, y, z, lp]];
          let cur = parent.get(key(x, y, z, lp));
          while (cur && cur[3] !== 0) { states.unshift(cur); cur = parent.get(key(...cur)); }
          states.unshift([SX, SY, SZ, 0]);        // seed state
          // outgoing port per cell: next state's arrival port, or d for last
          const cells = states.map((s, i) => ({
            x: s[0], y: s[1], z: s[2],
            port: i + 1 < states.length ? states[i + 1][3] : d,
          }));
          cells.wrapOk = DOTS[d][cells[0].port] >= 128;
          found.push(cells);
        }
        continue;
      }
      const k = key(nx, ny, nz, d);
      if (parent.has(k)) continue;
      parent.set(k, [x, y, z, lp]);
      next.push([nx, ny, nz, d]);
    }
  }
  frontier = next;
}

console.log(`min loop search: ${found.length} closed cycles found (BFS to depth ${MAXLEN})`);
const byLen = found.reduce((m, l) => Math.min(m, l.length), Infinity);
console.log(`minimum length: ${byLen}`);
let shown = 0;
for (const l of found) {
  if (l.length !== byLen || shown >= COUNT) continue;
  shown++;
  const pts = l.map(c => `(${c.x - SX},${c.y - SY},${c.z - SZ})/p${c.port}`).join(' ');
  const zspan = Math.max(...l.map(c => c.z)) - Math.min(...l.map(c => c.z));
  console.log(`  len=${l.length} wrap60=${l.wrapOk} zspan=${zspan} :: ${pts}`);
}
