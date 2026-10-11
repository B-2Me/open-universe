/*
 * RFC-050: WebGL2 3D viewer for the True FCC (A-B-C) lattice.
 *
 * Pipeline: planck3.wasm flat engine -> fcc_rg_refresh() packs {q,s}
 * into an RG8 buffer -> gl.texSubImage3D uploads wasm memory straight to
 * the GPU (no JS copies) -> one drawArraysInstanced call renders 400k
 * billboard quads; the vertex shader culls vacuum and applies the
 * tomographic z-slice uniforms.
 *
 * Geometry note (honest embedding): our substrate is stacked-hex with
 * parity-free ports — the ABC stagger lives in the port offsets, not in
 * layer origins — so the faithful embedding is the hex plane
 * (x + 0.5·(y&1), y·√3/2) with z scaled by √(2/3)≈0.816 per RFC-§2. A
 * literal z%3 layer shift would misrepresent the connectivity.
 */

const W3 = 100, H3 = 100, D3 = 40, N3 = W3 * H3 * D3;

// ---------- minimal mat4 (column-major, OpenGL order) ----------
const m4 = {
  ident: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
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
uniform vec4 u_mvp_raw_unused;            // (padding for driver quirks)
uniform vec2 u_viewport;
uniform float u_size;                     // world-space quad half-size
uniform float u_zmin, u_zmax;             // tomographic slice (cell z)
uniform float u_zscale;                   // 0.816
uniform float u_qmin;                     // density floor to render
uniform int u_colorMode;                  // 0=density 1=spin-class 2=heatless
out vec3 v_color;
out vec2 v_uv;
const float HW = 100.0, HH = 100.0, HD = 40.0;
void main() {
  int id = gl_InstanceID;
  int x = id % 100;
  int y = (id / 100) % 100;
  int z = id / 10000;
  vec2 rg = texelFetch(u_vol, ivec3(x, y, z), 0).rg;
  float q = rg.r * 255.0;
  float s = rg.g * 255.0;
  v_uv = a_corner;
  // vertex-side cull + slice (scale-to-zero via off-screen clip)
  if (q < u_qmin || float(z) < u_zmin || float(z) > u_zmax) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0); v_color = vec3(0.0); return;
  }
  // hex-plane embed + z compress (true-FCC layer spacing ~0.816)
  vec3 p = vec3(float(x) + 0.5 * float(y & 1), float(y) * 0.8660254,
                float(z) * u_zscale);
  p -= vec3(50.0, 43.3, 16.3);            // lattice centroid
  vec4 mv = u_mvp * vec4(p, 1.0);
  float ps = u_size * (0.6 + 1.6 * q / 255.0);
  mv.xy += a_corner * ps;                 // billboard in view space
  gl_Position = mv;
  float d = q / 255.0;
  if (u_colorMode == 1) {
    // spin class: 1-6 equatorial (toroidal, warm), 7-9 zenith (poloidal
    // up, cyan), 10-12 nadir (poloidal down, violet)
    v_color = s == 0.0 ? vec3(0.15) * d
      : s <= 6.0 ? vec3(1.0, 0.35 + 0.4 * d, 0.1) * (0.4 + 0.8 * d)
      : s <= 9.0 ? vec3(0.1, 0.8, 1.0) * (0.4 + 0.8 * d)
      :            vec3(0.6, 0.3, 1.0) * (0.4 + 0.8 * d);
  } else {
    v_color = mix(vec3(0.05, 0.15, 0.4), vec3(0.2, 0.9, 1.0), d)
            + vec3(1.0, 0.7, 0.2) * d * d;
  }
}`;

const FRAG = `#version 300 es
precision highp float;
in vec3 v_color;
in vec2 v_uv;
out vec4 frag;
void main() {
  float r2 = dot(v_uv, v_uv);
  if (r2 > 1.0) discard;                  // round billboard
  float a = 1.0 - smoothstep(0.4, 1.0, r2);
  frag = vec4(v_color * a, a);
}`;

export async function initFccViewer(root, opts = {}) {
  const wasmUrl = opts.wasmUrl || '/wasm/wake/planck3.js';
  const stateUrl = opts.stateUrl || '/fcc/hopfion.p3st';
  const canvas = root.querySelector('canvas');
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
  const hud = root.querySelector('[data-hud]');
  if (!gl) { hud.textContent = 'WebGL2 unavailable'; return () => {}; }

  // ---------- wasm ----------
  if (typeof createPlanck3 === 'undefined')
    await new Promise((res, rej) => {
      const sc = document.createElement('script');
      sc.src = wasmUrl; sc.onload = res;
      sc.onerror = () => rej(new Error('planck3.js load failed'));
      document.head.appendChild(sc);
    });
  const wasm = await createPlanck3();
  wasm._fcc_init();
  wasm._fcc_set_mode(0); // flat — canonical state always in g_rd
  const heap = wasm.HEAPU8 || new Uint8Array(wasm.wasmMemory.buffer);

  const loadState = async (url) => {
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    if (bytes.length !== 16 + N3 * 6) throw new Error(`state size ${bytes.length}`);
    heap.set(bytes, wasm._fcc_load_pointer());
    const rc = wasm._fcc_load_commit();
    if (rc !== 0) throw new Error(`fcc_load_commit rc=${rc}`);
  };
  await loadState(stateUrl);

  // Optional knot injection (collision demo preset)
  const injectKnot = () => {
    for (let z = 16; z < 24; z++) for (let y = 40; y < 48; y++) for (let x = 40; x < 48; x++) {
      const i = (z * H3 + y) * W3 + x;
      wasm._fcc_set_node(i, 255, 1, 3000, 0, 0);
    }
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
  for (const n of ['u_mvp', 'u_vol', 'u_size', 'u_zmin', 'u_zmax', 'u_zscale', 'u_qmin', 'u_colorMode', 'u_viewport', 'u_mvp_raw_unused'])
    U[n] = gl.getUniformLocation(prog, n);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, tex);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.RG8, W3, H3, D3, 0, gl.RG, gl.UNSIGNED_BYTE, null);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
    [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE]])
    gl.texParameteri(gl.TEXTURE_3D, k, v);
  gl.uniform1i(U.u_vol, 0);
  gl.activeTexture(gl.TEXTURE0);
  const rgPtr = wasm._fcc_rg_pointer();
  const upload = () => {
    wasm._fcc_rg_refresh();
    gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, 0, W3, H3, D3, gl.RG, gl.UNSIGNED_BYTE,
      heap.subarray(rgPtr, rgPtr + N3 * 2));
  };

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
  let dirty = true;
  const ptrs = new Map();
  let lastPinch = 0;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', e => {
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    const prev = ptrs.get(e.pointerId);
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 1) {
      cam.yaw += (e.clientX - prev[0]) * 0.008;
      cam.pitch = Math.max(-1.5, Math.min(1.5, cam.pitch + (e.clientY - prev[1]) * 0.008));
      dirty = true;
    } else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (lastPinch) { cam.dist = Math.max(20, Math.min(300, cam.dist * lastPinch / d)); dirty = true; }
      lastPinch = d;
    }
  });
  const endPtr = e => { ptrs.delete(e.pointerId); lastPinch = 0; };
  canvas.addEventListener('pointerup', endPtr);
  canvas.addEventListener('pointercancel', endPtr);
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    cam.dist = Math.max(20, Math.min(300, cam.dist * (1 + e.deltaY * 0.001)));
    dirty = true;
  }, { passive: false });

  // ---------- state / UI ----------
  const ui = {
    playing: true, tickMs: 80, budget: 12, acc: 0, tick: 0,
    zmin: 0, zmax: D3 - 1, qmin: 1, size: 0.55, colorMode: 1, zscale: 0.816,
    spin: true,
  };
  const bind = (sel, ev, fn) => { const el = root.querySelector(sel); if (el) el.addEventListener(ev, fn); return el; };
  bind('[data-play]', 'click', e => { ui.playing = !ui.playing; e.target.textContent = ui.playing ? '⏸' : '▶'; });
  bind('[data-step]', 'click', () => { wasm._fcc_tick(); ui.tick++; upload(); dirty = true; });
  bind('[data-reset]', 'click', async () => { await loadState(stateUrl); ui.tick = 0; upload(); dirty = true; });
  bind('[data-knot]', 'click', () => { injectKnot(); upload(); dirty = true; });
  bind('[data-zmin]', 'input', e => { ui.zmin = +e.target.value; if (ui.zmin > ui.zmax) ui.zmax = ui.zmin; dirty = true; });
  bind('[data-zmax]', 'input', e => { ui.zmax = +e.target.value; if (ui.zmax < ui.zmin) ui.zmin = ui.zmax; dirty = true; });
  bind('[data-qmin]', 'input', e => { ui.qmin = +e.target.value; dirty = true; });
  bind('[data-size]', 'input', e => { ui.size = +e.target.value / 100; dirty = true; });
  bind('[data-colormode]', 'change', e => { ui.colorMode = +e.target.value; dirty = true; });
  bind('[data-mode]', 'change', e => {
    wasm._fcc_collect();          // dump chunk state to g_rd if we were chunked
    wasm._fcc_set_mode(+e.target.value);
    wasm._fcc_prepare();          // load g_rd into chunks if going chunked
    upload(); dirty = true;
  });

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

    if (ui.playing) {
      // Adaptive physics budget: run ticks until ~budget ms per frame.
      let spent = 0;
      while (spent < ui.budget) {
        const t0 = performance.now();
        wasm._fcc_tick();
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
      gl.uniform1f(U.u_zmin, ui.zmin);
      gl.uniform1f(U.u_zmax, ui.zmax);
      gl.uniform1f(U.u_zscale, ui.zscale);
      gl.uniform1f(U.u_qmin, ui.qmin);
      gl.uniform1i(U.u_colorMode, ui.colorMode);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, N3);
      dirty = false;
    }
    if (hud && (ui.tick % 10 === 0 || !ui.playing)) {
      hud.textContent = `t${ui.tick} · ${fps.toFixed(0)}fps · ${ui.tickMs.toFixed(0)}ms/t · q=${wasm._fcc_total_quanta().toLocaleString()} · knots=${wasm._fcc_deadlocked()}`;
    }
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}
