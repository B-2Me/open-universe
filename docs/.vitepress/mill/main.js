/*
 * Joule's Mill — WebGL2 3D viewer, loom-meso branch.
 *
 * EXPERIMENT: the same instrument shell, but driven by the meso3i
 * multichannel friction engine instead of planck3's single-spin node.
 * The question this page exists to answer: can any knot-like or
 * circulation structure persist on a substrate where friction lives in
 * transit and rest mass forgets direction? (M38 measured ~25 ticks to
 * thermalize at 44^3 — this is the loom-scale retest.)
 *
 * Pipeline: meso3i.wasm -> meso3i_rg_refresh() packs {moving, rest}
 * into an RG8 buffer -> gl.texSubImage3D uploads wasm memory straight
 * to the GPU (no JS copies) -> one drawArraysInstanced call renders the
 * lattice; the vertex shader culls vacuum and ghosts the tomographic
 * slab.
 *
 * Geometry note (honest embedding): meso3i lives on the even-parity
 * FCC sublattice of a cubic grid — the 18 channel vectors carry the
 * geometry, so the faithful picture is the plain cubic cell map and
 * odd-parity cells are structural vacuum (engine can never occupy them).
 */

// ---------- minimal mat4 (column-major, OpenGL order) ----------
const m4 = {
  mul(a, b) {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
    return o;
  },
  persp(fov, asp, near, far) {
    const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
    return [f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
  },
  rotX(a) { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; },
  rotY(a) { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; },
  translate(x, y, z) { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]; },
};

const VERT = `#version 300 es
precision highp float;
precision highp sampler3D;
layout(location=0) in vec2 a_corner;      // billboard quad corner
uniform sampler3D u_vol;                  // RGBA8: r=moving g=rest b=photons a=excitation n
uniform mat4 u_mvp;
uniform float u_size;                     // world-space quad half-size
uniform float u_s_center, u_s_thick;      // tomographic slab (cell coord)
uniform int u_s_axis;                     // slab normal: 0=x 1=y 2=z
uniform float u_ghost_alpha;              // opacity outside the slab
uniform float u_qmin;                     // density floor to render
uniform int u_colorMode;                  // 0=ember 1=heat 2=flux 3=macro
out vec4 v_color;
out vec2 v_uv;
uniform int u_nx, u_ny, u_nxy, u_step;   // strided grid decode
uniform int u_layout;                    // 0=cubic embed 1=fcc packed
uniform vec3 u_packoff;                  // recenters packed cloud on lattice center
void main() {
  int id = gl_InstanceID;
  int x = (id % u_nx) * u_step;
  int y = ((id / u_nx) % u_ny) * u_step;
  int z = (id / u_nxy) * u_step;
  vec4 rg = texelFetch(u_vol, ivec3(x, y, z), 0);
  float mov = rg.r * 255.0;
  float rest = rg.g * 255.0;
  float ph = rg.b * 255.0;
  float exc = rg.a * 255.0;
  float d = max(mov, max(rest, max(ph, exc)));
  v_uv = a_corner;
  if (d < u_qmin) {                       // vacuum + dead parity: clip
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0); v_color = vec4(0.0); return;
  }
  // slab ghosting: inside half-thickness -> opaque, outside -> silhouette
  float scoord = u_s_axis == 0 ? float(x) : (u_s_axis == 1 ? float(y) : float(z));
  float alpha = abs(scoord - u_s_center) <= u_s_thick * 0.5 ? 1.0 : u_ghost_alpha;
  // cubic embed: even-parity FCC sublattice carries its geometry in the
  // channel vectors, so raw grid coords are the honest picture
  vec3 p = vec3(float(x), float(y), float(z));
  if (u_layout == 1) {
    // fcc index space: primitive basis (1,1,0),(0,1,1),(1,0,1) mapped to
    // unit axes — the lattice in its own coordinates, parity gaps gone.
    // Bonds read as the 6 axis edges + 6 face diagonals of the packed grid.
    p = vec3(p.x + p.y - p.z, -p.x + p.y + p.z, p.x - p.y + p.z) * 0.5 + u_packoff;
  }
  vec4 mv = u_mvp * vec4(p, 1.0);
  // packed cells sit ~41% closer than the √2 embed spacing — shrink a
  // touch so the dense block doesn't fuse into one billboard pile
  float ps = u_size * (0.8 + 2.0 * d / 255.0) * (u_layout == 1 ? 0.72 : 1.0);
  mv.xy += a_corner * ps;                 // billboard in view space
  gl_Position = mv;
  vec3 rgb;
  // blackbody ramp for parked heat (the ember): red->orange->amber->white
  float h = pow(rest / 255.0, 0.75);
  vec3 ember = (h < 0.20 ? mix(vec3(0.06,0.00,0.00), vec3(0.42,0.04,0.00), h * 5.0)
      :  h < 0.40 ? mix(vec3(0.42,0.04,0.00), vec3(0.82,0.20,0.00), (h - 0.20) * 5.0)
      :  h < 0.60 ? mix(vec3(0.82,0.20,0.00), vec3(1.00,0.48,0.00), (h - 0.40) * 5.0)
      :  h < 0.78 ? mix(vec3(1.00,0.48,0.00), vec3(1.00,0.72,0.10), (h - 0.60) * 5.56)
      :             mix(vec3(1.00,0.72,0.10), vec3(1.00,0.82,0.42), (h - 0.78) * 4.55));
  // cold ramp for moving flux: deep indigo -> blue -> cyan -> white
  float f = pow(mov / 255.0, 0.7);
  vec3 flux = (f < 0.25 ? mix(vec3(0.02,0.03,0.16), vec3(0.05,0.20,0.70), f * 4.0)
      :  f < 0.55 ? mix(vec3(0.05,0.20,0.70), vec3(0.00,0.55,1.00), (f - 0.25) * 3.33)
      :  f < 0.80 ? mix(vec3(0.00,0.55,1.00), vec3(0.30,0.85,1.00), (f - 0.55) * 4.0)
      :             mix(vec3(0.30,0.85,1.00), vec3(0.95,1.00,1.00), (f - 0.80) * 5.0));
  if (u_colorMode == 1) {
    rgb = ember * (0.35 + 0.85 * rest / 255.0);
  } else if (u_colorMode == 2) {
    rgb = flux;
  } else if (u_colorMode == 3) {
    // macro: total occupancy — slate structure, cyan lift at density,
    // white at saturation (geometric read of the lump, noise stripped)
    float m = pow(min(1.0, (mov + rest) / 510.0) * 2.0, 0.7);
    vec3 base = mix(vec3(0.05, 0.06, 0.11), vec3(0.42, 0.50, 0.60), m);
    float core = smoothstep(0.52, 0.90, min(1.0, (mov + rest) / 255.0));
    rgb = mix(base, mix(vec3(0.15, 0.80, 0.90), vec3(0.90, 1.00, 1.00),
                        smoothstep(0.75, 1.0, min(1.0, (mov + rest) / 255.0))), core);
  } else {
    // ember: the whole story — cyan flux streams feeding amber heat
    rgb = ember * (0.35 + 0.85 * rest / 255.0) + flux * 0.85;
  }
  // photons: violet light, always additive — a beam must read through
  // vacuum in every color mode
  float g = pow(ph / 255.0, 0.6);
  rgb += mix(vec3(0.30, 0.10, 0.80), vec3(0.85, 0.70, 1.00), g) * g * 1.6;
  // excitation n: bound radiation — hot magenta, the ember within
  float eg = pow(exc / 255.0, 0.55);
  rgb += mix(vec3(0.60, 0.02, 0.25), vec3(1.00, 0.65, 0.85), eg) * eg * 1.8;
  // visibility floor: real occupancies run ~5-120, far below the 255
  // normalization — a sparse dim ember must still read against the void
  rgb = rgb * 1.15 + vec3(0.028);
  v_color = vec4(rgb, alpha);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec4 v_color;
in vec2 v_uv;
out vec4 frag;
void main() {
  float r2 = dot(v_uv, v_uv);
  if (r2 > 1.0) discard;                  // round billboard
  float a = exp(-r2 * 3.0);               // gaussian falloff, soft foam edge
  // rgb premultiplied by coverage AND coverage in alpha — the HDR pass
  // averages (rgb/a) instead of summing, so dense cores keep their hue
  frag = vec4(v_color.rgb * v_color.a * a, v_color.a * a);
}`;

// resolve pass — the point cloud accumulates additively into a
// half-float HDR target, then one fullscreen triangle tonemaps it.
// Reinhard keeps faint singles nearly linear while dense cores shoulder
// off smoothly — a lump shows an amber gradient into its hot center
// instead of a flat clipped disc.
const TM_VS = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
const TM_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_hdr;
uniform float u_exposure;
out vec4 frag;
void main() {
  vec4 h = texelFetch(u_hdr, ivec2(gl_FragCoord.xy), 0);
  // soft-additive resolve (the Ember look): sqrt compresses the
  // accumulated sum the way film compresses light — sparse regions
  // stay translucent, depth gradients survive, and dense cores glow
  // warm instead of clipping flat-white. Bounded: max ~0.88.
  vec3 c = sqrt(h.rgb) + vec3(0.02, 0.02, 0.05);
  c *= u_exposure;
  frag = vec4(c / (1.0 + c), 1.0);
}`;

export async function initMillSimulator(root, opts = {}) {
  const wasmUrl = opts.wasmUrl || '/wasm/ember/meso3i.js';
  const canvas = root.querySelector('canvas');
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
  const hud = root.querySelector('[data-hud]');
  if (!gl) { hud.textContent = 'WebGL2 unavailable'; return () => {}; }
  // mass-partition sparkline — rest vs flux, two strips, auto-scaled
  const graph = root.querySelector('[data-graph]');
  const gctx = graph ? graph.getContext('2d') : null;
  const hist = { rest: [], mov: [], cap: 240 };
  const drawGraph = () => {
    if (!gctx) return;
    const w = graph.width, h = graph.height, half = h >> 1;
    gctx.clearRect(0, 0, w, h);
    const strip = (arr, y0, hh, col) => {
      if (arr.length < 2) return;
      const mx = Math.max(1, ...arr);
      gctx.strokeStyle = col; gctx.lineWidth = 1; gctx.beginPath();
      for (let i = 0; i < arr.length; i++) {
        const x = 2 + (i / (hist.cap - 1)) * (w - 4);
        const y = y0 + hh - 3 - (arr[i] / mx) * (hh - 5);
        i ? gctx.lineTo(x, y) : gctx.moveTo(x, y);
      }
      gctx.stroke();
    };
    strip(hist.rest, 2, half - 2, 'rgba(255,150,50,0.9)');
    strip(hist.mov, half + 2, half - 3, 'rgba(140,100,255,0.9)');
  };
  const pushHist = () => {
    hist.rest.push(wasm._meso3i_rest_mass());
    hist.mov.push(wasm._meso3i_mov_mass());
    if (hist.rest.length > hist.cap) { hist.rest.shift(); hist.mov.shift(); }
    drawGraph();
  };

  // Transient status line under the HUD — metrics own the HUD, so
  // event messages live here and self-clear instead of being stomped
  // by the per-frame write. ms=0 pins until the next message.
  const statusEl = root.querySelector('[data-status]');
  let statusTimer = 0;
  const say = (msg, ms = 3000) => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    clearTimeout(statusTimer);
    statusTimer = ms > 0 ? setTimeout(() => { statusEl.textContent = ''; }, ms) : 0;
  };

  // ---------- wasm ----------
  say('loading engine…');
  if (typeof createEmber === 'undefined')
    await new Promise((res, rej) => {
      const sc = document.createElement('script');
      sc.src = wasmUrl; sc.onload = res;
      sc.onerror = () => rej(new Error('meso3i.js load failed: ' + wasmUrl));
      document.head.appendChild(sc);
    });
  say('instantiating wasm…');
  const wasm = await createEmber();
  // Runtime dims, all axes even. 72x72x36 ≈ 187k sites — a roomy arena
  // for structure hunting without the old 400k-node tick cost (meso3i's
  // per-site sweep touches 19 channels, not one 6-byte node).
  const [W3, H3, D3] = opts.dims || [72, 72, 36];
  if (wasm._meso3i_init(W3, H3, D3, 1) !== 0)
    { hud.textContent = `grid ${W3}x${H3}x${D3} rejected by engine`; return () => {}; }
  const N3 = W3 * H3 * D3;
  const CX = W3 >> 1, CY = H3 >> 1, CZ = D3 >> 1;
  // lattice centroid — cubic embedding, so raw grid coords are world coords
  const cenX = W3 * 0.5, cenY = H3 * 0.5, cenZ = D3 * 0.5;
  const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
  // The measured friction ecology (M33–M35): transit drag at rho>=8,
  // rest channel inert, radiation carrier-gated (fricmode < 0).
  wasm._meso3i_collmode(0);
  wasm._meso3i_friction(8);
  wasm._meso3i_fricmode(-4);
  wasm._meso3i_phot(2);                    // photon mode: stimulated emission

  // channel vectors out of the engine itself — the same table the
  // physics uses, so injection geometry can't drift from the rules
  const CV = [];
  for (let c = 0; c < NMOV; c++)
    CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);

  // Canonical convergent feed (M32–M36 canon): each moving channel
  // sources RATE quanta/tick at a point RAY cells back along its
  // direction — 18 spokes aimed at the lattice center.
  const RAY = 3, RATE = 4;
  // photon laser: an apertured PLANE WAVE riding an axial channel.
  // Only the six axial vectors (v=2) travel straight on D3Q19 — face
  // diagonals zigzag, so a "beam" on them fans into a spray. The
  // aperture is a checkerboard disc just inside the drain shell; OffU/
  // OffV translate it in the normal plane to graze lumps off-center.
  const AXIS = { x: 0, y: 1, z: 2 };
  const DIM = [W3, H3, D3], CTR = [CX, CY, CZ];
  // packed-grid offset: keeps the index-space cloud centered where the
  // camera expects the lattice to be (the packed image of the center
  // isn't the center of the packed image)
  const PACKOFF = [CX - (CX + CY - CZ) / 2, CY - (-CX + CY + CZ) / 2, CZ - (CX - CY + CZ) / 2];
  const PHV = 8;                                   // photons/tick per source site
  const beamFire = () => {
    const a = AXIS[ui.bdir[1]], s = ui.bdir[0] === '+' ? 1 : -1;
    const c = CV.findIndex(v => v[a] === 2 * s && !v[(a + 1) % 3] && !v[(a + 2) % 3]);
    if (c < 0) return;
    const u = (a + 1) % 3, w = (a + 2) % 3;
    const p0 = s > 0 ? 4 : DIM[a] - 5;             // inside drain_edge(3)
    const pt = [0, 0, 0]; pt[a] = p0;
    for (let du = -ui.bap; du <= ui.bap; du++)
    for (let dv = -ui.bap; dv <= ui.bap; dv++) {
      if (du * du + dv * dv > ui.bap * ui.bap) continue;
      pt[u] = CTR[u] + ui.bou + du;
      pt[w] = CTR[w] + ui.bov + dv;
      if (pt[u] < 0 || pt[u] >= DIM[u] || pt[w] < 0 || pt[w] >= DIM[w]) continue;
      wasm._meso3i_phset(pt[0], pt[1], pt[2], c, PHV);
    }
  };
  const inject = () => {
    for (let c = 0; c < NMOV; c++) {
      const [vx, vy, vz] = CV[c];
      if (!ui.drive) break;
      const sx = CX - RAY * vx, sy = CY - RAY * vy, sz = CZ - RAY * vz;
      for (let u = 0; u < RATE; u++)
        wasm._meso3i_set(sx, sy, sz, c, wasm._meso3i_get(sx, sy, sz, c) + 1);
    }
    if (ui.beam) beamFire();
  };

  // ⌖ vortex ring — THE knot test on this engine. Two concentric rings
  // of moving quanta placed on whichever channel best matches the local
  // CCW tangent in the current slice plane (any of the three coordinate
  // planes — the Plane select orients it). planck3 could store a
  // persistent spin direction per node; meso3i's rest bin can't, so
  // injected circulation either self-sustains or thermalizes — M38
  // measured ~25 ticks at 44^3. This is the loom-scale retest.
  const RING_Q = 48;
  const tangChannel = (du, dv, ax, u, v) => {
    const l = Math.hypot(du, dv) || 1;
    const tu = -dv / l, tv = du / l;           // CCW tangent in (u,v)
    let best = -1, bd = -Infinity;
    for (let c = 0; c < NMOV; c++) {
      if (CV[c][ax] !== 0) continue;           // in-plane channels only
      const dot = CV[c][u] * tu + CV[c][v] * tv;
      if (dot > bd) { bd = dot; best = c; }
    }
    return best;
  };
  const injectRing = (ctr = [CX, CY, CZ]) => {
    const ax = ui.sAxis, u = (ax + 1) % 3, v = (ax + 2) % 3;
    let n = 0;
    for (const r of [5, 4]) {                  // two concentric rings
      const steps = Math.ceil(2 * Math.PI * r) + 1;
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * 2 * Math.PI;
        const pt = [ctr[0], ctr[1], ctr[2]];
        pt[u] = Math.round(ctr[u] + r * Math.cos(a));
        pt[v] = Math.round(ctr[v] + r * Math.sin(a));
        const [x, y, z] = pt;
        if (x < 0 || x >= W3 || y < 0 || y >= H3 || z < 0 || z >= D3) continue;
        if (((x + y + z) & 1) !== 0) continue;   // live parity only
        const c = tangChannel(pt[u] - ctr[u], pt[v] - ctr[v], ax, u, v);
        if (c < 0) continue;
        const cur = wasm._meso3i_get(x, y, z, c);
        wasm._meso3i_set(x, y, z, c, Math.min(255, cur + RING_Q));
        n++;
      }
    }
    return n;
  };

  // ●: drop a cold rest-mass lump (the M35 rock) onto the slice plane —
  // the proven-persistent control case for the vortex experiment.
  // Thick enough that the photon laser visibly drills through it: a
  // thin lump just blinks out before the coupling modes can diverge.
  const LUMP_R = 5, LUMP_Q = 96;
  const seedBall = (lx, ly, lz, R, Q) => {
    let n = 0;
    for (let dz = -R; dz <= R; dz++)
    for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dy * dy + dz * dz > R * R) continue;
      const x = lx + dx, y = ly + dy, z = lz + dz;
      if (((x + y + z) & 1) !== 0) continue;   // live parity only
      if (x < 0 || x >= W3 || y < 0 || y >= H3 || z < 0 || z >= D3) continue;
      wasm._meso3i_set(x, y, z, REST, Q);
      n++;
    }
    return n;
  };
  const seedLump = (lx, ly, lz) => seedBall(lx, ly, lz, LUMP_R, LUMP_Q);

  // wound lump — scalar rest + directional bins wound about z (the
  // M45/M50 winding): the spin vault seed. rset writes parked
  // directional mass directly, so the object is born remembering.
  const seedWound = (lx, ly, lz, R, Q, s = 1) => {
    let n = 0;
    for (let dz = -R; dz <= R; dz++)
    for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dy * dy + dz * dz > R * R) continue;
      const x = lx + dx, y = ly + dy, z = lz + dz;
      if (((x + y + z) & 1) !== 0) continue;
      if (x < 0 || x >= W3 || y < 0 || y >= H3 || z < 0 || z >= D3) continue;
      wasm._meso3i_set(x, y, z, REST, Q);
      const vx = -s * dy, vy = s * dx;
      for (let c = 0; c < NMOV; c++) {
        const d = vx * CV[c][0] + vy * CV[c][1];
        if (d > 0) wasm._meso3i_rset(x, y, z, c, Math.min(255, Math.round(d * 8)));
      }
      n++;
    }
    return n;
  };

  // Camera ray through a canvas pixel -> lattice cell on the current
  // slice plane (normal = ui.sAxis). Camera orbits the lattice center at
  // (yaw, pitch, dist); world coords ARE grid coords under cubic embed.
  const pickCell = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    const panes = PANES[ui.split];
    const nPanes = panes ? 2 : 1;
    const pwCss = r.width / nPanes;
    const pane = Math.min(nPanes - 1, Math.max(0, Math.floor((cx - r.left) / pwCss)));
    const layout = panes ? panes[pane].layout : 0;
    const nx = ((cx - r.left - pane * pwCss) / pwCss) * 2 - 1;
    const ny = 1 - ((cy - r.top) / r.height) * 2;
    const asp = (canvas.width / nPanes) / Math.max(1, canvas.height);
    const th = Math.tan(0.45);              // half-fov (persp fov = 0.9 rad)
    // view-space ray
    const vx = nx * th * asp, vy = ny * th, vz = -1;
    // world = Ry(-yaw) * Rx(-pitch) applied to both camera pos and dir
    const cyw = Math.cos(cam.yaw), syw = Math.sin(cam.yaw);
    const cph = Math.cos(cam.pitch), sph = Math.sin(cam.pitch);
    // Rx(-p): (x, y c + z s, -y s + z c)
    const d1 = { x: vx, y: vy * cph + vz * sph, z: -vy * sph + vz * cph };
    // Ry(-y): (x c - z s, y, x s + z c)
    const dW = { x: d1.x * cyw - d1.z * syw, y: d1.y, z: d1.x * syw + d1.z * cyw };
    // camera world position = Ry(-yaw)*Rx(-pitch)*(0,0,dist) + look-at
    const c1 = { x: 0, y: cam.dist * sph, z: cam.dist * cph };
    const cW = { x: -c1.z * syw + cam.cx, y: c1.y + cam.cy, z: c1.z * cyw + cam.cz };
    const pw = [cW.x, cW.y, cW.z], dw = [dW.x, dW.y, dW.z];
    if (layout === 1) {
      // packed pane: lattice plane p[axis]=cut maps to a tilted plane in
      // packed coords — intersect the ray there, then unmap to lattice
      const n = ui.sAxis === 0 ? [1, 0, 1] : ui.sAxis === 1 ? [1, 1, 0] : [0, 1, 1];
      const rhs = ui.sCut + n[0] * PACKOFF[0] + n[1] * PACKOFF[1] + n[2] * PACKOFF[2];
      const den = n[0] * dw[0] + n[1] * dw[1] + n[2] * dw[2];
      if (Math.abs(den) < 1e-3) return null;
      const t = (rhs - (n[0] * pw[0] + n[1] * pw[1] + n[2] * pw[2])) / den;
      if (t <= 0) return null;
      const q = [pw[0] + t * dw[0] - PACKOFF[0], pw[1] + t * dw[1] - PACKOFF[1], pw[2] + t * dw[2] - PACKOFF[2]];
      return {
        lx: Math.round(q[0] + q[2]),          // x = a + c
        ly: Math.round(q[0] + q[1]),          // y = a + b
        lz: Math.round(q[1] + q[2]),          // z = b + c
      };
    }
    if (Math.abs(dw[ui.sAxis]) < 1e-3) return null;  // edge-on: plane never hit
    const t = (ui.sCut - pw[ui.sAxis]) / dw[ui.sAxis];
    if (t <= 0) return null;
    return {
      lx: Math.round(pw[0] + t * dw[0]),
      ly: Math.round(pw[1] + t * dw[1]),
      lz: Math.round(pw[2] + t * dw[2]),
    };
  };

  // ---------- GL ----------
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  // HDR pipeline: EXT_color_buffer_float lets the additive blend land in
  // a half-float target (no 8-bit clamp), resolved to the canvas by the
  // tonemap pass. Without it we draw straight to the screen as before.
  let hdrOK = !!gl.getExtension('EXT_color_buffer_float');
  let tmProg = null, tmVao = null, fbo = null, hdrTex = null;
  const tmU = {};
  let hdrW = 0, hdrH = 0;
  if (hdrOK) {
    tmProg = gl.createProgram();
    gl.attachShader(tmProg, sh(gl.VERTEX_SHADER, TM_VS));
    gl.attachShader(tmProg, sh(gl.FRAGMENT_SHADER, TM_FRAG));
    gl.linkProgram(tmProg);
    if (!gl.getProgramParameter(tmProg, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(tmProg));
    tmU.u_hdr = gl.getUniformLocation(tmProg, 'u_hdr');
    tmU.u_exposure = gl.getUniformLocation(tmProg, 'u_exposure');
    tmVao = gl.createVertexArray();            // attribute-less fullscreen tri
    hdrTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, hdrTex);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
      [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]])
      gl.texParameteri(gl.TEXTURE_2D, k, v);
    fbo = gl.createFramebuffer();
  }
  const ensureHDR = (w, h) => {
    if (!hdrOK || w < 1 || h < 1 || (w === hdrW && h === hdrH)) return;
    hdrW = w; hdrH = h;
    gl.bindTexture(gl.TEXTURE_2D, hdrTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, hdrTex, 0);
    // some drivers expose the extension but won't actually complete the
    // framebuffer — check once and fall back to direct rendering forever
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      hdrOK = false;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(fbo);
      gl.deleteTexture(hdrTex);
      return;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  const U = {};
  for (const n of ['u_mvp', 'u_vol', 'u_size', 'u_s_center', 'u_s_thick',
    'u_s_axis', 'u_ghost_alpha', 'u_qmin', 'u_colorMode',
    'u_nx', 'u_ny', 'u_nxy', 'u_step', 'u_layout', 'u_packoff'])
    U[n] = gl.getUniformLocation(prog, n);

  // Hardware safe-fail: the whole lattice lives in one RG8 3D texture.
  const maxTex = gl.getParameter(gl.MAX_3D_TEXTURE_SIZE);
  if (Math.max(W3, H3, D3) > maxTex) {
    hud.textContent = `grid ${W3}x${H3}x${D3} exceeds GL 3D texture limit (${maxTex})`;
    return () => {};
  }
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, tex);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, W3, H3, D3, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
    [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE]])
    gl.texParameteri(gl.TEXTURE_3D, k, v);
  gl.uniform1i(U.u_vol, 0);
  gl.activeTexture(gl.TEXTURE0);
  const rgPtr = wasm._meso3i_rg_pointer();
  const upload = () => {
    wasm._meso3i_rg_refresh();
    // re-fetch the heap view each frame — ALLOW_MEMORY_GROWTH can detach it
    const h8 = wasm.HEAPU8 || new Uint8Array(wasm.wasmMemory.buffer);
    gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, 0, W3, H3, D3, gl.RGBA, gl.UNSIGNED_BYTE,
      h8.subarray(rgPtr, rgPtr + N3 * 4));
  };

  // iOS Safari kills GPU contexts aggressively — signal + let the page
  // re-init on restore rather than freeze on a black canvas.
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    say('GPU context lost — restarting…', 5000);
  });
  canvas.addEventListener('webglcontextrestored', () => {
    root.dispatchEvent(new CustomEvent('mill:reinit'));
  });

  // billboard quad (2 tris) — instanced N3 times
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(false);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE); // additive — order-independent point cloud

  // ---------- camera / controls ----------
  // cubic embedding: the camera orbits the lattice center directly
  const cam = { yaw: 0.7, pitch: 0.45, dist: 68, cx: cenX, cy: cenY, cz: cenZ };
  const tgt = { ...cam };                 // preset targets (smooth lerp)
  // lastInteract in the past → turntable spins from the first frame
  let dirty = true, lastInteract = -1e4;
  const ptrs = new Map();
  let lastPinch = 0, lastMid = null, pinchRest = false;
  canvas.style.touchAction = 'none';
  const poke = () => { lastInteract = performance.now(); };
  let downPos = null, rightPan = false;
  // shared pan: drag the look-at center along the camera's right/up axes
  const panBy = (dx, dy) => {
    const s = cam.dist * 0.0016;
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    const cxp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const rx = cy, ry = sp * sy, rz = -cxp * sy;      // R·(1,0,0)
    const ux = 0, uy = cxp, uz = sp;                  // R·(0,1,0)
    tgt.cx += (dy * ux - dx * rx) * s;
    tgt.cy += (dy * uy - dx * ry) * s;
    tgt.cz += (dy * uz - dx * rz) * s;
    const cl = v => Math.max(-120, Math.min(120, v));
    tgt.cx = cl(tgt.cx); tgt.cy = cl(tgt.cy); tgt.cz = cl(tgt.cz);
    dirty = true;
  };
  // suppress the browser context menu — right-drag pans instead
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    poke();
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    downPos = [e.clientX, e.clientY];
    if (e.button === 2) rightPan = true;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    poke();
    const prev = ptrs.get(e.pointerId);
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 1) {
      // pinch collapsed to one finger — its tracked position is stale
      // pre-pinch state; eating the delta avoids an orbit jump
      if (pinchRest) return;
      if (rightPan) { panBy(e.clientX - prev[0], e.clientY - prev[1]); return; }
      tgt.yaw += (e.clientX - prev[0]) * 0.008;
      tgt.pitch = Math.max(-1.5, Math.min(1.5, tgt.pitch + (e.clientY - prev[1]) * 0.008));
      dirty = true;
    } else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (lastPinch) { tgt.dist = Math.max(20, Math.min(300, tgt.dist * lastPinch / d)); dirty = true; }
      lastPinch = d;
      // two-finger pan (content follows the fingers)
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (lastMid) panBy(mid[0] - lastMid[0], mid[1] - lastMid[1]);
      lastMid = mid;
    }
  });
  const endPtr = e => {
    ptrs.delete(e.pointerId); lastPinch = 0; lastMid = null;
    if (e.button === 2) rightPan = false;
    if (ptrs.size === 1) pinchRest = true;   // a pinch just collapsed
    else pinchRest = false;
    // armed placement tool: a LEFT click (not a drag) drops the armed
    // payload on the slice plane; the tool stays armed — tap its
    // button again to disarm
    if (ui.arm && downPos && ptrs.size === 0 && e.button === 0) {
      const moved = Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]);
      if (moved < 8) {
        const cell = pickCell(e.clientX, e.clientY);
        if (cell) {
          const n = ui.arm === 'ring'
            ? injectRing([cell.lx, cell.ly, cell.lz])
            : seedLump(cell.lx, cell.ly, cell.lz);
          upload(); dirty = true;
          if (ui.arm === 'ring')
            say(n ? `vortex ring — ${n} cells spinning · watch for thermalization`
                  : 'no live cells there — aim inside the lattice');
          else
            say(n ? `cold rock dropped — ${n * LUMP_Q} quanta parked`
                  : 'no live cells there — aim inside the lattice');
        } else say('edge-on view — pick while the slice plane is facing you', 4500);
      }
    }
    downPos = null;
  };
  canvas.addEventListener('pointerup', endPtr);
  canvas.addEventListener('pointercancel', endPtr);
  // iOS Safari fires gesture* events for pinch regardless of touch-action —
  // preventDefault keeps page pinch-zoom from fighting the orbit zoom.
  for (const g of ['gesturestart', 'gesturechange', 'gestureend'])
    canvas.addEventListener(g, e => e.preventDefault());
  // Keep the screen awake while a mobile visitor watches the turntable.
  let wakeLock = null;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const keepAwake = () => {
    if (!coarse || document.hidden) return;
    navigator.wakeLock?.request('screen').then(l => { wakeLock = l; }).catch(() => {});
  };
  keepAwake();
  document.addEventListener('visibilitychange', keepAwake);
  // wheel = zoom; Shift+wheel = scrub the cut plane through the volume
  let cutAcc = 0;
  canvas.addEventListener('wheel', e => {
    e.preventDefault(); poke();
    if (e.shiftKey) {
      cutAcc += Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      const step = Math.trunc(cutAcc / 60);
      if (step) { setCut(ui.sCut + step); cutAcc -= step * 60; }
      return;
    }
    cutAcc = 0;
    tgt.dist = Math.max(20, Math.min(300, tgt.dist * (1 + e.deltaY * 0.001)));
    dirty = true;
  }, { passive: false });

  // ---------- state / UI ----------
  const ui = {
    playing: true, tickMs: 0, budget: 12, tick: 0, tps: 20, tickDebt: 0,
    sAxis: 2, sCut: D3 >> 1, sSlab: D3, ghostAlpha: 0.06,
    qmin: 2, size: 0.55, colorMode: 0,
    turntable: !matchMedia('(prefers-reduced-motion: reduce)').matches,
    drive: false, beam: false, arm: null,      // arm: 'ring' | 'lump'
    phot: 2, pair: false, drest: 0, exposure: 1.2, split: 'off', scene: '',
    bdir: '+x', bap: 4, bou: 0, bov: 0,            // laser: dir/aperture/offsets
  };
  // split panes: {layout, mode} per half — mode -1 follows the View select
  const PANES = {
    off:    null,
    layout: [{ layout: 0, mode: -1 }, { layout: 1, mode: -1 }],
    modes:  [{ layout: 0, mode: 0 },  { layout: 0, mode: 2 }],
  };
  // boot state is set by the default scene (SCENES.vault) once all
  // widget binds exist — scenes drive the real controls so the dock
  // stays honest
  // slice sliders track whichever plane axis is active
  const syncSliceUI = () => {
    const cut = root.querySelector('[data-cut]');
    const slab = root.querySelector('[data-slab]');
    if (cut) { cut.max = DIM[ui.sAxis] - 1; cut.value = ui.sCut;
      const o = cut.parentElement?.querySelector('output'); if (o) o.value = ui.sCut; }
    if (slab) { slab.max = DIM[ui.sAxis]; slab.value = ui.sSlab;
      const o = slab.parentElement?.querySelector('output'); if (o) o.value = ui.sSlab; }
  };
  const setCut = (v) => {
    ui.sCut = Math.max(0, Math.min(DIM[ui.sAxis] - 1, v));
    const el = root.querySelector('[data-cut]');
    if (el) { el.value = ui.sCut;
      const o = el.parentElement?.querySelector('output'); if (o) o.value = ui.sCut; }
    dirty = true;
  };
  syncSliceUI();
  // render stride: subsample the lattice when the instance count would
  // crush the GPU (headless-scale grids / weak mobile GPUs). Adjusts on
  // a SUSTAINED window only — a warmup dip (shader compile, first
  // texture upload) must never permanently coarsen the picture, and a
  // recovered GPU refines back to full density.
  const rStep0 = N3 > 16e6 ? 4 : N3 > 4e6 ? 2 : 1;
  let rStep = rStep0;
  let lowT = null, highT = null, lastSpent = 0;
  const bootT = performance.now();
  const strideInfo = () => {
    const nx = Math.ceil(W3 / rStep), ny = Math.ceil(H3 / rStep), nz = Math.ceil(D3 / rStep);
    return { nx, ny, nxy: nx * ny, count: nx * ny * nz };
  };
  const spinBtn = root.querySelector('[data-spin]');
  if (spinBtn && !ui.turntable) { spinBtn.classList.remove('on'); spinBtn.setAttribute('aria-pressed', 'false'); }
  const bind = (sel, ev, fn) => { const el = root.querySelector(sel); if (el) el.addEventListener(ev, fn); return el; };
  bind('[data-play]', 'click', e => { ui.playing = !ui.playing; e.currentTarget.classList.toggle('on', ui.playing); const g = e.currentTarget.querySelector('.g'); if (g) g.textContent = ui.playing ? '⏸' : '▶'; });
  bind('[data-step]', 'click', () => {
    if (ui.drive || ui.beam) inject();
    wasm._meso3i_drain_edge(3);
    wasm._meso3i_tick();
    ui.tick++; upload(); dirty = true;
  });
  bind('[data-reset]', 'click', () => {
    wasm._meso3i_clear(); ui.tick = 0;
    if (ui.drest) seedWound(CX, CY, CZ, 5, 48); else seedLump(CX, CY, CZ);
    rStep = rStep0; lowT = highT = null;   // restore render density too
    upload(); dirty = true;
    say(ui.drive ? 'cleared — spokes are still feeding, watch it re-accrete' : 'cleared — cold vacuum');
  });
  const toggle = (sel, key, onSay, offSay) => bind(sel, 'click', e => {
    ui[key] = !ui[key];
    const b = e.currentTarget;
    b.classList.toggle('on', ui[key]);
    b.setAttribute('aria-pressed', String(ui[key]));
    say(ui[key] ? onSay : offSay);
  });
  toggle('[data-drive]', 'drive',
    'convergent feed on — 18 spokes pouring flux into the core',
    'feed cut — parked heat waits for a carrier');
  toggle('[data-beam]', 'beam',
    'photon laser on — violet light shining +x across the lattice · coupling set by the Phot dial',
    'laser off');
  bind('[data-pair]', 'click', e => {
    ui.pair = !ui.pair;
    wasm._meso3i_pair(ui.pair ? 1 : 0);
    const b = e.currentTarget;
    b.classList.toggle('on', ui.pair); b.setAttribute('aria-pressed', String(ui.pair));
    say(ui.pair ? 'pair rules on — radiation goes out back-to-back, head-on collisions bind into rest'
                : 'pair rules off');
  });
  bind('[data-binary]', 'click', () => {
    // M37 two-body preset: two small lumps ~6 cells of vacuum apart on
    // the equator. M47b: pairwise ablation is real only between
    // self-radiating lumps and is transient; under the centered ☀
    // drive the convergence is drive-centric infall, not attraction.
    const a = seedBall(CX - 6, CY, CZ, 3, 64);
    const b = seedBall(CX + 6, CY, CZ, 3, 64);
    upload(); dirty = true;
    say(`M37 pair dropped — ${a + b} sites parked · ☀ convergence is drive-centric; mutual ablation needs Rad > 0`, 6000);
  });
  // one-click physics scenes — zero the field, set the measured flag
  // combination through the real widgets (so the dock stays honest),
  // and seed the canonical geometry. Params are the measured regimes,
  // not guesses: wound = the latency-test wind-dominant config.
  const ctl = (sel, v, ev = 'input') => {
    const e = root.querySelector(sel);
    if (!e) return;
    e.value = v;
    e.dispatchEvent(new Event(ev, { bubbles: true }));
  };
  const press = (sel, key, on) => {
    if (ui[key] !== on) root.querySelector(sel)?.click();
  };
  // M49 friction params: every scene sets all three explicitly so
  // presets compose cleanly (no flag leaks between scenes)
  const setFric = (park = 50, curve = 0, wall = 0) => {
    ctl('[data-park]', park);
    ctl('[data-fcurve]', String(curve), 'change');
    ctl('[data-wall]', wall);
  };
  const SCENES = {
    wound: () => {
      ctl('[data-coll]', '1', 'change');
      ctl('[data-lat]', 16);
      setFric(50, 0, 0);
      press('[data-pair]', 'pair', true);
      press('[data-beam]', 'beam', false);
      press('[data-drive]', 'drive', true);
      wasm._meso3i_clear(); seedLump(CX, CY, CZ);
      say('wound lump — Lat 16 + ⇄ + ☀: sporadic flux can\'t unwind; bound rest may grow where collision traffic persists', 6000);
    },
    breath: () => {
      ctl('[data-coll]', '0', 'change');
      ctl('[data-lat]', 1);
      setFric(50, 0, 0);
      press('[data-pair]', 'pair', false);
      press('[data-beam]', 'beam', false);
      press('[data-drive]', 'drive', true);
      wasm._meso3i_clear(); seedLump(CX, CY, CZ);
      say('breathing core — ☀ + Rad: the lump feeds and vents toward a steady ember, watch the sparkline plateau', 6000);
    },
    comet: () => {
      ctl('[data-coll]', '0', 'change');
      ctl('[data-lat]', 1);
      ctl('[data-phot]', '2', 'change');
      ctl('[data-bov]', 6);
      setFric(50, 0, 0);
      press('[data-pair]', 'pair', false);
      press('[data-drive]', 'drive', false);
      press('[data-beam]', 'beam', true);
      wasm._meso3i_clear(); seedLump(CX, CY, CZ);
      say('comet ablation — offset plane wave grazing a cold lump: watch the stimulated plume and core@ drift', 6000);
    },
    // M49 capture-rule regimes — the phase boundary is live
    porous: () => {
      ctl('[data-coll]', '0', 'change');
      ctl('[data-lat]', 1);
      setFric(50, 1, 0);
      press('[data-pair]', 'pair', false);
      press('[data-beam]', 'beam', false);
      press('[data-drive]', 'drive', true);
      wasm._meso3i_clear(); seedLump(CX, CY, CZ);
      say('porous rim — capture ramps 0→100% only at saturation: the skin never closes and the lump unravels (M49: ~98% mass loss)', 6000);
    },
    fossil: () => {
      ctl('[data-coll]', '0', 'change');
      ctl('[data-lat]', 1);
      setFric(50, 2, 0);
      press('[data-pair]', 'pair', false);
      press('[data-beam]', 'beam', false);
      press('[data-drive]', 'drive', true);
      wasm._meso3i_clear(); seedLump(CX, CY, CZ);
      say('fossil seal — capture hits 100% at 2×cap: the lump traps everything and goes transaction-silent. A scar, not a metabolism', 6000);
    },
    walled: () => {
      ctl('[data-coll]', '0', 'change');
      ctl('[data-lat]', 1);
      setFric(50, 0, 32);
      press('[data-pair]', 'pair', false);
      press('[data-beam]', 'beam', false);
      press('[data-drive]', 'drive', true);
      wasm._meso3i_clear(); seedLump(CX, CY, CZ);
      say('walled crust — Wall 32: saturated sites refuse inflow; a dense crust builds at the refusal boundary with a hollow core. Under a beam, accretion happens on the lit face (M51)', 6500);
    },
    // default: the lone ember under iE thermalize — radiates photons,
    // re-absorbs as excitation n (magenta). The E20 greenhouse scene.
    ember: () => {
      ctl('[data-coll]', '0', 'change');
      ctl('[data-lat]', 1);
      ctl('[data-phot]', '5', 'change');
      ctl('[data-drest]', '0', 'change');
      setFric(50, 0, 0);
      press('[data-pair]', 'pair', false);
      press('[data-beam]', 'beam', false);
      press('[data-drive]', 'drive', true);
      wasm._meso3i_clear(); seedLump(CX, CY, CZ);
      say('glowing ember — the lump radiates photons, re-absorbs them as bound excitation n (magenta): matter made of heat (E20)', 6500);
    },
    // M50-B: the spin vault — directional rest behind a refusal crust.
    // The wall turns beam ablation into winding-fed accretion.
    vault: () => {
      ctl('[data-coll]', '0', 'change');
      ctl('[data-lat]', 1);
      ctl('[data-drest]', '1', 'change');
      setFric(50, 0, 32);
      press('[data-pair]', 'pair', false);
      press('[data-beam]', 'beam', false);
      press('[data-drive]', 'drive', false);
      wasm._meso3i_clear(); seedWound(CX, CY, CZ, 5, 48);
      say('spin vault — directional rest + Wall 32: stored rotation behind a refusal crust. The headless record: a mass beam feeds the winding instead of ablating it (98% spin kept over 800t, M50) — probe it with ☀ or ➤', 7000);
    },
  };
  bind('[data-scene]', 'change', e => {
    const f = SCENES[e.target.value];
    ui.scene = e.target.value;              // the ? card reads the ACTIVE scene
    e.target.value = '';                    // back to "Scene…" so re-picks refire
    ctl('[data-drest]', '0', 'change');     // no rest-mode leak between scenes; vault re-arms it
    if (f) { f(); upload(); dirty = true; }
  });
  // radio-exclusive armed tools: ⌖ vortex ring vs ● cold rock
  const armBtns = { ring: root.querySelector('[data-ring]'), lump: root.querySelector('[data-lump]') };
  const setArm = (which) => {
    ui.arm = ui.arm === which ? null : which;
    canvas.style.cursor = ui.arm ? 'crosshair' : '';
    for (const k of ['ring', 'lump']) {
      const b = armBtns[k];
      if (b) { b.classList.toggle('armed', ui.arm === k); b.setAttribute('aria-pressed', String(ui.arm === k)); }
    }
    say(ui.arm === 'ring' ? 'vortex tool armed — tap the slice plane to inject a circulation ring · ⌖ to cancel'
      : ui.arm === 'lump' ? 'rock tool armed — tap the slice plane to drop a cold lump · ● to cancel'
      : '', 0);
  };
  bind('[data-ring]', 'click', () => setArm('ring'));
  bind('[data-lump]', 'click', () => setArm('lump'));
  bind('[data-snap]', 'click', () => { wasm._meso3i_save(); const b = root.querySelector('[data-unsnap]'); if (b) b.disabled = false; say('snapshot saved', 2500); });
  bind('[data-unsnap]', 'click', () => { if (wasm._meso3i_restore() === 0) { upload(); dirty = true; } });
  bind('[data-fric]', 'input', e => { wasm._meso3i_friction(+e.target.value); readout(e); });
  bind('[data-rad]', 'input', e => { wasm._meso3i_fricmode(-(+e.target.value)); readout(e); });
  bind('[data-lat]', 'input', e => { wasm._meso3i_lat(+e.target.value); readout(e); });
  bind('[data-bdir]', 'change', e => { ui.bdir = e.target.value; });
  bind('[data-bap]', 'input', e => { ui.bap = +e.target.value; readout(e); });
  bind('[data-bou]', 'input', e => { ui.bou = +e.target.value; readout(e); });
  bind('[data-bov]', 'input', e => { ui.bov = +e.target.value; readout(e); });
  bind('[data-phot]', 'change', e => { ui.phot = +e.target.value; wasm._meso3i_phot(ui.phot); });
  bind('[data-drest]', 'change', e => {
    ui.drest = +e.target.value;
    wasm._meso3i_drest(ui.drest);
    say(ui.drest ? 'directional rest — parked flux keeps its channel: wound mass can store rotation'
                 : 'scalar rest — parked heat forgets which way it was going');
  });
  bind('[data-coll]', 'change', e => { wasm._meso3i_collmode(+e.target.value); });
  bind('[data-spin]', 'click', e => {
    ui.turntable = !ui.turntable;
    e.currentTarget.setAttribute('aria-pressed', String(ui.turntable));
    e.currentTarget.classList.toggle('on', ui.turntable);
    poke();
  });
  const readout = e => {
    const o = e.target.parentElement?.querySelector('output');
    if (o) o.value = e.target.value;
  };
  bind('[data-axis]', 'change', e => {
    ui.sAxis = +e.target.value;
    ui.sCut = DIM[ui.sAxis] >> 1;
    ui.sSlab = DIM[ui.sAxis];
    syncSliceUI(); dirty = true;
    say(`slicing ${['yz', 'xz', 'xy'][ui.sAxis]} — Shift+scroll scrubs the cut · tools drop on this plane`, 5000);
  });
  bind('[data-cut]', 'input', e => { ui.sCut = +e.target.value; readout(e); dirty = true; });
  bind('[data-slab]', 'input', e => { ui.sSlab = +e.target.value; readout(e); dirty = true; });
  bind('[data-fcurve]', 'change', e => {
    wasm._meso3i_friccurve(+e.target.value);
    say(+e.target.value === 1 ? 'capture ramp →255: rim stays porous — watch the lump unravel'
      : +e.target.value === 2 ? 'capture ramp →2×cap: interior seals — watch breathing die'
      : 'flat capture gate — the canonical constant', 4500);
  });
  bind('[data-park]', 'input', e => { wasm._meso3i_fricp(Math.round(+e.target.value * 2.56)); readout(e); });
  bind('[data-wall]', 'input', e => { wasm._meso3i_reflect(+e.target.value); readout(e); });
  bind('[data-qmin]', 'input', e => { ui.qmin = +e.target.value; readout(e); dirty = true; });
  bind('[data-size]', 'input', e => { ui.size = +e.target.value / 100; readout(e); dirty = true; });
  bind('[data-speed]', 'input', e => { ui.tps = +e.target.value; readout(e); });
  bind('[data-colormode]', 'change', e => { ui.colorMode = +e.target.value; dirty = true; });
  // split view: two lenses on the same live field — cube|fcc compares
  // coordinate systems, ember|flux compares mass channels
  const TAGS = { layout: ['cubic embed', 'fcc index'], modes: ['ember', 'flux'] };
  bind('[data-split]', 'change', e => {
    ui.split = e.target.value;
    root.classList.toggle('split-on', ui.split !== 'off');
    const [tl, tr] = TAGS[ui.split] || ['', ''];
    const el = root.querySelector('[data-tagl]'), er = root.querySelector('[data-tagr]');
    if (el) el.textContent = tl; if (er) er.textContent = tr;
    dirty = true;
    if (ui.split === 'layout')
      say('same lattice, two coordinates — left: true positions, parity gaps real · right: primitive index space, gaps removed', 7000);
    else if (ui.split === 'modes')
      say('same field, two channels — parked heat left, moving flux right', 6000);
  });
  bind('[data-zoom]', 'input', e => { tgt.dist = +e.target.value; readout(e); poke(); dirty = true; });
  // zoom lens — RADIAL drag: distance from center is the zoom level.
  // Pull outward = pull back (zoom out), toward center = zoom in.
  // Absolute mapping — the pointer position reads as the dist itself.
  const zlens = root.querySelector('[data-zoomlens]');
  const zctx = zlens?.getContext('2d');
  if (zlens && zctx) {
    let zy = null;
    zlens.addEventListener('pointerdown', e => {
      zy = e.clientY; zlens.setPointerCapture(e.pointerId);
    });
    zlens.addEventListener('pointermove', e => {
      if (zy === null) return;                      // relative drag: up = in, down = out
      tgt.dist = Math.max(20, Math.min(300, tgt.dist + (e.clientY - zy) * 0.5));
      zy = e.clientY; dirty = true;
    });
    zlens.addEventListener('pointerup', () => { zy = null; syncZoom(); });
    zlens.addEventListener('dblclick', e => { e.preventDefault(); tgt.dist = 68; dirty = true; });
  }
  const drawLens = () => {
    if (!zctx) return;
    const S = zlens.width, c = S / 2, R = S * 0.42;
    const f = (tgt.dist - 20) / 280;          // 0 = zoomed in, 1 = zoomed out
    zctx.clearRect(0, 0, S, S);
    // faint rim
    zctx.strokeStyle = 'rgba(160, 200, 255, 0.22)';
    zctx.lineWidth = S * 0.016;
    zctx.beginPath(); zctx.arc(c, c, R, 0, 7); zctx.stroke();
    // numeric zoom: 1.0x = default dist 68 — closer reads bigger
    const zoom = 68 / tgt.dist;
    zctx.fillStyle = 'rgba(127, 255, 238, 0.95)';
    zctx.font = `600 ${S * 0.21}px monospace`;
    zctx.textAlign = 'center'; zctx.textBaseline = 'middle';
    zctx.fillText(zoom.toFixed(1) + 'x', c, c);
  };
  bind('[data-expo]', 'input', e => { ui.exposure = +e.target.value / 100; readout(e); dirty = true; });
  // dock accordions — Flags (selects) and Tuning (sliders) collapse by
  // class on the dock root so both stay out of the way on load
  const acc = (sel, cls) => bind(sel, 'click', e => {
    const dock = root.querySelector('.mill-dock');
    const open = dock?.classList.toggle(cls);
    e.currentTarget.setAttribute('aria-expanded', String(!!open));
  });
  acc('[data-flags]', 'sel-open');
  acc('[data-tune]', 'tune-open');

  // ? help cards — one delegated listener covers every chip; the Scene
  // chip resolves whichever scene the select currently names
  const HELP = {
    cut: ['Cut', 'position of the slice plane along the Plane axis — cells outside the Slab window ghost to silhouettes. Shift+scroll on the canvas scrubs it through the volume.'],
    slab: ['Slab', 'slice thickness in cells — max shows the whole volume, 1 isolates a single lattice plane. Thin slabs are how you read core/skin anatomy.'],
    size: ['Size', 'billboard size per cell — pure cosmetics. Bigger fuses the lattice into foam, smaller resolves the discrete sites.'],
    qmin: ['Q≥', 'density floor — a cell is clipped unless its brightest channel reads at least this. Raise it to strip haze and expose skeletons.'],
    fric: ['Drag (IFRIC)', 'transit friction threshold — a carrier arriving at a destination this dense becomes eligible to park as rest mass. The canonical congestion drag.'],
    park: ['Park% (fricp)', 'capture probability for a qualifying transit — 50 is the measured canonical gate, not a constant of nature (M49). 0 never parks, 100 always does.'],
    wall: ['Wall (IREFL)', 'congestion refusal — destinations this dense reject inflow outright; carriers turn back instead of entering. The crust/vault builder (M49–M51).'],
    rad: ['Rad', 'radiation rate — how readily parked rest re-emits as moving flux once its dwell is served.'],
    lat: ['Lat', 'emission latency — a carrier must dwell this many ticks before the rest channel may radiate it. Long dwell freezes fossils; short keeps lumps breathing.'],
    bap: ['Ap', 'beam aperture radius — the photon laser fires a checkerboard disc this wide, just inside the drain shell.'],
    bou: ['OffU', 'beam offset, first axis of the plane normal to Dir — off-center beams graze lumps instead of striking dead center (the M36 comet geometry).'],
    bov: ['OffV', 'beam offset, second axis of the normal plane — with OffU it places the aperture anywhere on the disc.'],
    speed: ['Speed', 'tick governor in ticks/sec — c here is 1 cell/tick, so uncapped the lattice outruns the eye. The renderer adapts stride to keep the frame alive.'],
    zoom: ['Zoom', 'camera distance — same as scroll / pinch.'],
    expo: ['Glow', 'HDR exposure — how much accumulated light the tonemap passes through. Lower tames saturated cores, higher lifts faint flux.'],
    'grp-time': ['time controls', '⏸ play/pause the tick loop · ⏭ step exactly one tick · ⟲ reset — clears the field (re-seeds a wound lump while Rest=directional).'],
    'grp-inject': ['injection tools', 'things that add to the field: ☀ feed — convergent 18-spoke flux drive · ➤ beam — photon laser, shaped by Dir/Ap/OffU/OffV · ⌖ ring — arm, then tap the slice plane to inject circulation · ● rock — arm, tap to drop a cold lump · ⇄ pair rules — momentum-honest bind/unbind: rest radiates back-to-back pairs, head-on collisions bind into rest · ⚭ binary — drops the M37 two-lump pair to watch mutual-ablation attraction.'],
    'grp-ops': ['session ops', '⟳ auto orbit — turntable camera · ⧉ save snap — stash field + flags · ⤺ load snap — restore it.'],
    focus: ['Focus', 'camera presets — named orbits plus a matched slice jump. Double-tap the gizmo to reset to Full field. Hex axis looks straight down the (1,1,1) body diagonal — FCC close-packed planes face you and the honeycomb layering shows face-on.'],
    colormode: ['View', 'render channel — ember: parked heat + cyan flux · heat: rest only · flux: moving only · macro: total occupancy, noise stripped.'],
    coll: ['Collide', 'collision rule variant — uniform is canonical; the others reweight how colliding carriers pick outgoing channels.'],
    phot: ['Phot (IPHOT)', 'photon coupling — how beam light interacts with parked mass: catalyst / stimulated / absorbed / off. The ➤ beam only exists while this is on.'],
    scene: ['Scene', 'measured regimes from the meso monograph — one click sets flags, seeds and geometry. Pick a scene, then tap ? again for its card.'],
    'scene.vault': ['spin vault · M50', 'a wound lump — directional rest parked with real winding — sealed behind a Wall-32 refusal crust. Inert until fed: the recorded vault kept 98% of stored winding under an 800-tick mass beam while accreting ~11% mass.'],
    'scene.wound': ['wound lump · M42', 'directional rest + Lat 16 + pair rules under convergent feed — parked flux that remembers its channel, storing angular momentum in rest bins.'],
    'scene.breath': ['breathing core · M33', 'convergent feed plus radiation — the lump feeds and vents until it settles into a steady ember. Watch the sparkline plateau.'],
    'scene.comet': ['comet ablation · M36', 'an off-center beam erodes the lump asymmetrically — ablation reads as apparent drift; morphology, not flags, decides the direction (M51).'],
    'scene.porous': ['porous rim · M49', 'capture ramped soft (ramp→255) — the park gate weakens as density climbs and the rim dissolves into froth.'],
    'scene.fossil': ['fossil seal · M49', 'capture ramped steep (ramp→2cap) — the rim parks first and fossilizes, sealing the lump in a self-made crust.'],
    'scene.walled': ['walled crust · M49', 'Wall 32 refusal under convergent feed — congestion builds a stratified crust; where new mass lands is morphology, not law.'],
    'scene.none': ['Scene', 'no scene selected — the field is whatever you built. Pick a scene for its measured-regime card.'],
    drest: ['Rest (IDREST)', 'rest-channel mode — scalar forgets direction (anonymous parked mass); directional parks "frozen flux" that keeps its channel: the winding memory behind wound lumps and vaults.'],
    fcurve: ['Curve', 'capture curve — how park probability scales with destination density. Flat is canonical; ramp→255 dissolves lumps, ramp→2cap fossilizes them (M49).'],
    axis: ['Plane', 'which coordinate Cut/Slab gate on — and the plane armed tools (⌖ ring, ● rock) inject onto.'],
    bdir: ['Dir', 'beam direction — only the six axial channels travel straight on D3Q19; face diagonals zigzag and fan into spray.'],
    split: ['Split', 'two lenses on the same live field — cube|fcc compares coordinate systems, ember|flux compares mass channels.'],
  };
  const cardEl = root.querySelector('[data-card]');
  const cardT = root.querySelector('[data-card-title]');
  const cardB = root.querySelector('[data-card-body]');
  const hideCard = () => { if (cardEl) { cardEl.hidden = true; delete cardEl.dataset.key; } };
  root.addEventListener('click', e => {
    const hb = e.target.closest('[data-help]');
    if (hb) {
      e.preventDefault(); e.stopPropagation();
      let key = hb.dataset.help;
      if (key === 'scene') key = 'scene.' + (ui.scene || 'none');
      if (cardEl?.dataset.key === key) { hideCard(); return; }
      const [t, b] = HELP[key] || [key, 'no notes yet'];
      if (cardT) cardT.textContent = t;
      if (cardB) cardB.textContent = b;
      if (cardEl) { cardEl.dataset.key = key; cardEl.hidden = false; }
      return;
    }
    if (e.target.closest('[data-card-x]')) { hideCard(); return; }
    if (!e.target.closest('[data-card]')) hideCard();
  });
  const zoomEl = root.querySelector('[data-zoom]');
  const syncZoom = () => {           // wheel/pinch/preset moved dist externally
    if (!zoomEl) return;
    const v = Math.round(tgt.dist);
    if (+zoomEl.value !== v) {
      zoomEl.value = v;
      const o = zoomEl.parentElement?.querySelector('output');
      if (o) o.textContent = v;
    }
  };

  // orientation gizmo — the same R = Rx(pitch)·Ry(yaw) the camera uses,
  // projected onto a corner axes chip (Blender/ParaView convention)
  const gizmo = root.querySelector('[data-gizmo]');
  const g2 = gizmo?.getContext('2d');
  const drawGizmo = () => {
    if (!g2) return;
    const S = gizmo.width, c = S / 2, r = S * 0.36;
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    const cx = Math.cos(cam.pitch), sx = Math.sin(cam.pitch);
    const rot = (x, y, z) => {       // v' = Rx(pitch) * Ry(yaw) * v
      const x1 = cy * x + sy * z, z1 = -sy * x + cy * z;
      return [x1, cx * y - sx * z1, sx * y + cx * z1];
    };
    g2.clearRect(0, 0, S, S);
    for (const [x, y, z, col] of [[1,0,0,'#ffb347'], [0,1,0,'#7fe'], [0,0,1,'#b78aff']]) {
      const [vx, vy, vz] = rot(x, y, z);
      g2.globalAlpha = 0.35 + 0.65 * (vz * 0.5 + 0.5);   // depth cue
      g2.strokeStyle = col; g2.lineWidth = S * 0.045; g2.lineCap = 'round';
      g2.beginPath(); g2.moveTo(c, c); g2.lineTo(c + vx * r, c - vy * r); g2.stroke();
      g2.fillStyle = col;
      g2.beginPath(); g2.arc(c + vx * r, c - vy * r, S * 0.055, 0, 7); g2.fill();
    }
    g2.globalAlpha = 1;
  };
  if (gizmo) {
    let lastTap = 0;
    const resetView = () => applyPreset('full');
    gizmo.addEventListener('dblclick', e => { e.preventDefault(); resetView(); });
    canvas.addEventListener('dblclick', e => {   // zoom-only reset
      tgt.dist = 68; syncZoom(); dirty = true;
    });
    gizmo.addEventListener('pointerdown', e => {   // double-tap for touch
      e.preventDefault(); e.stopPropagation();
      const t = performance.now();
      if (t - lastTap < 330) resetView();
      lastTap = t;
    });
  }
  bind('[data-uitoggle]', 'click', () => root.classList.toggle('dock-hidden'));

  // default scene: the spin vault (M50) — runs through the same code
  // path as a menu pick so every flag/widget ends in the measured state
  SCENES.ember(); ui.scene = 'ember';
  upload(); dirty = true;

  // quick-view presets: smooth-lerp camera + slice plane jump. Each
  // preset chooses the slab axis its name implies — 'side' is a real
  // vertical cut, 'bore' a top-down xz slab, 'equator' a horizontal one.
  const PRESETS = {
    full:    { yaw: 0.7,  pitch: 0.45, dist: 68,  ax: 2, cut: D3 >> 1, slab: D3 },
    equator: { yaw: 0.7,  pitch: 0.18, dist: 50,  ax: 2, cut: D3 >> 1, slab: 4 },
    bore:    { yaw: 0.0,  pitch: 1.5,  dist: 55,  ax: 1, cut: H3 >> 1, slab: 8 },
    lattice: { yaw: 0.7,  pitch: 0.6,  dist: 65,  ax: 2, cut: D3 >> 1, slab: 1 },
    side:    { yaw: -1.5, pitch: 0.2,  dist: 60,  ax: 0, cut: W3 >> 1, slab: 4 },
    core:    { yaw: 0.9,  pitch: 0.9,  dist: 35,  ax: 2, cut: D3 >> 1, slab: 8 },
    // looking straight down the (1,1,1) body diagonal — FCC's close-packed
    // planes face the camera and the honeycomb layering shows face-on.
    // yaw=-pi/4, pitch=asin(1/sqrt(3)) puts the camera exactly on the ray
    hex:     { yaw: -0.7854, pitch: 0.6155, dist: 70, ax: 2, cut: D3 >> 1, slab: D3 },
  };
  const applyPreset = (name) => {
    const p = PRESETS[name];
    if (!p) return;
    Object.assign(tgt, { yaw: p.yaw, pitch: p.pitch, dist: p.dist, cx: cenX, cy: cenY, cz: cenZ });
    ui.sAxis = p.ax; ui.sCut = p.cut; ui.sSlab = p.slab;
    const axSel = root.querySelector('[data-axis]');
    if (axSel) axSel.value = String(p.ax);
    syncSliceUI();
    poke(); dirty = true;
  };
  for (const el of root.querySelectorAll('[data-preset]')) {
    if (el.tagName === 'SELECT')
      el.addEventListener('change', () => applyPreset(el.value));
    else
      el.addEventListener('click', () => applyPreset(el.dataset.preset));
  }

  const resize = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = canvas.clientWidth * dpr | 0, h = canvas.clientHeight * dpr | 0;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; ensureHDR(w, h); dirty = true; }
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // ---------- main loop ----------
  upload();
  let raf = 0, lastT = performance.now(), fps = 0, lastDraw = 0;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = now - lastT; lastT = now;
    fps = fps * 0.95 + (1000 / Math.max(1, dt)) * 0.05;

    // adaptive safe-fail: coarsen only when the *render* is the
    // bottleneck. Physics eats up to ui.budget ms of every frame, so raw
    // fps can't tell GPU load from CPU load — a slow tick (e.g. another
    // process hogging the CPU) would falsely coarsen, and the fps>50
    // refine gate could never fire while playing. Measure the residual
    // frame cost instead; refine when the render is cheap or the frame
    // is vsync-bound with headroom.
    const renderMs = Math.max(1, dt - lastSpent);
    if (now - bootT < 4000) { lowT = null; highT = null; }
    else if (renderMs > 30) {
      lowT = lowT || now; highT = null;
      if (now - lowT > 2500 && rStep < 4) { rStep *= 2; lowT = null; dirty = true; }
    } else {
      lowT = null;
      if ((renderMs < 14 || fps > 55) && rStep > 1) {
        highT = highT || now;
        if (now - highT > 4000) { rStep = Math.max(1, rStep / 2); highT = null; dirty = true; }
      } else highT = null;
    }

    // auto-turntable: resume after 4 s of pointer inactivity
    if (ui.turntable && now - lastInteract > 4000) { tgt.yaw += 0.0014; dirty = true; }

    // smooth camera lerp toward preset/manual targets
    if (cam.yaw !== tgt.yaw || cam.pitch !== tgt.pitch || cam.dist !== tgt.dist
        || cam.cx !== tgt.cx || cam.cy !== tgt.cy || cam.cz !== tgt.cz) {
      const k = Math.min(1, dt * 0.012);
      cam.yaw += (tgt.yaw - cam.yaw) * k;
      cam.pitch += (tgt.pitch - cam.pitch) * k;
      cam.dist += (tgt.dist - cam.dist) * k;
      cam.cx += (tgt.cx - cam.cx) * k;
      cam.cy += (tgt.cy - cam.cy) * k;
      cam.cz += (tgt.cz - cam.cz) * k;
      dirty = true;
    }

    if (ui.playing) {
      // ticks-per-second governor over the adaptive physics budget:
      // c=1 is the speed of light here — uncapped, the lattice outruns
      // the eye. budget still bounds per-frame CPU for slow devices.
      ui.tickDebt = Math.min(ui.tickDebt + dt, 2000);
      const quantum = 1000 / ui.tps;
      let spent = 0;
      while (ui.tickDebt >= quantum && spent < ui.budget) {
        const t0 = performance.now();
        if (ui.drive || ui.beam) inject();
        wasm._meso3i_drain_edge(3);
        wasm._meso3i_tick();
        const ms = performance.now() - t0;
        spent += ms;
        ui.tick++;
        ui.tickDebt -= quantum;
        ui.tickMs = ui.tickMs * 0.9 + ms * 0.1;
        if (ui.tickMs > ui.budget) break; // single tick already over budget
      }
      lastSpent = spent;   // render-cost estimator reads this next frame
      if (spent > 0) { upload(); dirty = true; }
    } else lastSpent = 0;

    resize();
    // draw-rate cap ~30fps: the field only changes on ticks (≤20tps),
    // so rendering at vsync just burns GPU redrawing the same frame.
    // dirty stays set until a draw actually happens — no frame is lost
    if (dirty && now - lastDraw >= 30) {
      lastDraw = now;
      const view = m4.mul(m4.translate(0, 0, -cam.dist),
        m4.mul(m4.rotX(cam.pitch), m4.mul(m4.rotY(cam.yaw),
          m4.translate(-cam.cx, -cam.cy, -cam.cz))));
      if (hdrOK) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.clearColor(0, 0, 0, 0);          // transparent: bg tint lives in the tonemap
      } else {
        gl.clearColor(0.02, 0.02, 0.05, 1);
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniform1f(U.u_size, ui.size);
      gl.uniform1f(U.u_s_center, ui.sCut);
      gl.uniform1f(U.u_s_thick, ui.sSlab);
      gl.uniform1i(U.u_s_axis, ui.sAxis);
      gl.uniform1f(U.u_ghost_alpha, ui.ghostAlpha);
      gl.uniform1f(U.u_qmin, ui.qmin);
      // per-pane draw: scissored halves share the camera but carry their
      // own layout/mode — the same live field through two lenses
      const panes = PANES[ui.split];
      const nPanes = panes ? 2 : 1;
      const pwx = canvas.width / nPanes;
      if (nPanes > 1) gl.enable(gl.SCISSOR_TEST);
      const si = strideInfo();
      gl.uniform1i(U.u_nx, si.nx); gl.uniform1i(U.u_ny, si.ny);
      gl.uniform1i(U.u_nxy, si.nxy); gl.uniform1i(U.u_step, rStep);
      for (let i = 0; i < nPanes; i++) {
        const cfg = panes ? panes[i] : { layout: 0, mode: -1 };
        const vx = Math.round(i * pwx);
        const vw = Math.round((i + 1) * pwx) - vx;
        if (nPanes > 1) gl.scissor(vx, 0, vw, canvas.height);
        gl.viewport(vx, 0, vw, canvas.height);
        const pProj = m4.persp(0.9, vw / Math.max(1, canvas.height), 1, 600);
        gl.uniformMatrix4fv(U.u_mvp, false, m4.mul(pProj, view));
        gl.uniform1i(U.u_colorMode, cfg.mode < 0 ? ui.colorMode : cfg.mode);
        gl.uniform1i(U.u_layout, cfg.layout);
        gl.uniform3f(U.u_packoff, PACKOFF[0], PACKOFF[1], PACKOFF[2]);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, si.count);
      }
      if (nPanes > 1) gl.disable(gl.SCISSOR_TEST);
      if (hdrOK) {
        // resolve: tonemap the accumulated HDR buffer onto the canvas
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.useProgram(tmProg);
        gl.bindVertexArray(tmVao);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, hdrTex);
        gl.uniform1i(tmU.u_hdr, 0);
        gl.uniform1f(tmU.u_exposure, ui.exposure);
        gl.disable(gl.DEPTH_TEST);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.enable(gl.DEPTH_TEST);
        gl.useProgram(prog);
        gl.bindVertexArray(vao);
        gl.bindTexture(gl.TEXTURE_3D, tex);
      }
      syncZoom();
      drawGizmo(); drawLens();
      dirty = false;
    }
    if (hud && (ui.tick < 10 || ui.tick % 10 === 0 || !ui.playing)) {
      // meso3i telemetry: parked rest mass, moving flux, rest centroid.
      // Stats refresh inside rg_refresh during upload — no extra sweep.
      pushHist();
      const rest = wasm._meso3i_rest_mass(), mov = wasm._meso3i_mov_mass();
      const phn = wasm._meso3i_photons();
      const cx = wasm._meso3i_cm(0) / 256, cy = wasm._meso3i_cm(1) / 256, cz = wasm._meso3i_cm(2) / 256;
      const cm = rest > 0 ? `core@(${cx.toFixed(1)},${cy.toFixed(1)},${cz.toFixed(1)})` : 'no lump';
      const ph = phn > 0 ? ` · γ=${phn.toLocaleString()}` : '';
      hud.textContent = `t${ui.tick} · rest=${rest.toLocaleString()} · flux=${mov.toLocaleString()}${ph} · ${cm} · ${fps.toFixed(0)}fps · ${ui.tickMs.toFixed(1)}ms/t`;
    }
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    document.removeEventListener('visibilitychange', keepAwake);
    wakeLock?.release().catch(() => {});
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}
