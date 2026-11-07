// m26buckle — curvature->polarization coupling on the FCC edge graph.
// HOLLOW tube: wound shell around a clean path (walls scatter via the
// freest-channel bounce, core transmits ballistically).
// U-tube = (1,1,0)->(1,0,1)->(0,1,-1)->(-1,-1,0): out +x, U, back -x.
import { loadM26, each3 } from '../lib/m26.mjs';
const q = await loadM26();
const N = 32, c0 = N >> 1;
const V = {
  6:[1,1,0],7:[-1,-1,0],8:[1,-1,0],9:[-1,1,0],
  10:[1,0,1],11:[-1,0,-1],12:[1,0,-1],13:[-1,0,1],
  14:[0,1,1],15:[0,-1,-1],16:[0,1,-1],17:[0,-1,1] };
const EDGES = [6,7,8,9,10,11,12,13,14,15,16,17];

const pathCells = (x0,y0,z0,path,legLen) => {
  let x=x0,y=y0,z=z0; const cells=[];
  for (const ch of path) for (let i=0;i<legLen;i++){ cells.push([x,y,z]); x+=V[ch][0]; y+=V[ch][1]; z+=V[ch][2]; }
  return cells;
};
const seedTube = (cells, comm) => {
  const onPath = new Set(cells.map(c=>c.join(',')));
  for (const [x,y,z] of cells) for (const ch of EDGES) {
    const wx=x+V[ch][0], wy=y+V[ch][1], wz=z+V[ch][2];
    if (onPath.has(`${wx},${wy},${wz}`)) continue;    // keep core hollow
    for (let e=0;e<13;e++) {
      q._moore26_winding_set(wx,wy,wz,2*e,comm);
      q._moore26_winding_set(wx,wy,wz,2*e+1,comm);
    }
  }
};
const hist = (cells) => {
  const h = new Array(26).fill(0);
  for (const [x,y,z] of cells) for (let c=6;c<18;c++)
    h[c]+=Number(q._moore26_packet_get(x,y,z,c));
  return h;
};

for (const [name,path] of [['straight',[6,6,6,6]],['U-tube',[6,10,16,7]]]) {
  q._moore26_init(N,N,N);
  const cells = pathCells(c0-8, c0, c0, path, 6);
  seedTube(cells, 255);
  const m = cells[0];
  for (let t=0;t<80;t++) {
    q._moore26_packet_set(m[0],m[1],m[2],path[0],4);
    q._moore26_packet_nu_set(m[0],m[1],m[2],path[0],150);
    q._moore26_tick();
  }
  const h = hist(cells);
  const legs = [];
  for (let l=0;l<4;l++) legs.push(cells.slice(l*6,l*6+6).reduce((s,[x,y,z])=>{
    for(let c=6;c<18;c++)s+=Number(q._moore26_packet_get(x,y,z,c)); return s;},0));
  console.log(`${name}: legFlux=[${legs.join(',')}] in-tube=`+h.map((v,i)=>v?`ch${i}:${v}`:0).filter(v=>v!==0).join(' '));
}
