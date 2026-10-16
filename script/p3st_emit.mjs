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
 *   --q=60 --heat=400   state values
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractCycles } from './lib/p3.mjs';

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
