/*
 * Cartan's Cascade — live moore26 0.1fm substrate in the browser.
 *
 * Pipeline (parity with Yarkovsky's Ember): moore26.wasm ticks the
 * 26-channel Moore-stencil lattice; moore26_rg_refresh() packs the four
 * physics layers {structure, phase, heat, charge} into an RGBA8 buffer
 * inside the wasm heap -> gl.texSubImage3D uploads it straight to the
 * GPU -> one drawArraysInstanced call renders every lattice cell.
 *
 * The four render layers (data-view select):
 *   structure — dominant winding + mass: deep indigo -> brilliant cyan
 *   wake      — Jacobi phase field:      translucent green -> yellow
 *   thermal   — heat reservoir:          glowing red -> orange
 *   pol       — signed charge:           deep blue (-q) -> magenta (+q)
 *
 * Controls mirror the cascade test rig:
 *   ☀ drive — convergent photon feed (26 spokes aimed at the core)
 *   ➤ beam  — +x photon stream (the hexbuckle probe)
 *   ⌖ lump  — drop a wound rest-mass lump onto the slice plane
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
const vec2 CORNER[6] = vec2[6](
  vec2(-1.0,-1.0), vec2(1.0,-1.0), vec2(1.0,1.0),
  vec2(-1.0,-1.0), vec2(1.0,1.0),  vec2(-1.0,1.0));
uniform sampler3D u_vol;    // RGBA8: r=structure g=phase b=heat a=charge(+127)
uniform mat4 u_mvp;
uniform float u_size;
uniform float u_z_center, u_z_thickness;
uniform float u_ghost_alpha;
uniform float u_qmin;
uniform int u_colorMode;    // 0=structure 1=wake 2=thermal 3=pol 4=composite
out vec4 v_color;
out vec2 v_uv;
uniform int u_nx, u_ny, u_nxy, u_step;
void main() {
  vec2 a_corner = CORNER[gl_VertexID];
  int id = gl_InstanceID;
  int x = (id % u_nx) * u_step;
  int y = ((id / u_nx) % u_ny) * u_step;
  int z = (id / u_nxy) * u_step;
  vec4 rg = texelFetch(u_vol, ivec3(x, y, z), 0);
  float strc = rg.r * 255.0;
  float ph   = rg.g * 255.0;
  float ht   = rg.b * 255.0;
  float chg  = rg.a * 255.0;   // biased 127 = neutral
  float d = max(strc, max(ph, max(ht, abs(chg - 127.0) * 2.0)));
  v_uv = a_corner;
  if (d < u_qmin) {
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
  // structure: deep indigo -> brilliant cyan (winding saturation 128)
  float s = pow(strc / 255.0, 0.7);
  vec3 strcRamp = (s < 0.25 ? mix(vec3(0.02,0.02,0.14), vec3(0.05,0.16,0.62), s * 4.0)
      :  s < 0.55 ? mix(vec3(0.05,0.16,0.62), vec3(0.00,0.60,1.00), (s - 0.25) * 3.33)
      :  s < 0.80 ? mix(vec3(0.00,0.60,1.00), vec3(0.40,0.90,1.00), (s - 0.55) * 4.0)
      :             mix(vec3(0.40,0.90,1.00), vec3(0.95,1.00,1.00), (s - 0.80) * 5.0));
  // wake: translucent green -> yellow (phase field)
  float w = ph / 255.0;
  vec3 wakeRamp = mix(vec3(0.02,0.30,0.10), vec3(0.85,0.90,0.20), w);
  // thermal: glowing red -> orange (heat reservoir)
  float h = pow(ht / 255.0, 0.75);
  vec3 heatRamp = (h < 0.30 ? mix(vec3(0.10,0.00,0.00), vec3(0.55,0.05,0.00), h * 3.33)
      :  h < 0.65 ? mix(vec3(0.55,0.05,0.00), vec3(0.95,0.30,0.02), (h - 0.30) * 2.86)
      :             mix(vec3(0.95,0.30,0.02), vec3(1.00,0.75,0.30), (h - 0.65) * 2.86));
  // polarization: deep blue (-q) through void -> magenta (+q)
  float cq = (chg - 127.0) / 128.0;                    // -1..+1
  vec3 polRamp = cq < 0.0
      ? mix(vec3(0.02,0.05,0.30), vec3(0.15,0.40,1.00), -cq)
      : mix(vec3(0.30,0.02,0.20), vec3(1.00,0.35,0.85), cq);
  if (u_colorMode == 1) {
    rgb = wakeRamp * (0.4 + 0.6 * w);
  } else if (u_colorMode == 2) {
    rgb = heatRamp * (0.35 + 0.85 * ht / 255.0);
  } else if (u_colorMode == 3) {
    rgb = polRamp * (0.35 + 0.85 * abs(cq));
  } else if (u_colorMode == 4) {
    // composite — cyan structure + red thermal halo + charge tint
    rgb = strcRamp * (0.35 + 0.75 * strc / 255.0) + heatRamp * 0.6
        + polRamp * abs(cq) * 0.9;
  } else {
    rgb = strcRamp * (0.35 + 0.85 * strc / 255.0);
  }
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
  float a = exp(-r2 * 5.0);              // softer halo — transparent glow
  frag = vec4(v_color.rgb * a, v_color.a * a * 0.85);
}`;

export async function initCascadeSimulator(root, opts = {}) {
  const wasmUrl = opts.wasmUrl || '/wasm/cascade/moore26.js';
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
  if (typeof createMoore26 === 'undefined')
    await new Promise((res, rej) => {
      const sc = document.createElement('script');
      sc.src = wasmUrl; sc.onload = res;
      sc.onerror = () => rej(new Error('moore26.js load failed: ' + wasmUrl));
      document.head.appendChild(sc);
    });
  say('instantiating wasm…');
  const wasm = await createMoore26();
  const [W3, H3, D3] = opts.dims || [32, 32, 32];   // power-of-2 required;
                            // 64^3 runs ~550ms/tick single-threaded wasm —
                            // 32^3 keeps the sim interactive (~70ms/tick)
  wasm._moore26_init(W3, H3, D3);
  const N3 = W3 * H3 * D3;
  const CX = W3 >> 1, CY = H3 >> 1, CZ = D3 >> 1;
  const cenX = W3 * 0.5, cenY = H3 * 0.5, cenZ = D3 * 0.5;
  const NCH = wasm._moore26_channel_count();

  // channel vectors out of the engine itself
  const CV = [];
  for (let c = 0; c < NCH; c++)
    CV.push([wasm._moore26_cvc(c, 0), wasm._moore26_cvc(c, 1), wasm._moore26_cvc(c, 2)]);

  // Convergent photon feed: each channel sources photons at a point
  // RAY cells back along its direction — 26 spokes aimed at the core.
  const RAY = 3, RATE = 4, FEED_NU = 96;
  const inject = () => {
    for (let c = 0; c < NCH; c++) {
      const [vx, vy, vz] = CV[c];
      const want = ui.drive || (ui.beam && vx > 0 && vy === 0 && vz === 0);
      if (!want) continue;
      const sx = CX - RAY * vx, sy = CY - RAY * vy, sz = CZ - RAY * vz;
      for (let u = 0; u < RATE; u++) {
        wasm._moore26_photon_set(sx, sy, sz, c,
          Math.min(255, wasm._moore26_photon_get(sx, sy, sz, c) + 2));
        wasm._moore26_photon_nu_set(sx, sy, sz, c, FEED_NU);
      }
    }
  };

  // ⌖: drop a wound rest-mass lump onto the slice plane — mass core +
  // a wound shell on the face channel pairs (a bound knot, not bare mass).
  const LUMP_R = 3, LUMP_M = 256, LUMP_W = 96;
  const seedLump = (lx, ly, lz) => {
    let n = 0;
    for (let dz = -LUMP_R; dz <= LUMP_R; dz++)
    for (let dy = -LUMP_R; dy <= LUMP_R; dy++)
    for (let dx = -LUMP_R; dx <= LUMP_R; dx++) {
      if (dx * dx + dy * dy + dz * dz > LUMP_R * LUMP_R) continue;
      const x = lx + dx, y = ly + dy, z = lz + dz;
      if (x < 0 || x >= W3 || y < 0 || y >= H3 || z < 0 || z >= D3) continue;
      wasm._moore26_mass_set(x, y, z, LUMP_M);
      for (let e = 0; e < 3; e++) {         // face-edge wound pairs
        wasm._moore26_winding_set(x, y, z, 2 * e, LUMP_W);
        wasm._moore26_winding_set(x, y, z, 2 * e + 1, LUMP_W);
      }
      n++;
    }
    return n;
  };

  // ——: paint a stretched flux tube at the picked point — two mass
  // anchors joined by a saturated winding run on the +/-X pair. The
  // signature demo: >=12 saturated nodes triggers macroscopic string-
  // breaking — the tube fractures into charged recoil fragments.
  const seedTube = (lx, ly, lz) => {
    const half = 8;
    const x0 = Math.max(1, lx - half), x1 = Math.min(W3 - 2, lx + half);
    let n = 0;
    wasm._moore26_mass_set(x0, ly, lz, 512);
    wasm._moore26_mass_set(x1, ly, lz, 512);
    for (let x = x0; x <= x1; x++) {
      wasm._moore26_winding_set(x, ly, lz, 0, 128);
      wasm._moore26_winding_set(x, ly, lz, 1, 128);
      n++;
    }
    return n;
  };

  // Camera ray -> lattice cell on the slice plane
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
    if (Math.abs(dW.z) < 1e-3) return null;
    const t = (ui.zCenter - cW.z) / dW.z;
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
  const upload = () => {
    wasm._moore26_rg_refresh();
    const rgPtr = wasm._moore26_rg_pointer();
    const h8 = wasm.HEAPU8 || new Uint8Array(wasm.wasmMemory.buffer);
    gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, 0, W3, H3, D3, gl.RGBA, gl.UNSIGNED_BYTE,
      h8.subarray(rgPtr, rgPtr + N3 * 4));
  };

  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    say('GPU context lost — restarting…', 5000);
  });
  canvas.addEventListener('webglcontextrestored', () => {
    /* context restore re-inits the WHOLE sim — the wasm module and
     * its grid state are lost with it (the sim restarts fresh).
     * This is the 'state draining' that shows under GPU pressure. */
    root.dispatchEvent(new CustomEvent('cascade:reinit'));
  });

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);   // premultiplied — real transparency

  // ---------- camera ----------
  const cam = { yaw: 0.7, pitch: 0.45, dist: 70, cx: cenX, cy: cenY, cz: cenZ };
  const tgt = { ...cam };
  let lastInteract = 0, dirty = true;
  const poke = () => { lastInteract = performance.now(); };
  let dragging = false, lx = 0, ly = 0;
  canvas.addEventListener('pointerdown', e => {
    poke();
    if (ui.lumpArm || ui.tubeArm) {
      const cell = pickCell(e.clientX, e.clientY);
      if (cell) {
        if (ui.tubeArm) {
          const n = seedTube(cell.lx, cell.ly, cell.lz);
          say(n ? `flux tube painted — ${n} saturated nodes; watch it fracture` : 'off-lattice', 3500);
        } else {
          const n = seedLump(cell.lx, cell.ly, cell.lz);
          say(n ? `wound lump dropped — ${n} sites bound` : 'off-lattice', 2500);
        }
      } else say('edge-on view — pick while the slice plane is facing you', 4500);
      return;
    }
    dragging = true; lx = e.clientX; ly = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    poke();
    tgt.yaw += (e.clientX - lx) * 0.006;
    tgt.pitch = Math.max(-1.4, Math.min(1.4, tgt.pitch + (e.clientY - ly) * 0.006));
    lx = e.clientX; ly = e.clientY;
    dirty = true;
  });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  const keepAwake = async () => {
    if (!document.hidden && !wakeLock && 'wakeLock' in navigator)
      try { wakeLock = await navigator.wakeLock.request('screen'); } catch (_) {}
  };
  let wakeLock = null;
  keepAwake();
  document.addEventListener('visibilitychange', keepAwake);
  canvas.addEventListener('wheel', e => {
    e.preventDefault(); poke();
    tgt.dist = Math.max(8, Math.min(400, tgt.dist * (1 + e.deltaY * 0.001)));
    dirty = true;
  }, { passive: false });

  // ---------- state / UI ----------
  const ui = {
    playing: true, tickMs: 0, budget: 400, tick: 0,
    zCenter: D3 >> 1, zThick: D3, ghostAlpha: 0.06,
    qmin: 1, size: 0.9, colorMode: 4, tps: 4, tickDebt: 0,
    turntable: !matchMedia('(prefers-reduced-motion: reduce)').matches,
    drive: true, beam: false, lumpArm: false, tubeArm: false,
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
    wasm._moore26_tick();
    ui.tick++; upload(); dirty = true;
  });
  bind('[data-reset]', 'click', () => {
    wasm._moore26_clear(); ui.tick = 0;
    rStep = 1; lowT = highT = null;
    upload(); dirty = true;
    say(ui.drive ? 'cleared — spokes are still feeding' : 'cleared — cold vacuum');
  });
  toggle('[data-drive]', 'drive',
    'convergent feed on — 26 photon spokes pouring at the core',
    'feed cut — the core starves');
  toggle('[data-beam]', 'beam',
    '+x photon beam on — the probe stream',
    'beam off');
  const lumpBtn = root.querySelector('[data-lump]');
  const tubeBtn = root.querySelector('[data-tube]');
  const setLumpArm = (on) => {
    ui.lumpArm = on;
    canvas.style.cursor = on ? 'crosshair' : '';
    if (lumpBtn) { lumpBtn.classList.toggle('armed', on); lumpBtn.setAttribute('aria-pressed', String(on)); }
    say(on ? 'lump tool armed — tap the slice plane to drop a wound knot · ⌖ to cancel' : '', 0);
  };
  const setTubeArm = (on) => {
    ui.tubeArm = on;
    canvas.style.cursor = on ? 'crosshair' : '';
    if (tubeBtn) { tubeBtn.classList.toggle('armed', on); tubeBtn.setAttribute('aria-pressed', String(on)); }
    say(on ? 'tube tool armed — tap to paint a saturated flux string · — to cancel' : '', 0);
  };
  bind('[data-lump]', 'click', () => { setTubeArm(false); setLumpArm(!ui.lumpArm); });
  bind('[data-tube]', 'click', () => { setLumpArm(false); setTubeArm(!ui.tubeArm); });
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
    const dock = root.querySelector('.cascade-dock');
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

  // orientation gizmo
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
    full:    { yaw: 0.7,  pitch: 0.45, dist: 80,  zCenter: D3 >> 1, zThick: D3 },
    core:    { yaw: 0.9,  pitch: 0.6,  dist: 45,  zCenter: D3 >> 1, zThick: D3 },
    slab:    { yaw: 0.7,  pitch: 0.15, dist: 110, zCenter: D3 >> 1, zThick: 4 },
    side:    { yaw: 0.35, pitch: 0.10, dist: 120, zCenter: D3 >> 1, zThick: D3 },
    lattice: { yaw: 0.7,  pitch: 0.6,  dist: 110, zCenter: D3 >> 1, zThick: 1 },
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
    const dpr = Math.min(1.5, devicePixelRatio || 1);
    const w = canvas.clientWidth * dpr | 0, h = canvas.clientHeight * dpr | 0;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; dirty = true; }
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // ---------- main loop ----------
  upload();
  let raf = 0, lastT = performance.now(), fps = 0, lastDrawT = 0;
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

    /* pause freezes everything — ticks AND camera drift (a paused
     * sim that still rotates reads as 'still running' to the eye) */
    if (ui.turntable && ui.playing && now - lastInteract > 4000) { tgt.yaw += 0.0014; dirty = true; }

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
      ui.tickDebt = Math.min(ui.tickDebt + dt, 2000);
      const quantum = 1000 / ui.tps;
      let spent = 0;
      while (ui.tickDebt >= quantum && spent < ui.budget) {
        const t0 = performance.now();
        if (ui.drive || ui.beam) inject();
        wasm._moore26_tick();
        const ms = performance.now() - t0;
        spent += ms;
        ui.tick++;
        ui.tickDebt -= quantum;
        ui.tickMs = ui.tickMs * 0.9 + ms * 0.1;
        if (ui.tickMs > ui.budget) break;
      }
      lastSpent = spent;
      if (ui.tick > 0 && spent > 0) { upload(); dirty = true; }
    } else lastSpent = 0;

    resize();
    if (dirty && now - lastDrawT >= 33) {
      lastDrawT = now;
      const proj = m4.persp(0.9, canvas.width / Math.max(1, canvas.height), 1, 1200);
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
      const mass = wasm._moore26_sum(0), wind = wasm._moore26_sum(1);
      const phot = wasm._moore26_sum(2), chg = wasm._moore26_sum(4);
      const cx = wasm._moore26_cm(0) / 256, cyy = wasm._moore26_cm(1) / 256, cz = wasm._moore26_cm(2) / 256;
      const cm = mass > 0 ? `core@(${cx.toFixed(1)},${cyy.toFixed(1)},${cz.toFixed(1)})` : 'no knot';
      hud.textContent = `${ui.playing ? '' : 'PAUSED · '}t${ui.tick} · mass=${mass} · wind=${(wind/1000).toFixed(0)}k · phot=${phot} · |q|=${chg} · ${cm} · ${fps.toFixed(0)}fps · ${ui.tickMs.toFixed(0)}ms/t`;
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
