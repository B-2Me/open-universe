/*
 * vtk.mjs — sparse legacy-VTK exporter for planck3 wasm state.
 *
 * Shared by boost.mjs / collide.mjs: call writeVtkFrame() inside the
 * tick loop to snapshot the live lattice to a ParaView-readable
 * frame_NNNNN.vtk point cloud.
 *
 *   import { writeVtkFrame } from './vtk.mjs';
 *   writeVtkFrame({ file, w, h, d, statePtr, heap8, masks: { a, b }, tick, title });
 *
 *   file     output path
 *   w,h,d    grid dims;  statePtr  byte offset of the flat node array
 *   heap8    () => Uint8Array — fresh buffer view getter (wasm memory
 *            can grow; never cache a view across pointer calls)
 *   masks    optional { a, b } provenance Uint8Arrays — 'painted'
 *            becomes 1 (seed A / boost's painted skeleton), 2 (seed B),
 *            0 for accreted/vacuum-adjacent live mass
 *   tick     frame number (zero-padded in the filename by caller)
 *
 * Format: ASCII POLYDATA, one VERTEX cell per live node, POINT_DATA
 * fields quanta / tension / painted / flow_vector. Only quanta>0 cells
 * are emitted — a 256^3 vacuum frame is a few KB, not 100MB.
 *
 * The 2D Wake engine (src/planck.c generate_vtk) exports the dense
 * STRUCTURED_POINTS variant — same legacy-VTK family, different
 * topology: dense is right for 2D, sparse is right for 16.7M nodes.
 */
import { writeFileSync } from 'node:fs';

// Fixed-point port table — same constants as engine-sim.mjs / planck3.c.
const HEX_MX = [0, 256, 128, -128, -256, -128, 128];
const HEX_MY = [0, 0, 222, 222, 0, -222, -222];
const FZ = 209, FP = 148;                        // √(2/3)·256, (1/√3)·256
const V3 = [null];
for (let s = 1; s <= 6; s++) V3.push([HEX_MX[s], HEX_MY[s], 0]);
for (const d of [1, 3, 5]) V3.push([Math.round(HEX_MX[d] * FP / 256), Math.round(HEX_MY[d] * FP / 256), FZ]);
for (const d of [2, 4, 6]) V3.push([Math.round(HEX_MX[d] * FP / 256), Math.round(HEX_MY[d] * FP / 256), -FZ]);
// Normalized to unit vectors for ParaView glyphs (fixed-point magnitude
// ≈256, exact normalization keeps arrow lengths uniform).
const UV3 = [null];
for (let s = 1; s <= 12; s++) {
  const L = Math.hypot(V3[s][0], V3[s][1], V3[s][2]);
  UV3.push([V3[s][0] / L, V3[s][1] / L, V3[s][2] / L]);
}

// Register layout per node (6 bytes): u8 quanta, u8 spin, u16le heat,
// u8 buffer, u8 tension.
export function writeVtkFrame({ file, w, h, d, statePtr, heap8, masks = {}, tick = 0, title = 'planck3 frame' }) {
  const mem = heap8();
  const dv = new DataView(mem.buffer);
  const n = w * h * d;
  const maskA = masks.a, maskB = masks.b;

  // One pass: collect live cells.
  const idx = [], q = [], tn = [], pt = [], fv = [];
  for (let i = 0; i < n; i++) {
    const p = statePtr + i * 6;
    const qq = mem[p];
    if (qq === 0) continue;
    idx.push(i); q.push(qq); tn.push(mem[p + 5]);
    pt.push(maskA?.[i] ? 1 : maskB?.[i] ? 2 : 0);
    const s = mem[p + 1];
    fv.push(s >= 1 && s <= 12 ? UV3[s] : [0, 0, 0]);
  }

  const m = idx.length;
  const out = [
    '# vtk DataFile Version 3.0\n',
    `${title} (t=${tick})\n`,
    'ASCII\n',
    'DATASET POLYDATA\n',
    `POINTS ${m} float\n`,
  ];
  const pts = [];
  for (const i of idx)
    pts.push(`${i % w} ${((i % (h * w)) / w) | 0} ${(i / (h * w)) | 0}\n`);
  out.push(pts.join(''));
  out.push(`VERTICES ${m} ${m * 2}\n`);
  const verts = [];
  for (let k = 0; k < m; k++) verts.push(`1 ${k}\n`);
  out.push(verts.join(''));
  out.push(`POINT_DATA ${m}\n`);
  out.push('SCALARS quanta float 1\nLOOKUP_TABLE default\n' + q.join('\n') + '\n');
  out.push('SCALARS tension float 1\nLOOKUP_TABLE default\n' + tn.join('\n') + '\n');
  out.push('SCALARS painted int 1\nLOOKUP_TABLE default\n' + pt.join('\n') + '\n');
  out.push('VECTORS flow_vector float\n' + fv.map(v => v.map(c => +c.toFixed(4)).join(' ')).join('\n') + '\n');
  writeFileSync(file, out.join(''));
  return m;
}
