/*
 * Yarkovsky's Ember — live meso3i friction substrate in the browser.
 *
 * Pipeline (parity with Hopf's Loom): meso3i.wasm ticks the integer
 * lattice gas; meso3i_rg_refresh() packs {moving, rest} into an RG8
 * buffer inside the wasm heap -> gl.texSubImage3D uploads it straight
 * to the GPU -> one drawArraysInstanced call renders every lattice
 * cell; the vertex shader culls vacuum and ghosts the tomographic slab.
 *
 * Honest embedding: the even-parity FCC sublattice carries its geometry
 * in the 18 channel vectors, not in a staggered grid — so the faithful
 * picture is the plain cubic cell map (zscale = 1). Odd-parity cells
 * are structural vacuum: the engine can never occupy them.
 *
 * Controls mirror the measured campaign (M33–M36):
 *   ☀ drive — the canonical 18-spoke convergent feed (RAY=3, RATE=4)
 *   ➤ beam  — +x carriers only; the M36 illumination that walks a lump
 *   ⌖ lump  — drop a cold rest-mass rock straight onto the slice plane
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
// billboard corners synthesized from gl_VertexID — no VBO needed
const vec2 CORNER[6] = vec2[6](
  vec2(-1.0,-1.0), vec2(1.0,-1.0), vec2(1.0,1.0),
  vec2(-1.0,-1.0), vec2(1.0,1.0),  vec2(-1.0,1.0));
uniform sampler3D u_vol;                  // RG8: r=moving g=rest
uniform mat4 u_mvp;
uniform float u_size;
uniform float u_z_center, u_z_thickness;
uniform float u_ghost_alpha;
uniform float u_qmin;
uniform int u_colorMode;                  // 0=ember 1=heat 2=flux 3=macro
out vec4 v_color;
out vec2 v_uv;
uniform int u_nx, u_ny, u_nxy, u_step;
void main() {
  vec2 a_corner = CORNER[gl_VertexID];
  int id = gl_InstanceID;
  int x = (id % u_nx) * u_step;
  int y = ((id / u_nx) % u_ny) * u_step;
  int z = (id / u_nxy) * u_step;
  vec2 rg = texelFetch(u_vol, ivec3(x, y, z), 0).rg;
  float mov = rg.r * 255.0;
  float rest = rg.g * 255.0;
  float d = max(mov, rest);
  v_uv = a_corner;
  if (d < u_qmin) {                        // vacuum + dead parity: clip
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0); v_color = vec4(0.0); return;
  }
  float halfT = u_z_thickness * 0.5;
  float alpha = abs(float(z) - u_z_center) <= halfT ? 1.0 : u_ghost_alpha;
  vec3 p = vec3(float(x), float(y), float(z));
  vec4 mv = u_mvp * vec4(p, 1.0);
  float ps = u_size * (0.8 + 2.0 * d / 255.0);
  mv.xy += a_corner * ps;
  gl_Position = mv;
  vec3 rgb;
  // blackbody ramp for parked heat (the ember): ember->red->orange->amber->white
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
  if (r2 > 1.0) discard;
  float a = exp(-r2 * 3.0);
  frag = vec4(v_color.rgb * v_color.a * a, 1.0);
}`;

export async function initEmberSimulator(root, opts = {}) {
  const wasmUrl = opts.wasmUrl || '/wasm/ember/meso3i.js';
  const canvas = root.querySelector('canvas');
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
  const hud = root.querySelector('[data-hud]');
  if (!gl) { hud.textContent = 'WebGL2 unavailable'; return () => {}; }

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
  const [W3, H3, D3] = opts.dims || [44, 44, 44];
  if (wasm._meso3i_init(W3, H3, D3, 1) !== 0)
    { hud.textContent = `grid ${W3}x${H3}x${D3} rejected by engine`; return () => {}; }
  const N3 = W3 * H3 * D3;
  const CX = W3 >> 1, CY = H3 >> 1, CZ = D3 >> 1;
  const cenX = W3 * 0.5, cenY = H3 * 0.5, cenZ = D3 * 0.5;
  const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
  // The measured friction ecology: transit drag at rho>=8, rest inert,
  // radiation carrier-gated (fricmode < 0 — heat needs a carrier).
  wasm._meso3i_collmode(0);
  wasm._meso3i_friction(8);
  wasm._meso3i_fricmode(-4);

  // channel vectors out of the engine itself — the same table the
  // physics uses, so the spoke geometry can't drift from the rules
  const CV = [];
  for (let c = 0; c < NMOV; c++)
    CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);

  // Canonical convergent feed (test_replay/test_accrete): each moving
  // channel sources RATE quanta/tick at a point RAY cells back along
  // its direction — 18 spokes aimed at the origin.
  const RAY = 3, RATE = 4;
  const inject = () => {
    for (let c = 0; c < NMOV; c++) {
      const [vx, vy, vz] = CV[c];
      const want = ui.drive || (ui.beam && vx > 0);
      if (!want) continue;
      const sx = CX - RAY * vx, sy = CY - RAY * vy, sz = CZ - RAY * vz;
      for (let u = 0; u < RATE; u++)
        wasm._meso3i_set(sx, sy, sz, c, wasm._meso3i_get(sx, sy, sz, c) + 1);
    }
  };

  // ⌖: drop a cold rest-mass lump (the M35 rock) onto the slice plane.
  const LUMP_R = 3, LUMP_Q = 32;
  const seedLump = (lx, ly, lz) => {
    let n = 0;
    for (let dz = -LUMP_R; dz <= LUMP_R; dz++)
    for (let dy = -LUMP_R; dy <= LUMP_R; dy++)
    for (let dx = -LUMP_R; dx <= LUMP_R; dx++) {
      if (dx * dx + dy * dy + dz * dz > LUMP_R * LUMP_R) continue;
      const x = lx + dx, y = ly + dy, z = lz + dz;
      if (((x + y + z) & 1) !== 0) continue;    // live parity only
      if (x < 0 || x >= W3 || y < 0 || y >= H3 || z < 0 || z >= D3) continue;
      wasm._meso3i_set(x, y, z, REST, LUMP_Q);
      n++;
    }
    return n;
  };

  // Camera ray -> lattice cell on the slice plane (cubic embedding:
  // world coord = grid coord - centroid).
  const pickCell = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    const nx = ((cx - r.left) / r.width) * 2 - 1;
    const ny = 1 - ((cy - r.top) / r.height) * 2;
    const asp = canvas.width / Math.max(1, canvas.height);
    const th = Math.tan(0.45);
    const vx = nx * th * asp, vy = ny * th, vz = -1;
    const cyw = Math.cos(cam.yaw), syw = Math.sin(cam.yaw);
    const cph = Math.cos(cam.pitch), sph = Math.sin(cam.pitch);
    const d1 = { x: vx, y: vy * cph + vz * sph, z: -vy * sph + vz * cph };
    const dW = { x: d1.x * cyw - d1.z * syw, y: d1.y, z: d1.x * syw + d1.z * cyw };
    const c1 = { x: 0, y: cam.dist * sph, z: cam.dist * cph };
    const cW = { x: -c1.z * syw + cam.cx, y: c1.y + cam.cy, z: c1.z * cyw + cam.cz };
    const pz = ui.zCenter - cenZ;
    if (Math.abs(dW.z) < 1e-3) return null;
    const t = (pz - cW.z) / dW.z;
    if (t <= 0) return null;
    return {
      lx: Math.round(cW.x + t * dW.x + cenX),
      ly: Math.round(cW.y + t * dW.y + cenY),
      lz: ui.zCenter,
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

  const maxTex = gl.getParameter(gl.MAX_3D_TEXTURE_SIZE);
  if (Math.max(W3, H3, D3) > maxTex) {
    hud.textContent = `grid ${W3}x${H3}x${D3} exceeds GL 3D texture limit (${maxTex})`;
    return () => {};
  }
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, tex);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.RG8, W3, H3, D3, 0, gl.RG, gl.UNSIGNED_BYTE, null);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
    [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE]])
    gl.texParameteri(gl.TEXTURE_3D, k, v);
  gl.uniform1i(U.u_vol, 0);
  gl.activeTexture(gl.TEXTURE0);
  const rgPtr = wasm._meso3i_rg_pointer();
  const upload = () => {
    wasm._meso3i_rg_refresh();
    const h8 = wasm.HEAPU8 || new Uint8Array(wasm.wasmMemory.buffer);
    gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, 0, W3, H3, D3, gl.RG, gl.UNSIGNED_BYTE,
      h8.subarray(rgPtr, rgPtr + N3 * 2));
  };

  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    say('GPU context lost — restarting…', 5000);
  });
  canvas.addEventListener('webglcontextrestored', () => {
    root.dispatchEvent(new CustomEvent('ember:reinit'));
  });

  // No vertex attributes — corners come from gl_VertexID. A bound VAO is
  // still required for the draw to be valid on some drivers.
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(false);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);

  // ---------- camera / controls ----------
  const cam = { yaw: 0.7, pitch: 0.45, dist: 70, cx: cenX, cy: cenY, cz: cenZ };
  const tgt = { ...cam };
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
      if (pinchRest) return;
      tgt.yaw += (e.clientX - prev[0]) * 0.008;
      tgt.pitch = Math.max(-1.5, Math.min(1.5, tgt.pitch + (e.clientY - prev[1]) * 0.008));
      dirty = true;
    } else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (lastPinch) { tgt.dist = Math.max(20, Math.min(300, tgt.dist * lastPinch / d)); dirty = true; }
      lastPinch = d;
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (lastMid) {
        const dx = mid[0] - lastMid[0], dy = mid[1] - lastMid[1];
        const s = cam.dist * 0.0016;
        const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
        const cxp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
        const rx = cy, ry = sp * sy, rz = -cxp * sy;
        const ux = 0, uy = cxp, uz = sp;
        tgt.cx += (dy * ux - dx * rx) * s;
        tgt.cy += (dy * uy - dx * ry) * s;
        tgt.cz += (dy * uz - dx * rz) * s;
        const cl = v => Math.max(-80, Math.min(80, v));
        tgt.cx = cl(tgt.cx); tgt.cy = cl(tgt.cy); tgt.cz = cl(tgt.cz);
        dirty = true;
      }
      lastMid = mid;
    }
  });
  const endPtr = e => {
    ptrs.delete(e.pointerId); lastPinch = 0; lastMid = null;
    if (ptrs.size === 1) pinchRest = true;
    else pinchRest = false;
    if (ui.lumpArm && downPos && ptrs.size === 0) {
      const moved = Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]);
      if (moved < 8) {
        const cell = pickCell(e.clientX, e.clientY);
        if (cell) {
          const n = seedLump(cell.lx, cell.ly, cell.lz);
          upload(); dirty = true;
          say(n ? `cold rock dropped — ${n * LUMP_Q} quanta parked · ⌖ again to disarm`
                : 'no live cells there — aim inside the lattice');
        } else say('edge-on view — pick while the slice plane is facing you', 4500);
      }
    }
    downPos = null;
  };
  canvas.addEventListener('pointerup', endPtr);
  canvas.addEventListener('pointercancel', endPtr);
  for (const g of ['gesturestart', 'gesturechange', 'gestureend'])
    canvas.addEventListener(g, e => e.preventDefault());
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
    playing: true, tickMs: 0, budget: 12, tick: 0,
    zCenter: D3 >> 1, zThick: D3, ghostAlpha: 0.06,
    qmin: 1, size: 0.80, colorMode: 0, tps: 20, tickDebt: 0,
    turntable: !matchMedia('(prefers-reduced-motion: reduce)').matches,
    drive: true, beam: false, lumpArm: false,
  };
  for (const [sel, max, val] of [['[data-zcenter]', D3 - 1, D3 >> 1], ['[data-zthick]', D3, D3]]) {
    const el = root.querySelector(sel);
    if (el) { el.max = max; el.value = val;
      const o = el.parentElement?.querySelector('output'); if (o) o.value = val; }
  }
  let rStep = 1;
  const strideInfo = () => {
    const nx = Math.ceil(W3 / rStep), ny = Math.ceil(H3 / rStep), nz = Math.ceil(D3 / rStep);
    return { nx, ny, nxy: nx * ny, count: nx * ny * nz };
  };
  const bootT = performance.now();
  let lowT = null, highT = null, lastSpent = 0;

  const spinBtn = root.querySelector('[data-spin]');
  if (spinBtn && !ui.turntable) { spinBtn.classList.remove('on'); spinBtn.setAttribute('aria-pressed', 'false'); }
  const bind = (sel, ev, fn) => { const el = root.querySelector(sel); if (el) el.addEventListener(ev, fn); return el; };
  const toggle = (sel, key, onSay, offSay) => bind(sel, 'click', e => {
    ui[key] = !ui[key];
    const b = e.currentTarget;
    b.classList.toggle('on', ui[key]);
    b.setAttribute('aria-pressed', String(ui[key]));
    say(ui[key] ? onSay : offSay);
  });
  bind('[data-play]', 'click', e => { ui.playing = !ui.playing; e.currentTarget.textContent = ui.playing ? '⏸' : '▶'; });
  bind('[data-step]', 'click', () => {
    if (ui.drive || ui.beam) inject();
    wasm._meso3i_drain_edge(3);
    wasm._meso3i_tick();
    ui.tick++; upload(); dirty = true;
  });
  bind('[data-reset]', 'click', () => {
    wasm._meso3i_clear(); ui.tick = 0;
    rStep = 1; lowT = highT = null;
    upload(); dirty = true;
    say(ui.drive ? 'cleared — spokes are still feeding, watch it re-accrete' : 'cleared — cold vacuum');
  });
  toggle('[data-drive]', 'drive',
    'convergent feed on — 18 spokes pouring flux into the core',
    'feed cut — the core freezes; parked heat waits for a carrier');
  toggle('[data-beam]', 'beam',
    '+x carrier beam on — watch the far side ablate and the lump walk toward it',
    'beam off');
  const lumpBtn = root.querySelector('[data-lump]');
  const setLumpArm = (on) => {
    ui.lumpArm = on;
    canvas.style.cursor = on ? 'crosshair' : '';
    if (lumpBtn) { lumpBtn.classList.toggle('armed', on); lumpBtn.setAttribute('aria-pressed', String(on)); }
    say(on ? 'rock tool armed — tap the slice plane to drop a cold lump · ⌖ to cancel' : '', 0);
  };
  bind('[data-lump]', 'click', () => setLumpArm(!ui.lumpArm));
  bind('[data-snap]', 'click', () => { wasm._meso3i_save(); const b = root.querySelector('[data-unsnap]'); if (b) b.disabled = false; say('snapshot saved', 2500); });
  bind('[data-unsnap]', 'click', () => { if (wasm._meso3i_restore() === 0) { upload(); dirty = true; } });
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
  bind('[data-zcenter]', 'input', e => { ui.zCenter = +e.target.value; readout(e); dirty = true; });
  bind('[data-zthick]', 'input', e => { ui.zThick = +e.target.value; readout(e); dirty = true; });
  bind('[data-qmin]', 'input', e => { ui.qmin = +e.target.value; readout(e); dirty = true; });
  bind('[data-size]', 'input', e => { ui.size = +e.target.value / 100; readout(e); dirty = true; });
  bind('[data-speed]', 'input', e => { ui.tps = +e.target.value; readout(e); });
  bind('[data-colormode]', 'change', e => { ui.colorMode = +e.target.value; dirty = true; });
  bind('[data-zoom]', 'input', e => { tgt.dist = +e.target.value; readout(e); poke(); dirty = true; });
  bind('[data-tune]', 'click', e => {
    const dock = root.querySelector('.ember-dock');
    const open = dock?.classList.toggle('tune-open');
    e.currentTarget.setAttribute('aria-expanded', String(!!open));
  });
  const zoomEl = root.querySelector('[data-zoom]');
  const syncZoom = () => {
    if (!zoomEl) return;
    const v = Math.round(tgt.dist);
    if (+zoomEl.value !== v) {
      zoomEl.value = v;
      const o = zoomEl.parentElement?.querySelector('output');
      if (o) o.textContent = v;
    }
  };

  // orientation gizmo — same Rx(pitch)·Ry(yaw) the camera uses
  const gizmo = root.querySelector('[data-gizmo]');
  const g2 = gizmo?.getContext('2d');
  const drawGizmo = () => {
    if (!g2) return;
    const S = gizmo.width, c = S / 2, r = S * 0.36;
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    const cx = Math.cos(cam.pitch), sx = Math.sin(cam.pitch);
    const rot = (x, y, z) => {
      const x1 = cy * x + sy * z, z1 = -sy * x + cy * z;
      return [x1, cx * y - sx * z1, sx * y + cx * z1];
    };
    g2.clearRect(0, 0, S, S);
    for (const [x, y, z, col] of [[1,0,0,'#ffb347'], [0,1,0,'#7fe'], [0,0,1,'#b78aff']]) {
      const [vx, vy, vz] = rot(x, y, z);
      g2.globalAlpha = 0.35 + 0.65 * (vz * 0.5 + 0.5);
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
    gizmo.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      const t = performance.now();
      if (t - lastTap < 330) resetView();
      lastTap = t;
    });
  }
  bind('[data-uitoggle]', 'click', () => root.classList.toggle('dock-hidden'));

  const PRESETS = {
    full:    { yaw: 0.7,  pitch: 0.45, dist: 70,  zCenter: D3 >> 1, zThick: D3 },
    core:    { yaw: 0.9,  pitch: 0.6,  dist: 40,  zCenter: D3 >> 1, zThick: D3 },
    slab:    { yaw: 0.7,  pitch: 0.15, dist: 70,  zCenter: D3 >> 1, zThick: 4 },
    side:    { yaw: 0.35, pitch: 0.10, dist: 80,  zCenter: D3 >> 1, zThick: D3 },
    lattice: { yaw: 0.7,  pitch: 0.6,  dist: 70,  zCenter: D3 >> 1, zThick: 1 },
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

    if (ui.turntable && now - lastInteract > 4000) { tgt.yaw += 0.0014; dirty = true; }

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
      // ticks-per-second governor: c=1 is the speed of light here — uncapped
      // the lattice runs ~100+ tps and flux crosses the grid in ~0.4s
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
        if (ui.tickMs > ui.budget) break;
      }
      lastSpent = spent;
      upload(); dirty = true;
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
      const rest = wasm._meso3i_rest_mass(), mov = wasm._meso3i_mov_mass();
      const cx = wasm._meso3i_cm(0) / 256, cyy = wasm._meso3i_cm(1) / 256, cz = wasm._meso3i_cm(2) / 256;
      const cm = rest > 0 ? `cm=(${cx.toFixed(1)},${cyy.toFixed(1)},${cz.toFixed(1)})` : 'no ember';
      hud.textContent = `t${ui.tick} · ember=${rest} · flux=${mov} · ${cm} · ${fps.toFixed(0)}fps · ${ui.tickMs.toFixed(1)}ms/t`;
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
