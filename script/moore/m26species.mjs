// m26species — bound-state classes: ball vs smoke-ring vs hopfion.
// Seeds each topology, ticks, reports survival + reversal signature.
import { loadM26, each3 } from '../lib/m26.mjs';
const q = await loadM26();
const N = 32, c0 = N >> 1;
const V=[[1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],[1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1]];
const best=(dx,dy,dz)=>{let bi=0,bd=-3;for(let j=0;j<12;j++){const d=dx*V[j][0]+dy*V[j][1]+dz*V[j][2];if(d>bd){bd=d;bi=j;}}return 6+bi;};
const bound=(x,y,z)=>{let v=0;for(let e=0;e<13;e++)v+=Math.min(Number(q._moore26_winding_get(x,y,z,2*e)),Number(q._moore26_winding_get(x,y,z,2*e+1)));return v;};
const census=()=>{let n=0,vol=0;each3(N,(x,y,z)=>{const v=bound(x,y,z);if(v>=400){n++;vol+=v;}});return{n,vol};};
const run=(name,seed)=>{q._moore26_init(N,N,N);seed();const b=census();for(let t=0;t<200;t++)q._moore26_tick();const a=census();console.log(`${name}: t0 n=${b.n} v=${b.vol} -> t200 n=${a.n} v=${a.vol}`);};
// ball
run('ball',()=>{for(let dz=-4;dz<=4;dz++)for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){if(dx*dx+dy*dy+dz*dz>16)continue;const x=c0+dx,y=c0+dy,z=c0+dz;for(let e=0;e<13;e++){q._moore26_winding_set(x,y,z,2*e,120);q._moore26_winding_set(x,y,z,2*e+1,120);}}});
// smoke ring: toroidal circulation (dd along ring tangent)
run('smoke-ring',()=>{const S=16,R=8,r=3;for(let i=0;i<S;i++){const a=2*Math.PI*i/S;const cx=Math.round(c0+R*Math.cos(a)),cy=Math.round(c0+R*Math.sin(a));const c=best(-Math.sin(a),Math.cos(a),0);for(let dz=-r;dz<=r;dz++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(dx*dx+dy*dy+dz*dz>r*r)continue;const x=cx+dx,y=cy+dy,z=c0+dz;for(let e=0;e<13;e++){q._moore26_winding_set(x,y,z,2*e,120);q._moore26_winding_set(x,y,z,2*e+1,120);}q._moore26_winding_set(x,y,z,c,180);q._moore26_winding_set(x,y,z,c^1,60);}}});
// hopfion: poloidal twist (dd around tube cross-section)
run('hopfion',()=>{const S=16,R=8,r=3;for(let i=0;i<S;i++){const a=2*Math.PI*i/S;const cx=Math.round(c0+R*Math.cos(a)),cy=Math.round(c0+R*Math.sin(a));const rx=Math.cos(a),ry=Math.sin(a);for(let dz=-r;dz<=r;dz++)for(let dr=-r;dr<=r;dr++){if(dr*dr+dz*dz>r*r||dr===0&&dz===0)continue;const x=Math.round(cx+dr*rx),y=Math.round(cy+dr*ry),z=c0+dz;const beta=Math.atan2(dz,dr);const c=best(-Math.sin(beta)*rx,-Math.sin(beta)*ry,Math.cos(beta));for(let e=0;e<13;e++){q._moore26_winding_set(x,y,z,2*e,120);q._moore26_winding_set(x,y,z,2*e+1,120);}q._moore26_winding_set(x,y,z,c,180);q._moore26_winding_set(x,y,z,c^1,60);}}});
