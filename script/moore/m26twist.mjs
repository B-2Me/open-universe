// m26twist — distributed 180-deg dd twist on a ring = the Mobius seed.
// Each cell gets dd on the edge best-aligned with (tangent + phi_i),
// phi accumulating 180deg over the loop => anti-periodic circulation.
// Compare: trivial (phi=0) vs twist (phi=pi). Persistence over 100t.
import { loadM26 } from '../lib/m26.mjs';
const q = await loadM26();
const N = 32, c0 = N >> 1;
const EDGE = [ // the 12 transporting edges, index->[dx,dy,dz]
  [1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],
  [1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1]];
const CH = i => 6 + i;
const bestEdge = (dx, dy, dz) => {
  let bi = 0, bd = -3;
  for (let i = 0; i < 12; i++) {
    const d = dx*EDGE[i][0] + dy*EDGE[i][1] + dz*EDGE[i][2];
    if (d > bd) { bd = d; bi = i; }
  }
  return bi;
};
const S = 16, R = 6;
const ring = () => {
  const cells = [];
  for (let i = 0; i < S; i++) {
    const a = 2*Math.PI*i/S;
    cells.push([Math.round(c0+R*Math.cos(a)), Math.round(c0+R*Math.sin(a)), c0, a]);
  }
  return cells;
};
const seed = (twist) => {
  q._moore26_init(N,N,N);
  const cells = ring();
  for (const [x,y,z,a] of cells) {
    for (let e=0;e<13;e++) {
      q._moore26_winding_set(x,y,z,2*e,120);
      q._moore26_winding_set(x,y,z,2*e+1,120);
    }
    // tangent direction (CCW): (-sin a, +cos a, 0); twist adds phi
    const phi = twist * a;              // 0 or pi*theta_fraction
    const ta = a + Math.PI/2 + phi;     // local dd axis direction
    const ei = bestEdge(Math.cos(ta), Math.sin(ta), 0);
    const c = CH(ei);
    q._moore26_winding_set(x,y,z,c,180);
    q._moore26_winding_set(x,y,z,c^1,60);
    cells[cells.findIndex(v=>v[0]===x&&v[1]===y)].push(c);
  }
  return cells;
};
const measure = (cells) => {
  // per-cell dd sign on its seeded channel + total dd magnitude
  const signs=[], dds=[];
  for (const [x,y,z,a,c] of cells) {
    const dd = Number(q._moore26_winding_get(x,y,z,c)) - Number(q._moore26_winding_get(x,y,z,c^1));
    dds.push(dd); signs.push(dd>0?'+':dd<0?'-':'0');
  }
  let flips=0;
  for(let i=0;i<signs.length;i++)if(signs[i]!==signs[(i+1)%signs.length]&&signs[i]!=='0'&&signs[(i+1)%signs.length]!=='0')flips++;
  return {signs: signs.join(''), dds, flips};
};
for (const [name,twist] of [['trivial',0],['mobius',1]]) {
  const cells = seed(twist);
  const b = measure(cells);
  for (let t=0;t<100;t++) q._moore26_tick();
  const a2 = measure(cells);
  const kept = a2.dds.filter(d=>Math.abs(d)>10).length;
  console.log(`${name}: t0 signs=${b.signs} flips=${b.flips}`);
  console.log(`  t100 signs=${a2.signs} flips=${a2.flips} ddCells=${kept}/${S} maxdd=${Math.max(...a2.dds.map(Math.abs))}`);
}
