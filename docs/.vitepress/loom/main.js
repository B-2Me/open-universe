/*
 * Hopf's Loom — WebGL2 3D viewer for the True FCC (A-B-C) lattice.
 *
 * Pipeline: planck3.wasm flat engine -> planck3_rg_refresh() packs {q,s}
 * into an RG8 buffer -> gl.texSubImage3D uploads wasm memory straight to
 * the GPU (no JS copies) -> one drawArraysInstanced call renders 400k
 * billboard quads; the vertex shader culls vacuum, ghosts nodes outside
 * the tomographic slab, and applies the substrate embedding.
 *
 * Geometry note (honest embedding): the substrate is stacked-hex with
 * parity-free ports — the ABC stagger lives in the port offsets, not in
 * layer origins — so the faithful embedding is the hex plane
 * (x + 0.5·(y&1), y·√3/2) with z scaled by √(2/3)≈0.816.
 */

const W3 = 100, H3 = 100, D3 = 40, N3 = W3 * H3 * D3;

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
uniform sampler3D u_vol;                  // RG8: r=quanta g=spin
uniform mat4 u_mvp;
uniform float u_size;                     // world-space quad half-size
uniform float u_z_center, u_z_thickness;  // tomographic slab (cell z)
uniform float u_ghost_alpha;              // opacity outside the slab
uniform float u_zscale;                   // 0.816
uniform float u_qmin;                     // density floor to render
uniform int u_colorMode;                  // 0=density 1=spin-class
out vec4 v_color;
out vec2 v_uv;
void main() {
  int id = gl_InstanceID;
  int x = id % 100;
  int y = (id / 100) % 100;
  int z = id / 10000;
  vec2 rg = texelFetch(u_vol, ivec3(x, y, z), 0).rg;
  float q = rg.r * 255.0;
  float s = rg.g * 255.0;
  v_uv = a_corner;
  if (q < u_qmin) {                       // vacuum: clip entirely
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0); v_color = vec4(0.0); return;
  }
  // slab ghosting: inside half-thickness -> opaque, outside -> silhouette
  float halfT = u_z_thickness * 0.5;
  float alpha = abs(float(z) - u_z_center) <= halfT ? 1.0 : u_ghost_alpha;
  // hex-plane embed + z compress (true-FCC layer spacing ~0.816)
  vec3 p = vec3(float(x) + 0.5 * float(y & 1), float(y) * 0.8660254,
                float(z) * u_zscale);
  p -= vec3(50.0, 43.3, 16.3);            // lattice centroid
  vec4 mv = u_mvp * vec4(p, 1.0);
  float ps = u_size * (0.6 + 1.6 * q / 255.0);
  mv.xy += a_corner * ps;                 // billboard in view space
  gl_Position = mv;
  float d = q / 255.0;
  vec3 rgb;
  if (u_colorMode == 1) {
    // spin class: 1-6 equatorial (toroidal, warm), 7-9 zenith (poloidal
    // up, cyan), 10-12 nadir (poloidal down, violet)
    rgb = s == 0.0 ? vec3(0.15) * d
      : s <= 6.0 ? vec3(1.0, 0.35 + 0.4 * d, 0.1) * (0.4 + 0.8 * d)
      : s <= 9.0 ? vec3(0.1, 0.8, 1.0) * (0.4 + 0.8 * d)
      :            vec3(0.6, 0.3, 1.0) * (0.4 + 0.8 * d);
  } else if (u_colorMode == 2) {
    // metabolism: G carries scene-normalized heat (thermal-camera style,
    // planck3_rg_refresh mode 1) across a wide blackbody spectrum:
    // dying ember -> deep red -> orange -> amber -> white-hot
    float h = pow(s / 255.0, 0.75);
    vec3 c0 = vec3(0.06, 0.00, 0.00);  // near-black, heat death
    vec3 c1 = vec3(0.42, 0.04, 0.00);  // deep red
    vec3 c2 = vec3(0.82, 0.20, 0.00);  // red-orange
    vec3 c3 = vec3(1.00, 0.48, 0.00);  // orange
    vec3 c4 = vec3(1.00, 0.72, 0.10);  // amber
    vec3 c5 = vec3(1.00, 0.95, 0.80);  // white-hot
    rgb = (h < 0.20 ? mix(c0, c1, h * 5.0)
        :  h < 0.40 ? mix(c1, c2, (h - 0.20) * 5.0)
        :  h < 0.60 ? mix(c2, c3, (h - 0.40) * 5.0)
        :  h < 0.78 ? mix(c3, c4, (h - 0.60) * 5.56)
        :             mix(c4, c5, (h - 0.78) * 4.55)) * (0.35 + 0.85 * d);
  } else {
    // density: indigo depths -> cyan body -> white crest
    float dd = pow(d, 0.8);
    rgb = dd < 0.5 ? mix(vec3(0.03, 0.06, 0.30), vec3(0.10, 0.65, 1.00), dd * 2.0)
                   : mix(vec3(0.10, 0.65, 1.00), vec3(0.95, 1.00, 0.95), (dd - 0.5) * 2.0);
  }
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
  const wasmUrl = opts.wasmUrl || '/wasm/loom/planck3.js';
  const stateUrl = opts.stateUrl || '/loom/hopfion.p3st';
  const canvas = root.querySelector('canvas');
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
  const hud = root.querySelector('[data-hud]');
  if (!gl) { hud.textContent = 'WebGL2 unavailable'; return () => {}; }

  // ---------- wasm ----------
  if (hud) hud.textContent = 'loading engine…';
  if (typeof createPlanck3 === 'undefined')
    await new Promise((res, rej) => {
      const sc = document.createElement('script');
      sc.src = wasmUrl; sc.onload = res;
      sc.onerror = () => rej(new Error('planck3.js load failed: ' + wasmUrl));
      document.head.appendChild(sc);
    });
  if (hud) hud.textContent = 'instantiating wasm…';
  const wasm = await createPlanck3();
  wasm._planck3_init();
  wasm._planck3_set_mode(0); // flat — canonical deterministic baseline
  const heap = wasm.HEAPU8 || new Uint8Array(wasm.wasmMemory.buffer);

  const loadState = async (url) => {
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    if (bytes.length !== 16 + N3 * 6) throw new Error(`state size ${bytes.length} (${url})`);
    heap.set(bytes, wasm._planck3_load_pointer());
    const rc = wasm._planck3_load_commit();
    if (rc !== 0) throw new Error(`planck3_load_commit rc=${rc}`);
  };
  if (hud) hud.textContent = 'loading state…';
  await loadState(stateUrl);
  if (hud) hud.textContent = 'state loaded';

  // Inject an 8^3 saturated knot centred on a lattice cell.
  const injectKnot = (lx = 44, ly = 44, lz = 20) => {
    for (let z = lz - 4; z < lz + 4; z++)
      for (let y = ly - 4; y < ly + 4; y++)
        for (let x = lx - 4; x < lx + 4; x++) {
          if (x < 0 || x >= W3 || y < 0 || y >= H3 || z < 0 || z >= D3) continue;
          wasm._planck3_set_node((z * H3 + y) * W3 + x, 255, 1, 3000, 0, 0);
        }
  };

  // Camera ray through a canvas pixel -> lattice cell on the current
  // slice plane. Camera orbits the origin at (yaw, pitch, dist); the
  // lattice embeds at (x + 0.5*(y&1), y*0.866, z*0.816) minus centroid.
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
    // camera world position = Ry(-yaw)*Rx(-pitch)*(0,0,dist)
    const c1 = { x: 0, y: cam.dist * sph, z: cam.dist * cph };
    const cW = { x: -c1.z * syw, y: c1.y, z: c1.z * cyw };
    // slice plane: world z = zCenter*0.816 - 16.3
    const pz = ui.zCenter * 0.816 - 16.3;
    if (Math.abs(dW.z) < 1e-3) return null;  // edge-on: plane never hit
    const t = (pz - cW.z) / dW.z;
    if (t <= 0) return null;
    const wx = cW.x + t * dW.x, wy = cW.y + t * dW.y;
    const ly = Math.round((wy + 43.3) / 0.8660254);
    const lx = Math.round(wx + 50 - 0.5 * (ly & 1));
    return { lx, ly, lz: ui.zCenter };
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
    'u_ghost_alpha', 'u_zscale', 'u_qmin', 'u_colorMode'])
    U[n] = gl.getUniformLocation(prog, n);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, tex);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.RG8, W3, H3, D3, 0, gl.RG, gl.UNSIGNED_BYTE, null);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
    [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE]])
    gl.texParameteri(gl.TEXTURE_3D, k, v);
  gl.uniform1i(U.u_vol, 0);
  gl.activeTexture(gl.TEXTURE0);
  const rgPtr = wasm._planck3_rg_pointer();
  const upload = () => {
    wasm._planck3_rg_refresh(ui.colorMode === 2 ? 1 : 0);
    // re-fetch the heap view each frame — ALLOW_MEMORY_GROWTH can detach it
    const h8 = wasm.HEAPU8 || new Uint8Array(wasm.wasmMemory.buffer);
    gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, 0, W3, H3, D3, gl.RG, gl.UNSIGNED_BYTE,
      h8.subarray(rgPtr, rgPtr + N3 * 2));
  };

  // iOS Safari kills GPU contexts aggressively — signal + let the page
  // re-init on restore rather than freeze on a black canvas.
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    if (hud) hud.textContent = 'GPU context lost — restarting…';
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
  const cam = { yaw: 0.7, pitch: 0.45, dist: 95 };
  const tgt = { ...cam };                 // preset targets (smooth lerp)
  // lastInteract in the past → turntable spins from the first frame
  let dirty = true, lastInteract = -1e4;
  const ptrs = new Map();
  let lastPinch = 0, pinchRest = false;
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
    }
  });
  const endPtr = e => {
    ptrs.delete(e.pointerId); lastPinch = 0;
    if (ptrs.size === 1) pinchRest = true;   // a pinch just collapsed
    else pinchRest = false;
    // armed knot tool: a click (not a drag) places a knot on the slice plane
    if (ui.knotArm && downPos && ptrs.size === 0) {
      const moved = Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]);
      if (moved < 8) {
        const cell = pickCell(e.clientX, e.clientY);
        if (cell) {
          injectKnot(cell.lx, cell.ly, cell.lz);
          upload(); dirty = true;
        } else if (hud) hud.textContent = 'edge-on view — pick while the slice plane is facing you';
        setKnotArm(false);
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
    playing: true, tickMs: 80, budget: 12, tick: 0,
    zCenter: 20, zThick: 40, ghostAlpha: 0.06,
    qmin: 1, size: 0.55, colorMode: 2, zscale: 0.816,
    turntable: !matchMedia('(prefers-reduced-motion: reduce)').matches,
    knotArm: false,
  };
  const spinBtn = root.querySelector('[data-spin]');
  if (spinBtn && !ui.turntable) { spinBtn.classList.remove('on'); spinBtn.setAttribute('aria-pressed', 'false'); }
  const bind = (sel, ev, fn) => { const el = root.querySelector(sel); if (el) el.addEventListener(ev, fn); return el; };
  bind('[data-play]', 'click', e => { ui.playing = !ui.playing; e.target.textContent = ui.playing ? '⏸' : '▶'; });
  bind('[data-step]', 'click', () => { wasm._planck3_tick(); ui.tick++; upload(); dirty = true; });
  bind('[data-reset]', 'click', async () => { await loadState(stateUrl); ui.tick = 0; upload(); dirty = true; });
  const knotBtn = root.querySelector('[data-knot]');
  const setKnotArm = (on) => {
    ui.knotArm = on;
    canvas.style.cursor = on ? 'crosshair' : '';
    if (knotBtn) { knotBtn.classList.toggle('on', on); knotBtn.setAttribute('aria-pressed', String(on)); }
    if (hud && on) hud.textContent = 'knot tool armed — click the lattice to place';
  };
  bind('[data-knot]', 'click', () => setKnotArm(!ui.knotArm));
  bind('[data-snap]', 'click', () => { wasm._planck3_save(); const b = root.querySelector('[data-unsnap]'); if (b) b.disabled = false; if (hud) hud.textContent = 'snapshot saved'; });
  bind('[data-unsnap]', 'click', () => { if (wasm._planck3_restore() === 0) { upload(); dirty = true; } });
  bind('[data-diss]', 'input', e => { wasm._planck3_set_dissipation(+e.target.value); readout(e); });
  bind('[data-therm]', 'input', e => {
    wasm._planck3_set_thermal_limit(+e.target.value * 1000);
    const o = e.target.parentElement?.querySelector('output');
    if (o) o.value = e.target.value + 'k';
  });
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
  bind('[data-colormode]', 'change', e => { ui.colorMode = +e.target.value; dirty = true; });
  bind('[data-zoom]', 'input', e => { tgt.dist = +e.target.value; readout(e); poke(); dirty = true; });
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
    full:    { yaw: 0.7,  pitch: 0.45, dist: 95,  zCenter: 20, zThick: 40 },
    equator: { yaw: 0.7,  pitch: 0.18, dist: 95,  zCenter: 20, zThick: 4 },
    bore:    { yaw: 0.0,  pitch: 1.5,  dist: 95,  zCenter: 20, zThick: 40 },
    lattice: { yaw: 0.7,  pitch: 0.6,  dist: 95,  zCenter: 20, zThick: 1 },
    side:    { yaw: 0.7,  pitch: 0.05, dist: 105, zCenter: 20, zThick: 40 },
    core:    { yaw: 0.9,  pitch: 0.9,  dist: 55,  zCenter: 20, zThick: 8 },
  };
  const setRange = (sel, v) => {
    const el = root.querySelector(sel);
    if (el) { el.value = v; el.dispatchEvent(new Event('input')); }
  };
  const applyPreset = (name) => {
    const p = PRESETS[name];
    if (!p) return;
    Object.assign(tgt, { yaw: p.yaw, pitch: p.pitch, dist: p.dist });
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

    // auto-turntable: resume after 4 s of pointer inactivity
    if (ui.turntable && now - lastInteract > 4000) { tgt.yaw += 0.0014; dirty = true; }

    // smooth camera lerp toward preset/manual targets
    if (cam.yaw !== tgt.yaw || cam.pitch !== tgt.pitch || cam.dist !== tgt.dist) {
      const k = Math.min(1, dt * 0.012);
      cam.yaw += (tgt.yaw - cam.yaw) * k;
      cam.pitch += (tgt.pitch - cam.pitch) * k;
      cam.dist += (tgt.dist - cam.dist) * k;
      dirty = true;
    }

    if (ui.playing) {
      // adaptive physics budget: run ticks until ~budget ms per frame
      let spent = 0;
      while (spent < ui.budget) {
        const t0 = performance.now();
        wasm._planck3_tick();
        const ms = performance.now() - t0;
        spent += ms;
        ui.tick++;
        ui.tickMs = ui.tickMs * 0.9 + ms * 0.1;
        if (ui.tickMs > ui.budget) break; // single tick already over budget
      }
      upload(); dirty = true;
    }

    resize();
    if (dirty) {
      const proj = m4.persp(0.9, canvas.width / Math.max(1, canvas.height), 1, 600);
      const view = m4.mul(m4.translate(0, 0, -cam.dist), m4.mul(m4.rotX(cam.pitch), m4.rotY(cam.yaw)));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.02, 0.02, 0.05, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(U.u_mvp, false, m4.mul(proj, view));
      gl.uniform1f(U.u_size, ui.size);
      gl.uniform1f(U.u_z_center, ui.zCenter);
      gl.uniform1f(U.u_z_thickness, ui.zThick);
      gl.uniform1f(U.u_ghost_alpha, ui.ghostAlpha);
      gl.uniform1f(U.u_zscale, ui.zscale);
      gl.uniform1f(U.u_qmin, ui.qmin);
      gl.uniform1i(U.u_colorMode, ui.colorMode);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, N3);
      syncZoom();
      drawGizmo();
      dirty = false;
    }
    if (hud && (ui.tick < 10 || ui.tick % 10 === 0 || !ui.playing)) {
      hud.textContent = `q=${wasm._planck3_total_quanta().toLocaleString()} / ${N3.toLocaleString()} · t${ui.tick} · ${fps.toFixed(0)}fps · ${ui.tickMs.toFixed(0)}ms/t · knots=${wasm._planck3_deadlocked()}`;
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
