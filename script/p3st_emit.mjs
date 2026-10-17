#!/usr/bin/env node
/*
 * p3st_emit.mjs — emit a P3ST state blob for the native planck3_test
 * driver (or any P3ST consumer). Loads a seed JSON, optionally extracts
 * absolute index ranges of its longest cycle (arc isolates / gap pairs),
 * writes the q,s,b,tn,h planes.
 *
 *   node script/p3st_emit.mjs --seed=seeds/hopfion_25_9.json --out=x.bin
 *   --arc=st,len        keep only longest-cycle cells [st, st+len)
 *                       (repeatable: two arcs = gapped pair)
 *   --cycle=k           keep only the k-th longest cycle (default: all cells)
 *   --column=port       ignore seed; emit a vertical strand from z=0 to
 *                       z=D-1 stepping port N each hop (open filament
 *                       anchored on the hard z-walls)
 *   --dup=dx,dy,dz      duplicate kept cells shifted by (dx,dy,dz);
 *                       shared cells collide (last write wins spin)
 *   --swap              for cells shared between copy A and copy B,
 *                       alternate spin ownership A/B/A/B... (X-reconnect
 *                       geometry at 2 shared cells = partner swap)
 *   --q=60 --heat=400   state values
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractCycles, step } from './lib/p3.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : null;
}).filter(Boolean));

const seedPath = resolve(String(args.seed));
const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const [w, h, d] = seed.dims, n = w * h * d;
const arcs = [args.arc, args.arc2].filter(Boolean).map(s => s.split(',').map(Number));

let cells = seed.cells.map(c => [...c]);
if (args.cycle !== undefined || arcs.length) {
  const { cycles } = extractCycles(cells, w, h, d);
  const keep = new Set();
  if (args.cycle !== undefined) for (const i of cycles[+args.cycle]) keep.add(i);
  for (const [st, len] of arcs) for (const i of cycles[0].slice(st, st + len)) keep.add(i);
  cells = cells.filter(([x, y, z]) => keep.has((z * h + y) * w + x));
}

// --xlink=i1,i2: X-crossing construction. Loop A = cycles[0]; P and Q
// are its cells at cycle-indices i1,i2. A second loop B is routed
// through free space P→Q→P via BFS on the 12-port digraph, avoiding
// all occupied cells — so the two loops share exactly P and Q.
// Ownership of shared-cell spins: --own=b gives both to B; --swap gives
// P→B, Q→A (X-reconnect: survivor is a mixed-provenance hybrid).
if (args.xlink !== undefined) {
  const [i1, i2] = String(args.xlink).split(',').map(Number);
  const { cycles } = extractCycles(seed.cells, w, h, d);
  const loop = cycles[0];
  const iP = loop[i1], iQ = loop[i2];
  const occupied = new Set(loop);
  const dec2 = (i) => [i % w, ((i % (h * w)) / w) | 0, (i / (h * w)) | 0];
  const idx2 = (x, y, z) => (z * h + y) * w + x;
  const nxt = (i, p) => {
    const [x, y, z] = dec2(i);
    const c = step(x, y, z, p);
    if (c[2] < 0 || c[2] >= d) return -1;
    return idx2(((c[0] % w) + w) % w, ((c[1] % h) + h) % h, c[2]);
  };
  // BFS from src to dst over port graph, avoiding `blocked`
  const route = (src, dst, blocked) => {
    const prev = new Map([[src, -1]]), prevP = new Map();
    const q2 = [src];
    for (let h2 = 0; h2 < q2.length; h2++) {
      const cur = q2[h2];
      if (cur === dst) {
        const path = [], ports = [];
        for (let c = dst; c !== src; c = prev.get(c)) { path.unshift(c); ports.unshift(prevP.get(c)); }
        return { path, ports };
      }
      for (let p = 1; p <= 12; p++) {
        const k = nxt(cur, p);
        if (k < 0 || prev.has(k) || blocked.has(k)) continue;
        prev.set(k, cur); prevP.set(k, p); q2.push(k);
      }
    }
    return null;
  };
  // ext1: P→Q avoiding loop cells except endpoints
  const e1blk = new Set(occupied); e1blk.delete(iP); e1blk.delete(iQ);
  const r1 = route(iP, iQ, e1blk);
  if (!r1) { console.error(`xlink: no external route ${i1}->${i2}`); process.exit(1); }
  const e2blk = new Set([...occupied, ...r1.path]); e2blk.delete(iP); e2blk.delete(iQ);
  const r2 = route(iQ, iP, e2blk);
  if (!r2) { console.error(`xlink: no return route ${i2}->${i1}`); process.exit(1); }
  // Loop B cells: each cell's spin = the port leading to its successor.
  // ports[j] entered path[j], so path[j]'s outgoing port = ports[j+1];
  // last cell of each leg (iQ / iP) is shared and written separately.
  const bCells = [];
  for (const [leg, nextLeg] of [[r1, r2], [r2, r1]]) {
    for (let j = 0; j < leg.path.length; j++) {
      if (leg.path[j] === iP || leg.path[j] === iQ) continue;
      const out = j + 1 < leg.path.length ? leg.ports[j + 1] : nextLeg.ports[0];
      const [x, y, z] = dec2(leg.path[j]);
      bCells.push([x, y, z, out]);
    }
  }
  // base: loop A cells from seed
  const loopSet = new Set(loop);
  cells = seed.cells.filter(([x, y, z]) => loopSet.has(idx2(x, y, z))).map(c => [...c]);
  const spOf = (id) => cells.find(([x, y, z]) => idx2(x, y, z) === id)?.[3];
  const spA_P = spOf(iP), spA_Q = spOf(iQ);
  // B's own continuation at P = first ext1 port; at Q = first ext2 port
  const spB_P = r1.ports[0], spB_Q = r2.ports[0];
  const own = args.swap ? 'alt' : (args.own || 'a');
  const pSpin = own === 'a' ? spA_P : spB_P;          // 'b' and 'alt' give P to B
  const qSpin = own === 'b' ? spB_Q : spA_Q;          // 'a' and 'alt' give Q to A
  const [px, py, pz] = dec2(iP), [qx, qy, qz] = dec2(iQ);
  cells = cells.filter(([x, y, z]) => idx2(x, y, z) !== iP && idx2(x, y, z) !== iQ);
  cells.push([px, py, pz, pSpin], [qx, qy, qz, qSpin], ...bCells);
  console.log(`xlink ${i1},${i2}: P=${iP} Q=${iQ} ext1=${r1.path.length} ext2=${r2.path.length} own=${own} (P:${pSpin} Q:${qSpin} vs A:${spA_P},${spA_Q} B:${spB_P},${spB_Q})`);
}

// --column=port: vertical open filament, one cell per z-level, anchored
// on the hard walls. Chain steps the given port (must advance z); the
// top cell's spin points through the ceiling (no channel = free end).
if (args.column !== undefined) {
  const port = +args.column;
  const x0 = (w / 2) | 0, y0 = (h / 2) | 0;
  cells = [];
  let x = x0, y = y0;
  for (let z = 0; z < d; z++) {
    cells.push([x, y, z, port]);
    const c = step(x, y, z, port);
    x = ((c[0] % w) + w) % w; y = ((c[1] % h) + h) % h;
    if (c[2] < 0 || c[2] >= d) break; // wall
  }
  cells[cells.length - 1][3] = port; // tip aims through the wall
}

// --dup: second copy shifted; report overlap. With --swap, shared cells
// alternate which copy's spin wins (A,B,A,B...) so crossing geometry
// can encode an X-reconnection rather than last-write-wins.
if (args.dup !== undefined) {
  const [dx, dy, dz] = String(args.dup).split(',').map(Number);
  const keyA = new Map(cells.map(([x, y, z, sp]) => [`${x},${y},${z}`, sp]));
  const B = cells.map(([x, y, z, sp]) => [x + dx, y + dy, z + dz, sp])
    .filter(([x, y, z]) => x >= 0 && x < w && y >= 0 && y < h && z >= 0 && z < d);
  const shared = B.filter(([x, y, z]) => keyA.has(`${x},${y},${z}`));
  let t = 0;
  for (const [x, y, z, spB] of B) {
    const k = `${x},${y},${z}`;
    if (keyA.has(k)) {
      // shared cell: keep A's spin by default; --swap alternates
      if (args.swap && (t++ % 2) === 0) keyA.set(k, spB);
    } else keyA.set(k, spB);
  }
  cells = [...keyA.entries()].map(([k, sp]) => [...k.split(',').map(Number), sp]);
  console.log(`dup ${dx},${dy},${dz}: ${shared.length} shared cells ${shared.map(c => `(${c})`).join(' ')}`);
}

const q = new Uint8Array(n), s = new Uint8Array(n), b = new Uint8Array(n),
      tn = new Uint8Array(n), ht = new Uint16Array(n);
for (const [x, y, z, sp] of cells) {
  const i = (z * h + y) * w + x;
  q[i] = +(args.q ?? seed.q ?? 60); s[i] = sp; ht[i] = +(args.heat ?? seed.heat ?? 400);
}

const out = Buffer.alloc(16 + n * 6);
out.write('P3ST', 0);
out.writeUInt32LE(w, 4); out.writeUInt32LE(h, 8); out.writeUInt32LE(d, 12);
Buffer.from(q.buffer).copy(out, 16);
Buffer.from(s.buffer).copy(out, 16 + n);
Buffer.from(b.buffer).copy(out, 16 + 2 * n);
Buffer.from(tn.buffer).copy(out, 16 + 3 * n);
Buffer.from(ht.buffer, 0, 2 * n).copy(out, 16 + 4 * n);
writeFileSync(resolve(String(args.out)), out);
console.log(`${args.out}: ${cells.length} cells (${w}x${h}x${d})`);
