/*
 * Hopf's Loom — WebGL2 3D viewer, loom-meso branch.
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
uniform sampler3D u_vol;                  // RGB8: r=moving g=rest b=photons
uniform mat4 u_mvp;
uniform float u_size;                     // world-space quad half-size
uniform float u_z_center, u_z_thickness;  // tomographic slab (cell z)
uniform float u_ghost_alpha;              // opacity outside the slab
uniform float u_qmin;                     // density floor to render
uniform int u_colorMode;                  // 0=ember 1=heat 2=flux 3=macro
out vec4 v_color;
out vec2 v_uv;
uniform int u_nx, u_ny, u_nxy, u_step;   // strided grid decode
void main() {
  int id = gl_InstanceID;
  int x = (id % u_nx) * u_step;
  int y = ((id / u_nx) % u_ny) * u_step;
  int z = (id / u_nxy) * u_step;
  vec3 rg = texelFetch(u_vol, ivec3(x, y, z), 0).rgb;
  float mov = rg.r * 255.0;
  float rest = rg.g * 255.0;
  float ph = rg.b * 255.0;
  float d = max(mov, max(rest, ph));
  v_uv = a_corner;
  if (d < u_qmin) {                       // vacuum + dead parity: clip
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0); v_color = vec4(0.0); return;
  }
  // slab ghosting: inside half-thickness -> opaque, outside -> silhouette
  float halfT = u_z_thickness * 0.5;
  float alpha = abs(float(z) - u_z_center) <= halfT ? 1.0 : u_ghost_alpha;
  // cubic embed: even-parity FCC sublattice carries its geometry in the
  // channel vectors, so raw grid coords are the honest picture
  vec3 p = vec3(float(x), float(y), float(z));
  vec4 mv = u_mvp * vec4(p, 1.0);
  float ps = u_size * (0.8 + 2.0 * d / 255.0);
  mv.xy += a_corner * ps;                 // billboard in view space
  gl_Position = mv;
  vec3 rgb;
  // blackbody ramp for parked heat (the ember): red->orange->amber->white
  float h = pow(rest / 255.0, 0.75);
  vec3 ember = (h < 0.20 ? mix(vec3(0.06,0.00,0.00), vec3(0.42,0.04,0.00), h * 5.0)
      :  h < 0.40 ? mix(vec3(0.42,0.04,0.00), vec3(0.82,0.20,0.00), (h - 0.20) * 5.0)
      :  h < 0.60 ? mix(vec3(0.82,0.20,0.00), vec3(1.00,0.48,0.00), (h - 0.40) * 5.0)
      :  h < 0.78 ? mix(vec3(1.00,0.48,0.00), vec3(1.00,0.72,0.10), (h - 0.60) * 5.56)
      :             mix(vec3(1.00,0.72,0.10), vec3(1.00,0.95,0.80), (h - 0.78) * 4.55));
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
  // visibility floor: real occupancies run ~5-120, far below the 255
  // normalization — a sparse dim ember must still read against the void
  rgb = rgb * 1.8 + vec3(0.028);
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
  frag = vec4(v_color.rgb * v_color.a * a, 1.0);
}`;

export async function initLoomSimulator(root, opts = {}) {
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
  // CCW tangent in the slice plane (z=0 face-diagonals only). planck3
  // could store a persistent spin direction per node; meso3i's rest bin
  // can't, so injected circulation either self-sustains or thermalizes —
  // M38 measured ~25 ticks at 44^3. This is the loom-scale retest.
  const RING_Q = 48;
  const tangChannel = (dx, dy) => {
    const l = Math.hypot(dx, dy) || 1;
    const tx = -dy / l, ty = dx / l;           // CCW tangent
    let best = -1, bd = -Infinity;
    for (let c = 0; c < NMOV; c++) {
      if (CV[c][2] !== 0) continue;            // equatorial channels only
      const dot = CV[c][0] * tx + CV[c][1] * ty;
      if (dot > bd) { bd = dot; best = c; }
    }
    return best;
  };
  const injectRing = (lx = CX, ly = CY, lz = CZ) => {
    let n = 0;
    for (const r of [5, 4]) {                  // two concentric rings
      const steps = Math.ceil(2 * Math.PI * r) + 1;
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * 2 * Math.PI;
        const x = Math.round(lx + r * Math.cos(a));
        const y = Math.round(ly + r * Math.sin(a));
        if (x < 0 || x >= W3 || y < 0 || y >= H3 || lz < 0 || lz >= D3) continue;
        if (((x + y + lz) & 1) !== 0) continue;  // live parity only
        const c = tangChannel(x - lx, y - ly);
        if (c < 0) continue;
        const cur = wasm._meso3i_get(x, y, lz, c);
        wasm._meso3i_set(x, y, lz, c, Math.min(255, cur + RING_Q));
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

  // Camera ray through a canvas pixel -> lattice cell on the current
  // slice plane. Camera orbits the lattice center at (yaw, pitch, dist);
  // world coords ARE grid coords under the cubic embedding.
  const pickCell = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    const nx = ((cx - r.left) / r.width) * 2 - 1;
    const ny = 1 - ((cy - r.top) / r.height) * 2;
    const asp = canvas.width / Math.max(1, canvas.height);
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
    const pz = ui.zCenter;
    if (Math.abs(dW.z) < 1e-3) return null;  // edge-on: plane never hit
    const t = (pz - cW.z) / dW.z;
    if (t <= 0) return null;
    return {
      lx: Math.round(cW.x + t * dW.x),
      ly: Math.round(cW.y + t * dW.y),
      lz: Math.round(ui.zCenter),
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

  const U = {};
  for (const n of ['u_mvp', 'u_vol', 'u_size', 'u_z_center', 'u_z_thickness',
    'u_ghost_alpha', 'u_qmin', 'u_colorMode',
    'u_nx', 'u_ny', 'u_nxy', 'u_step'])
    U[n] = gl.getUniformLocation(prog, n);

  // Hardware safe-fail: the whole lattice lives in one RG8 3D texture.
  const maxTex = gl.getParameter(gl.MAX_3D_TEXTURE_SIZE);
  if (Math.max(W3, H3, D3) > maxTex) {
    hud.textContent = `grid ${W3}x${H3}x${D3} exceeds GL 3D texture limit (${maxTex})`;
    return () => {};
  }
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, tex);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB8, W3, H3, D3, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
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
    gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, 0, W3, H3, D3, gl.RGB, gl.UNSIGNED_BYTE,
      h8.subarray(rgPtr, rgPtr + N3 * 3));
  };

  // iOS Safari kills GPU contexts aggressively — signal + let the page
  // re-init on restore rather than freeze on a black canvas.
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    say('GPU context lost — restarting…', 5000);
  });
  canvas.addEventListener('webglcontextrestored', () => {
    root.dispatchEvent(new CustomEvent('loom:reinit'));
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
  const cam = { yaw: 0.7, pitch: 0.45, dist: 95, cx: cenX, cy: cenY, cz: cenZ };
  const tgt = { ...cam };                 // preset targets (smooth lerp)
  // lastInteract in the past → turntable spins from the first frame
  let dirty = true, lastInteract = -1e4;
  const ptrs = new Map();
  let lastPinch = 0, lastMid = null, pinchRest = false;
  canvas.style.touchAction = 'none';
  const poke = () => { lastInteract = performance.now(); };
  let downPos = null;
  canvas.addEventListener('pointerdown', e => {
    poke();
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    downPos = [e.clientX, e.clientY];
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
      tgt.yaw += (e.clientX - prev[0]) * 0.008;
      tgt.pitch = Math.max(-1.5, Math.min(1.5, tgt.pitch + (e.clientY - prev[1]) * 0.008));
      dirty = true;
    } else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (lastPinch) { tgt.dist = Math.max(20, Math.min(300, tgt.dist * lastPinch / d)); dirty = true; }
      lastPinch = d;
      // two-finger pan: drag the look-at center along the camera's
      // right/up axes (content follows the fingers)
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (lastMid) {
        const dx = mid[0] - lastMid[0], dy = mid[1] - lastMid[1];
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
      }
      lastMid = mid;
    }
  });
  const endPtr = e => {
    ptrs.delete(e.pointerId); lastPinch = 0; lastMid = null;
    if (ptrs.size === 1) pinchRest = true;   // a pinch just collapsed
    else pinchRest = false;
    // armed placement tool: a click (not a drag) drops the armed
    // payload on the slice plane; the tool stays armed — tap its
    // button again to disarm
    if (ui.arm && downPos && ptrs.size === 0) {
      const moved = Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]);
      if (moved < 8) {
        const cell = pickCell(e.clientX, e.clientY);
        if (cell) {
          const n = ui.arm === 'ring'
            ? injectRing(cell.lx, cell.ly, cell.lz)
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
  canvas.addEventListener('wheel', e => {
    e.preventDefault(); poke();
    tgt.dist = Math.max(20, Math.min(300, tgt.dist * (1 + e.deltaY * 0.001)));
    dirty = true;
  }, { passive: false });

  // ---------- state / UI ----------
  const ui = {
    playing: true, tickMs: 0, budget: 12, tick: 0, tps: 20, tickDebt: 0,
    zCenter: D3 >> 1, zThick: D3, ghostAlpha: 0.06,
    qmin: 1, size: 0.55, colorMode: 0,
    turntable: !matchMedia('(prefers-reduced-motion: reduce)').matches,
    drive: false, beam: false, arm: null,      // arm: 'ring' | 'lump'
    phot: 2, pair: false, drest: 0,
    bdir: '+x', bap: 4, bou: 0, bov: 0,            // laser: dir/aperture/offsets
  };
  // boot state: a cold lump at center — parked heat, inert in vacuum
  // until the user turns on a drive or a beam
  seedLump(CX, CY, CZ);
  // sync tuning-slider bounds with the engine's actual depth
  for (const [sel, max, val] of [['[data-zcenter]', D3 - 1, D3 >> 1], ['[data-zthick]', D3, D3]]) {
    const el = root.querySelector(sel);
    if (el) { el.max = max; el.value = val;
      const o = el.parentElement?.querySelector('output'); if (o) o.value = val; }
  }
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
  bind('[data-play]', 'click', e => { ui.playing = !ui.playing; e.target.textContent = ui.playing ? '⏸' : '▶'; });
  bind('[data-step]', 'click', () => {
    if (ui.drive || ui.beam) inject();
    wasm._meso3i_drain_edge(3);
    wasm._meso3i_tick();
    ui.tick++; upload(); dirty = true;
  });
  bind('[data-reset]', 'click', () => {
    wasm._meso3i_clear(); ui.tick = 0;
    seedLump(CX, CY, CZ);
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
    // the equator — inside mutual-ablation reach. Radiation needs
    // carriers (☀) or blackbody (Rad can't go positive from this UI).
    const a = seedBall(CX - 6, CY, CZ, 3, 64);
    const b = seedBall(CX + 6, CY, CZ, 3, 64);
    upload(); dirty = true;
    say(`M37 pair dropped — ${a + b} sites parked · mutual ablation needs carriers: turn ☀ on`, 6000);
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
  const SCENES = {
    wound: () => {
      ctl('[data-coll]', '1', 'change');
      ctl('[data-lat]', 16);
      press('[data-pair]', 'pair', true);
      press('[data-beam]', 'beam', false);
      press('[data-drive]', 'drive', true);
      wasm._meso3i_clear(); seedLump(CX, CY, CZ);
      say('wound lump — Lat 16 + ⇄ + ☀: sporadic flux can\'t unwind; bound rest may grow where collision traffic persists', 6000);
    },
    breath: () => {
      ctl('[data-coll]', '0', 'change');
      ctl('[data-lat]', 1);
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
      press('[data-pair]', 'pair', false);
      press('[data-drive]', 'drive', false);
      press('[data-beam]', 'beam', true);
      wasm._meso3i_clear(); seedLump(CX, CY, CZ);
      say('comet ablation — offset plane wave grazing a cold lump: watch the stimulated plume and core@ drift', 6000);
    },
  };
  bind('[data-scene]', 'change', e => {
    const f = SCENES[e.target.value];
    e.target.value = '';                    // back to "Scene…" so re-picks refire
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
    e.target.setAttribute('aria-pressed', String(ui.turntable));
    e.target.classList.toggle('on', ui.turntable);
    poke();
  });
  const readout = e => {
    const o = e.target.parentElement?.querySelector('output');
    if (o) o.value = e.target.value;
  };
  bind('[data-zcenter]', 'input', e => { ui.zCenter = +e.target.value; readout(e); dirty = true; });
  bind('[data-zthick]', 'input', e => { ui.zThick = +e.target.value; readout(e); dirty = true; });
  bind('[data-qmin]', 'input', e => { ui.qmin = +e.target.value; readout(e); dirty = true; });
  bind('[data-size]', 'input', e => { ui.size = +e.target.value / 100; readout(e); dirty = true; });
  bind('[data-speed]', 'input', e => { ui.tps = +e.target.value; readout(e); });
  bind('[data-colormode]', 'change', e => { ui.colorMode = +e.target.value; dirty = true; });
  bind('[data-zoom]', 'input', e => { tgt.dist = +e.target.value; readout(e); poke(); dirty = true; });
  bind('[data-tune]', 'click', e => {
    const dock = root.querySelector('.loom-dock');
    const open = dock?.classList.toggle('tune-open');
    e.currentTarget.setAttribute('aria-expanded', String(!!open));
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
    gizmo.addEventListener('pointerdown', e => {   // double-tap for touch
      e.preventDefault(); e.stopPropagation();
      const t = performance.now();
      if (t - lastTap < 330) resetView();
      lastTap = t;
    });
  }
  bind('[data-uitoggle]', 'click', () => root.classList.toggle('dock-hidden'));

  // quick-view presets: smooth-lerp camera + jump slice values
  const PRESETS = {
    full:    { yaw: 0.7,  pitch: 0.45, dist: 95,  zCenter: D3 >> 1, zThick: D3 },
    equator: { yaw: 0.7,  pitch: 0.18, dist: 95,  zCenter: D3 >> 1, zThick: 4 },
    bore:    { yaw: 0.0,  pitch: 1.5,  dist: 95,  zCenter: D3 >> 1, zThick: D3 },
    lattice: { yaw: 0.7,  pitch: 0.6,  dist: 95,  zCenter: D3 >> 1, zThick: 1 },
    side:    { yaw: 0.7,  pitch: 0.05, dist: 105, zCenter: D3 >> 1, zThick: D3 },
    core:    { yaw: 0.9,  pitch: 0.9,  dist: 45,  zCenter: D3 >> 1, zThick: 8 },
  };
  const setRange = (sel, v) => {
    const el = root.querySelector(sel);
    if (el) { el.value = v; el.dispatchEvent(new Event('input')); }
  };
  const applyPreset = (name) => {
    const p = PRESETS[name];
    if (!p) return;
    Object.assign(tgt, { yaw: p.yaw, pitch: p.pitch, dist: p.dist, cx: cenX, cy: cenY, cz: cenZ });
    ui.zCenter = p.zCenter; ui.zThick = p.zThick;
    setRange('[data-zcenter]', ui.zCenter); setRange('[data-zthick]', ui.zThick);
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
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; dirty = true; }
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // ---------- main loop ----------
  upload();
  let raf = 0, lastT = performance.now(), fps = 0;
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
    if (dirty) {
      const proj = m4.persp(0.9, canvas.width / Math.max(1, canvas.height), 1, 600);
      const view = m4.mul(m4.translate(0, 0, -cam.dist),
        m4.mul(m4.rotX(cam.pitch), m4.mul(m4.rotY(cam.yaw),
          m4.translate(-cam.cx, -cam.cy, -cam.cz))));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.02, 0.02, 0.05, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(U.u_mvp, false, m4.mul(proj, view));
      gl.uniform1f(U.u_size, ui.size);
      gl.uniform1f(U.u_z_center, ui.zCenter);
      gl.uniform1f(U.u_z_thickness, ui.zThick);
      gl.uniform1f(U.u_ghost_alpha, ui.ghostAlpha);
      gl.uniform1f(U.u_qmin, ui.qmin);
      gl.uniform1i(U.u_colorMode, ui.colorMode);
      const si = strideInfo();
      gl.uniform1i(U.u_nx, si.nx); gl.uniform1i(U.u_ny, si.ny);
      gl.uniform1i(U.u_nxy, si.nxy); gl.uniform1i(U.u_step, rStep);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, si.count);
      syncZoom();
      drawGizmo();
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
