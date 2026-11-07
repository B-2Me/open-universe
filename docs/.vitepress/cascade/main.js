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
 *   ☀ drive — convergent quantum feed (26 spokes aimed at the core)
 *   ➤ beam  — +x quantum stream (the hexbuckle probe)
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
uniform sampler3D u_vol2;   // RGBA8: r=packets(flux) g=dd handedness(+128)
uniform mat4 u_mvp;
uniform float u_size;
uniform float u_z_center, u_z_thickness;
uniform float u_ghost_alpha;
uniform float u_qmin;
uniform int u_colorMode;    // 0=structure 1=wake 2=thermal 3=pol 4=composite 5=current 6=handed
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
  vec4 rg2 = texelFetch(u_vol2, ivec3(x, y, z), 0);
  float strc = rg.r * 255.0;
  float ph   = rg.g * 255.0;
  float ht   = rg.b * 255.0;
  float chg  = rg.a * 255.0;   // biased 127 = neutral
  float pk   = rg2.r * 255.0;  // packets in flight — rail current
  float dds  = rg2.g * 255.0;  // signed dd — 128 neutral
  float d = max(strc, max(ph, max(ht, abs(chg - 127.0) * 2.0)));
  d = max(d, max(pk, abs(dds - 128.0) * 2.0));
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
  } else if (u_colorMode == 5) {
    // current — packets in flight: electric white-gold stream
    float pw = pk / 255.0;
    rgb = mix(vec3(0.10,0.06,0.00), vec3(1.0,0.85,0.35), pw)
        * (0.3 + 1.2 * pw);
  } else if (u_colorMode == 6) {
    // handedness — dd divergence: cool indigo (-dd coil) vs
    // warm amber (+dd coil); neutral structure hides
    float dv = (dds - 128.0) / 127.0;                    // -1..+1
    rgb = dv < 0.0
        ? mix(vec3(0.02,0.04,0.25), vec3(0.30,0.60,1.00), -dv)
        : mix(vec3(0.25,0.08,0.02), vec3(1.00,0.62,0.12), dv);
    rgb *= 0.25 + 1.1 * abs(dv);
  } else {
    rgb = strcRamp * (0.35 + 0.85 * strc / 255.0);
  }
  rgb = rgb * 1.3 + vec3(0.02);   // additive saturates — lower gain keeps color
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
  float a = exp(-r2 * 6.0);
  /* additive output — overlapping glows brighten, nothing occludes:
   * this is what makes the billboards read as transparent light. */
  frag = vec4(v_color.rgb * v_color.a * a, 1.0);
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
  // Threaded build (moore26-mt, emsdk 6.0.13 + OpenMP) gives ~4-5x
  // the tick rate — but needs SharedArrayBuffer, which requires a
  // crossOriginIsolated page (COOP+COEP). Feature-detect and fall
  // back to the single-threaded build transparently.
  say('loading engine…');
  const canMT = typeof SharedArrayBuffer !== 'undefined' &&
                (typeof crossOriginIsolated === 'undefined' || crossOriginIsolated);
  const mtUrl = wasmUrl.replace(/moore26\.js$/, 'moore26-mt.js');
  const mtdUrl = wasmUrl.replace(/moore26\.js$/, 'moore26-mtd.js');
  const mtnmUrl = wasmUrl.replace(/moore26\.js$/, 'moore26-mtnm.js');
  /* mt is opt-in (?mt or opts.useMT): the 8-thread build works (verified
   * ~4.4x in Node) but the browser worker bootstrap errors — noisy
   * default. ?mtd loads the PTHREADS_DEBUG+ASSERTIONS build for the
   * real worker error instead of 'undefined:undefined'. */
  const qs = new URLSearchParams(location.search);
  /* mt is the DEFAULT when SharedArrayBuffer + crossOriginIsolated are
     available (verified ~5x). ?st / opts.noMT forces single-threaded. */
  /* mt is opt-in (?mt / ?mtnm / ?mtnmd / ?mtd) — a wasm OpenMP tick
   * trades CPU for latency; st is the default so the page doesn't
   * pin extra cores unless asked */
  const wantMT = canMT && (qs.has('mt') || qs.has('mtnm') || qs.has('mtnmd') || qs.has('mtd'));
  const useDebug = qs.has('mtd');
  const useNM = qs.has('mtnm') || qs.has('mtnmd');
  const loadScript = (src) => new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = src; sc.onload = res; sc.onerror = () => rej(new Error('load failed: ' + src));
    document.head.appendChild(sc);
  });
  let wasm = null;
  let mtLive = 0;   // nonzero when a threaded engine actually booted
  /* Not isolated and no header path (static host)? Arm the COI service
   * worker — it reloads once with COOP+COEP so SharedArrayBuffer turns
   * on. The dev server sends the headers itself, so this no-ops here. */
  if (!canMT) {
    try { await loadScript('/coi-serviceworker.js'); } catch (_) {}
  }
  /* ?mtnm loads the NON-modular build — MODULARIZE glue defines the
   * factory but doesn't auto-run inside spawned workers (they eval it,
   * define the export, and sit silent -> 'loading-workers' hangs).
   * Non-modular glue auto-initializes inside the worker — the model
   * pthread workers are actually designed around. */
  if (useNM) {
    /* non-modular glue auto-runs but has no Module.ready promise —
     * gate on onRuntimeInitialized (fires only after the pthread pool
     * is up). ?mtnm loads the release build, ?mtnmd the PTHREADS_DEBUG
     * variant for real worker errors. */
    const nmSrc = qs.has('mtnmd') ? mtnmUrl.replace('moore26-mtnm.js', 'moore26-mtnmd.js') : mtnmUrl;
    try { await loadScript(nmSrc); } catch (_) { }
    if (typeof Module !== 'undefined') {
      try {
        wasm = await Promise.race([
          new Promise(res => { Module.onRuntimeInitialized = () => res(Module); }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('mtnm boot timeout')), 8000)),
        ]);
        mtLive = 2;
        say(`moore26-mtnm — non-modular OpenMP ×${mtLive}`, 4000);
      } catch (e) { wasm = null; say('mtnm unavailable — falling back', 4000); }
    }
  } else {
    const mtFactory = useDebug ? 'createMoore26MTD' : 'createMoore26MT';
    const mtSrc = useDebug ? mtdUrl : mtUrl;
    if (wantMT && typeof globalThis[mtFactory] === 'undefined') {
      try { await loadScript(mtSrc); } catch (_) { /* fall through to st */ }
    }
    if (wantMT && typeof globalThis[mtFactory] !== 'undefined') {
      say('instantiating threaded wasm…');
      try {
        /* locateFile + absolute mainScriptUrlOrBlob: workers resolve
         * relative paths differently than the main thread — the wasm
         * fetch inside the worker silently 404s/fails without the
         * absolute URL (the 'undefined:undefined' silent error). */
        const abs = (p) => new URL(p, location.href).href;
        wasm = await Promise.race([
          globalThis[mtFactory]({
            mainScriptUrlOrBlob: abs(mtSrc),
            locateFile: (path) => path.endsWith('.wasm') ? abs('/wasm/cascade/' + path) : path,
          }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('mt boot timeout')), 6000)),
        ]);
        mtLive = 2;
        say(useDebug ? `moore26-mtd — debug OpenMP ×${mtLive}` : `moore26-mt — OpenMP ×${mtLive}`, 4000);
      } catch (e) { wasm = null; say('mt unavailable — falling back to single-threaded', 4000); }
    }
  }
  if (!wasm) {
    if (typeof createMoore26 === 'undefined') await loadScript(wasmUrl);
    say('instantiating wasm…');
    wasm = await createMoore26();
  }
  const dw = parseInt(qs.get('w') || '0');
  const [W3, H3, D3] = opts.dims || (dw >= 16 ? [dw, dw, dw] : [32, 32, 32]);   // power-of-2 required;
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

  // Convergent quantum feed: each channel sources quantums at a point
  // RAY cells back along its direction — 26 spokes aimed at the core.
  // Pressure-regulated: stops pouring once the spoke cell is full, so
  // the field equilibrates against absorption instead of saturating
  // to white at 32^3.
  const RAY = 3, FEED_CAP = 2, FEED_NU = 96, BEAM_CAP = 10;
  /* packets live only on the even sublattice — snap a source cell so
   * x+y+z is even (nudge z) or the packet freezes on an interstitial */
  const evenSnap = (x, y, z) => ((x + y + z) & 1) ? [x, y, z + 1] : [x, y, z];
  /* precomputed feed table — a fixed set of shell sources + aimed
   * channels, cycled through per tick. The substrate is 0.1fm cells:
   * runtime Math.random per packet buys nothing over a deterministic
   * seeded table, and 256 sources is plenty of variation. Same field
   * every boot — runs are reproducible. */
  const FEED_TBL = [];
  {
    const FEED_R = Math.round(Math.min(W3, H3, D3) * 0.4);
    const br = FEED_R / 2;
    let seed = 0x9e3779b9;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000;
    for (let k = 0; k < 1024; k++) {
      const th = rnd() * 2 * Math.PI;
      const ph = Math.acos(2 * rnd() - 1);
      let [sx, sy, sz] = evenSnap(
        Math.round(CX + FEED_R * Math.sin(ph) * Math.cos(th)),
        Math.round(CY + FEED_R * Math.sin(ph) * Math.sin(th)),
        Math.round(CZ + FEED_R * Math.cos(ph)));
      const dx = CX + br * (rnd() * 2 - 1) - sx;
      const dy = CY + br * (rnd() * 2 - 1) - sy;
      const dz = CZ + br * (rnd() * 2 - 1) - sz;
      let bc = 6, bs = -1;
      for (let c = 6; c < 18; c++) {
        const sc = CV[c][0] * dx + CV[c][1] * dy + CV[c][2] * dz;
        if (sc > bs) { bs = sc; bc = c; }
      }
      FEED_TBL.push([sx, sy, sz, bc]);
    }
  }
  let feedIdx = 0;
  /* two separate equilibria — the feed is a bulk bath (global packet
   * budget), the beam is a rate-limited probe stream (per-cell cap
   * keeps its sources topped up). A shared pool would let the feed
   * starve the beam to nothing. */
  const FEED_BUDGET = 512;
  const inject = () => {
    const room = Number(wasm._moore26_sum(2)) < FEED_BUDGET;
    for (let c = 6; c < 18; c++) {          /* FCC transport: edge channels only */
      const [vx, vy, vz] = CV[c];
      /* a beam on FCC: no pure +x exists, and the 4-edge family fans
       * into a cone. One edge channel (6 = {1,1,0}) is a straight
       * line — a real collimated stream. */
      const isBeam = ui.beam && c === 6;
      if (isBeam) {
        /* the beam is a probe stream on {1,1,0} — it drifts +y as it
         * advances, so a CY-centered source misses the core entirely.
         * Offset the source down by the travel distance: y = CY - (CX-2)
         * climbs +y through the center, then exits the far corner. */
        for (let dy = -2; dy <= 2; dy++)
          for (let dz = -1; dz <= 1; dz++) {
            let [sx, sy, sz] = evenSnap(2, CY - (CX - 2) + dy, CZ + dz);
            if (sy < 1 || sy >= H3 - 1 || sz < 1 || sz >= D3 - 1) continue;
            const cur = wasm._moore26_packet_get(sx, sy, sz, c);
            if (cur < BEAM_CAP) {
              wasm._moore26_packet_set(sx, sy, sz, c, cur + 2);
              wasm._moore26_packet_nu_set(sx, sy, sz, c, FEED_NU);
            }
          }
      }
    }
    if (ui.drive && room) {
      /* spherical feed — sources scattered on a shell at FEED_R,
       * each firing the edge channel aimed at the core. Isotropic
       * rain instead of 12 axis rays — the visible sphere. The
       * FEED_BUDGET cap keeps convergence from saturating. */
      for (let k = 0; k < 16; k++) {
        const [sx, sy, sz, bc] = FEED_TBL[feedIdx = (feedIdx + 1) & 1023];
        const cur = wasm._moore26_packet_get(sx, sy, sz, bc);
        if (cur < FEED_CAP) {
          wasm._moore26_packet_set(sx, sy, sz, bc, cur + 1);
          wasm._moore26_packet_nu_set(sx, sy, sz, bc, FEED_NU);
        }
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
      for (let e = 3; e < 6; e++) {         // edge wound pairs (xy+xz) —
                                            // face pairs are dead under FCC
        wasm._moore26_winding_set(x, y, z, 2 * e, LUMP_W);
        wasm._moore26_winding_set(x, y, z, 2 * e + 1, LUMP_W);
      }
      n++;
    }
    return n;
  };

  // ——: paint a stretched flux tube at the picked point — two mass
  // anchors joined by a saturated winding run on the {1,1,0} EDGE pair
  // (channels 6/7 — the +/-x face pair is a dead register under the
  // FCC gate). The tube runs the lattice diagonal so its axis is a
  // real transport direction. The signature demo: >=12 saturated
  // nodes triggers macroscopic string-breaking — charged fragments.
  const seedTube = (lx, ly, lz) => {
    const half = 8;
    let n = 0;
    for (let i = -half; i <= half; i++) {
      const x = lx + i, y = ly + i, z = lz;
      if (x < 1 || x >= W3 - 1 || y < 1 || y >= H3 - 1) continue;
      if (i === -half || i === half) wasm._moore26_mass_set(x, y, z, 512);
      wasm._moore26_winding_set(x, y, z, 6, 128);
      wasm._moore26_winding_set(x, y, z, 7, 128);
      n++;
    }
    return n;
  };

  /* best edge channel for a direction — every string segment picks
   * its own channel pair so bends stay on live transport axes */
  const pickChan = (dx, dy, dz = 0) => {
    let best = 6, bs = -1;
    for (let c = 6; c < 18; c++) {
      const s = CV[c][0] * dx + CV[c][1] * dy + CV[c][2] * dz;
      if (s > bs) { bs = s; best = c; }
    }
    return best;
  };

  /* hexbuckle — the ensemble's bent flux string: a parabolic U-bend
   * (dip depth D) with mass anchors at the ends. The curvature is
   * the flexoelectric subject — bombard it and watch the charge
   * dipole. */
  const seedBuckle = (D = 16) => {
    const A = W3 >> 3;
    const pts = [];
    for (let t = 0; t <= 1.0001; t += 0.05)
      pts.push([Math.round(CX + A * (2 * t - 1)),
                Math.round(CY - D / 2 + D * (4 * t * (1 - t))), CZ]);
    wasm._moore26_mass_set(pts[0][0], pts[0][1], CZ, 512);
    const [ex, ey] = pts[pts.length - 1];
    wasm._moore26_mass_set(ex, ey, CZ, 512);
    let n = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x, y] = pts[i], [nx, ny] = pts[i + 1];
      const c = pickChan(nx - x, ny - y);
      wasm._moore26_winding_set(x, y, CZ, c, 128);
      wasm._moore26_winding_set(x, y, CZ, c ^ 1, 128);
      n++;
    }
    return n;
  };

  /* ——— verified-species seeds ————————————————————————————————
   * these recipes come straight out of the headless census runs —
   * same channel tables, same parity rules, same windings that
   * produced persistent currents, wound balls, and ev6 fractures */

  /* ring — a closed {111} waveguide: channels [6,12,16,7,13,17]
   * with engine vectors {1,1,0},{1,0,-1},{0,1,-1},{-1,-1,0},
   * {-1,0,1},{0,-1,1} sum to zero — a true closed loop on even
   * cells. rail_gate makes it a lossless persistent current:
   * packets ride the dominant member, skip negotiation, and the
   * decay exemption keeps them alive indefinitely. */
  const RING_CH = [6, 12, 16, 7, 13, 17];
  const seedRing = (cx, cy, cz, stream = 3) => {
    let x = cx, y = cy, z = cz, n = 0;
    for (let i = 0; i < 6; i++) {
      const c = RING_CH[i];
      for (let e = 0; e < 13; e++) {
        wasm._moore26_winding_set(x, y, z, 2 * e, 20);
        wasm._moore26_winding_set(x, y, z, 2 * e + 1, 20);
      }
      wasm._moore26_winding_set(x, y, z, c, 110);   // dominant member
      if (stream) {
        wasm._moore26_packet_set(x, y, z, c, stream);
        wasm._moore26_packet_nu_set(x, y, z, c, 128);
      }
      const v = CV[c];
      x += v[0]; y += v[1]; z += v[2]; n++;
    }
    return n;
  };

  /* wound ball — the spinning condenser: r≤3 ball, every edge pair
   * wound 120/180 (bias sign picks the handedness), mass spark 10.
   * bias>0 → -dd (the sterile churning species); bias<0 → +dd (the
   * accreting species — ~1.7x the mass: the substrate chirality). */
  const seedWound = (cx, cy, cz, bias) => {
    const a = bias > 0 ? 120 : 180, b = bias > 0 ? 180 : 120;
    let n = 0;
    for (let dz = -3; dz <= 3; dz++)
    for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 3; dx++) {
      if (dx * dx + dy * dy + dz * dz > 9) continue;
      const x = cx + dx, y = cy + dy, z = cz + dz;
      if (x < 0 || x >= W3 || y < 0 || y >= H3 || z < 0 || z >= D3) continue;
      for (let e = 0; e < 13; e++) {
        wasm._moore26_winding_set(x, y, z, 2 * e, a);
        wasm._moore26_winding_set(x, y, z, 2 * e + 1, b);
      }
      wasm._moore26_mass_set(x, y, z, 10);
      n++;
    }
    return n;
  };

  /* chiral pair — one of each handedness. The -dd ball churns and
   * stays small; the +dd ball accretes ~1.7x — the parity-violating
   * asymmetry side by side. Flip the View to 'handed' to see the
   * coils' opposite sign. */
  const seedPair = (cx, cy, cz) => {
    const n = seedWound(cx - 6, cy, cz, 1) + seedWound(cx + 6, cy, cz, -1);
    return n;
  };

  /* meson — two -dd condensers joined by a heavy tube (winding 200
   * dominant member on the ch6/8 zigzag — outranks the knots' own
   * 180 so the rail pierces their shells). The strong-force demo:
   * the tube mediates traffic; watch 'current' view. */
  const seedMeson = (cx, cy, cz) => {
    let n = seedWound(cx - 6, cy, cz, 1) + seedWound(cx + 6, cy, cz, 1);
    let x = cx - 4, y = cy, i = 0;
    while (x <= cx + 4) {
      for (let e = 0; e < 13; e++) {
        wasm._moore26_winding_set(x, y, cz, 2 * e, 25);
        wasm._moore26_winding_set(x, y, cz, 2 * e + 1, 25);
      }
      wasm._moore26_winding_set(x, y, cz, i % 2 ? 8 : 6, 200);
      x += 1; y += i % 2 ? -1 : 1; i++; n++;
    }
    return n;
  };

  /* scenario dispatch — shared by the Scenario select AND reset,
   * so ⟲ restores the same seed every time. */
  const seedScenario = (s) => {
    /* scenario-specific registers: ring needs the rail bypass ON
     * (persistent current); the rest run negotiation as normal */
    wasm._moore26_rail_gate_set(s === 'ring' ? 64 : 0);
    if (s === 'tube') return seedTube(CX, CY, CZ);
    if (s === 'lump') return seedLump(CX, CY, CZ);
    if (s === 'buckle') return seedBuckle(16);
    if (s === 'ring') return seedRing(CX - 2, CY, CZ);   // even-parity
                                                        // start — odd
                                                        // cells can't
                                                        // carry packets
    if (s === 'wound') return seedWound(CX, CY, CZ, 1);
    if (s === 'pair') return seedPair(CX, CY, CZ);
    if (s === 'meson') return seedMeson(CX, CY, CZ);
    return 0;
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
    'u_ghost_alpha', 'u_qmin', 'u_colorMode', 'u_vol2',
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
  const tex2 = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_3D, tex2);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, W3, H3, D3, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
    [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE]])
    gl.texParameteri(gl.TEXTURE_3D, k, v);
  gl.uniform1i(U.u_vol2, 1);
  gl.activeTexture(gl.TEXTURE0);
  /* stale mt/-nm glue may predate rg2 — upload a zeroed texture so
   * current/handed views degrade to dark rather than crashing */
  const hasRg2 = typeof wasm._moore26_rg2_refresh === 'function';
  const zeroTex = hasRg2 ? null : (() => {
    const z = new Uint8Array(N3 * 4);
    for (let i = 1; i < z.length; i += 4) z[i] = 128;  // neutral handedness
    return z;
  })();
  const upload = () => {
    wasm._moore26_rg_refresh();
    if (hasRg2) wasm._moore26_rg2_refresh();
    /* refresh both buffers BEFORE grabbing the heap view — the rg
     * mallocs can grow wasm memory and invalidate a stale h8. */
    const rgPtr = wasm._moore26_rg_pointer();
    const rg2Ptr = hasRg2 ? wasm._moore26_rg2_pointer() : 0;
    const h8 = wasm.HEAPU8 || new Uint8Array(wasm.wasmMemory.buffer);
    gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, 0, W3, H3, D3, gl.RGBA, gl.UNSIGNED_BYTE,
      h8.subarray(rgPtr, rgPtr + N3 * 4));
    gl.activeTexture(gl.TEXTURE1);
    gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, 0, W3, H3, D3, gl.RGBA, gl.UNSIGNED_BYTE,
      hasRg2 ? h8.subarray(rg2Ptr, rg2Ptr + N3 * 4) : zeroTex);
    gl.activeTexture(gl.TEXTURE0);
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
  gl.depthMask(false);          // additive glow must not write depth —
                                // a near dim quad would occlude a far
                                // bright one (the black-disc artifact)
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);   // additive — transparent glow, overlaps brighten

  // ---------- camera ----------
  const cam = { yaw: 0.7, pitch: 0.45, dist: 70, cx: cenX, cy: cenY, cz: cenZ };
  const tgt = { ...cam };
  let lastInteract = 0, dirty = true;
  const poke = () => { lastInteract = performance.now(); };
  let dragging = false, lx = 0, ly = 0;
  /* suppress the browser context menu — right-drag is camera control */
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    poke();
    /* left button paints when a tool is armed — right/middle drag is
     * always camera orbit, tool or not */
    if (e.button === 0 && (ui.lumpArm || ui.tubeArm)) {
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
    /* accumulate from the RENDERED orientation — cam lags tgt during
     * a drag, so adding to stale tgt makes the view jump */
    tgt.yaw = cam.yaw; tgt.pitch = cam.pitch;
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
    qmin: 1, size: 0.7, colorMode: 4, tps: 4, tickDebt: 0,
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
  bind('[data-play]', 'click', e => { ui.playing = !ui.playing; const g = e.currentTarget.querySelector('.g'); if (g) g.textContent = ui.playing ? '⏸' : '▶'; else e.currentTarget.textContent = ui.playing ? '⏸' : '▶'; });
  bind('[data-step]', 'click', () => {
    if (ui.drive || ui.beam) inject();
    wasm._moore26_tick();
    ui.tick++; upload(); dirty = true;
  });
  bind('[data-reset]', 'click', () => {
    /* re-init = full scenario reset, not just clear — restores the
     * initial quiet field the feed/beam/lump tools build on. */
    wasm._moore26_init(W3, H3, D3); ui.tick = 0;
    rStep = 1; lowT = highT = null;
    /* reset restores the CURRENT scenario (re-seed, keep toggles) —
     * without this, reset always dropped to cold vacuum */
    seedScenario(ui.scenario);
    upload(); dirty = true;
    say(ui.drive ? 'cleared — spokes are still feeding' : 'cleared — cold vacuum');
  });

  bind('[data-scenario]', 'change', e => {
    wasm._moore26_init(W3, H3, D3); ui.tick = 0;
    rStep = 1; lowT = highT = null;
    /* a scenario REPLACES the scene: clear + restore default toggles
     * (feed on, beam/tools off) so the seed isn't drowned by whatever
     * was running — reset alone keeps toggles untouched. */
    /* the feed floods the flexoelectric signal (buckle) and drowns
     * a persistent current (ring) — both get a clean field;
     * accreting species keep the feed on */
    ui.scenario = e.target.value;
    ui.drive = ui.scenario !== 'buckle' && ui.scenario !== 'ring';
    ui.beam = false; ui.lumpArm = false; ui.tubeArm = false;
    const tSync = (sel, on) => { const b = root.querySelector(sel); if (b) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); } };
    tSync('[data-drive]', ui.drive); tSync('[data-beam]', false);
    const s = ui.scenario;
    seedScenario(s);
    upload(); dirty = true;
    say(s === 'vacuum' ? 'cold vacuum' : `seeded ${s}`);
  });
  toggle('[data-drive]', 'drive',
    'convergent feed on — 26 quantum spokes pouring at the core',
    'feed cut — the core starves');
  toggle('[data-beam]', 'beam',
    '+x quantum beam on — the probe stream',
    'beam off');
  /* armed-tool cursor — white crosshair edged in black: reads on the
   * dark canvas AND any bright field underneath (a fixed cursor can't
   * sample the pixel under it, so carry both colors). */
  const TOOL_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">' +
    '<path d="M12 3v18M3 12h18" stroke="black" stroke-width="4.5" stroke-linecap="round"/>' +
    '<path d="M12 3v18M3 12h18" stroke="white" stroke-width="2" stroke-linecap="round"/>' +
    '</svg>')}") 12 12, crosshair`;
  const lumpBtn = root.querySelector('[data-lump]');
  const tubeBtn = root.querySelector('[data-tube]');
  const setLumpArm = (on) => {
    ui.lumpArm = on;
    canvas.style.cursor = on ? TOOL_CURSOR : '';
    if (lumpBtn) { lumpBtn.classList.toggle('armed', on); lumpBtn.setAttribute('aria-pressed', String(on)); }
    say(on ? 'lump tool armed — tap the slice plane to drop a wound knot · ⌖ to cancel' : '', 0);
  };
  const setTubeArm = (on) => {
    ui.tubeArm = on;
    canvas.style.cursor = on ? TOOL_CURSOR : '';
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
  /* ? help cards — one delegated listener covers every chip. The card
   * floats in the overlay stack until dismissed. */
  const HELP = {
    'grp-time': ['time controls', '⏸ play/pause the tick loop · ⏭ step exactly one tick · ⟲ reset — re-initializes the quiet field scenario.'],
    'grp-ops': ['session ops', '⟳ orbit — turntable camera; double-click the gizmo to reset the view.'],
    'grp-inject': ['injection tools', 'things that add to the field: ☀ feed — convergent 26-spoke quantum drive · ➤ beam — +x quantum stream, the probe bombardment · ⌖ lump — arm, then click the lattice to drop a wound knot · — tube — arm, then click to paint a saturated flux string and watch it fracture.'],
    focus: ['Focus', 'camera presets — named orbits plus a matched slice jump. Double-tap the gizmo to reset to Full lattice.'],
    view: ['View', 'render channel — composite: all layers · structure: occupancy · wake: phase · thermal: rest mass · pol: net charge · current: packets in flight (rail streams) · handed: dd coil handedness (indigo -dd, amber +dd).'],
    scenario: ['Scenario', 'reseed the field — vacuum: cold lattice · flux tube: saturated string, fractures at 12+ nodes · wound lump: bound knot · hexbuckle: U-bent flexoelectric probe · ring: closed {111} waveguide — persistent current (try the current view) · wound: the spinning condenser species · pair: one knot of each handedness — watch the +dd one out-accrete (chirality) · meson: two condensers on a heavy flux tube — the strong-force demo.'],
    slice: ['Slice', 'position of the slice plane — cells outside the Width window ghost to silhouettes. Shift+scroll on the canvas scrubs it.'],
    slab: ['Width', 'slice thickness in cells — max shows the whole volume, 1 isolates a single lattice plane.'],
    size: ['Size', 'billboard size per cell — pure cosmetics. Bigger fuses the lattice into foam, smaller resolves the discrete sites.'],
    speed: ['Speed', 'tick governor in ticks/sec — c here is 1 cell/tick, so uncapped the lattice outruns the eye.'],
    qmin: ['Q≥', 'density floor — a cell is clipped unless its brightest channel reads at least this. Raise it to strip haze and expose skeletons.'],
    zoom: ['Zoom', 'camera distance — same as scroll/pinch or the lens dial at the canvas edge.'],
  };
  const card = root.querySelector('[data-card]');
  const cardTitle = root.querySelector('[data-card-title]');
  const cardBody = root.querySelector('[data-card-body]');
  let cardKey = null;
  const showCard = (key) => {
    const h = HELP[key]; if (!h || !card) return;
    /* same chip a second time = toggle closed */
    if (!card.hidden && cardKey === key) { card.hidden = true; cardKey = null; return; }
    cardTitle.textContent = h[0]; cardBody.textContent = h[1];
    card.hidden = false; cardKey = key;
  };
  /* one suppression for every element in the sim — canvas, widgets,
   * dock, overlays. Right-drag stays camera/tool control. */
  root.addEventListener('contextmenu', e => e.preventDefault());
  root.addEventListener('click', e => {
    const hb = e.target.closest('[data-help]');
    if (hb) { e.preventDefault(); showCard(hb.dataset.help); }
    else if (e.target.closest('[data-card-x]')) { card.hidden = true; cardKey = null; }
    else if (e.target.closest('[data-copy]')) {
      const txt = hud?.textContent || '';
      navigator.clipboard?.writeText(txt).then(() => {
        const b = e.target.closest('[data-copy]');
        if (b) { b.textContent = '✓'; setTimeout(() => b.textContent = '⧉', 900); }
      });
    }
  });

  bind('[data-tune]', 'click', e => {
    const dock = root.querySelector('.cascade-dock');
    const open = dock?.classList.toggle('tune-open');
    e.currentTarget.setAttribute('aria-expanded', String(!!open));
  });
  // zoom lens — radial-drag dial floating on the canvas (Mill pattern):
  // drag up = zoom in, down = zoom out; double-click resets.
  const zlens = root.querySelector('[data-zoomlens]');
  const zctx = zlens?.getContext('2d');
  if (zlens && zctx) {
    let zy = null;
    zlens.addEventListener('contextmenu', e => e.preventDefault());
    zlens.addEventListener('pointerdown', e => {
      zy = e.clientY; zlens.setPointerCapture(e.pointerId);
    });
    zlens.addEventListener('pointermove', e => {
      if (zy === null) return;
      tgt.dist = Math.max(8, Math.min(400, tgt.dist + (e.clientY - zy) * 0.5));
      zy = e.clientY; dirty = true;
    });
    zlens.addEventListener('pointerup', () => { zy = null; syncZoom(); });
    zlens.addEventListener('dblclick', e => { e.preventDefault(); tgt.dist = 80; dirty = true; });
  }
  const drawLens = () => {
    if (!zctx) return;
    const S = zlens.width, c = S / 2, R = S * 0.42;
    zctx.clearRect(0, 0, S, S);
    zctx.strokeStyle = 'rgba(160, 200, 255, 0.22)';
    zctx.lineWidth = S * 0.016;
    zctx.beginPath(); zctx.arc(c, c, R, 0, 7); zctx.stroke();
    const zoom = 80 / tgt.dist;
    zctx.fillStyle = 'rgba(127, 255, 238, 0.95)';
    zctx.font = `600 ${S * 0.21}px monospace`;
    zctx.textAlign = 'center'; zctx.textBaseline = 'middle';
    zctx.fillText(zoom.toFixed(1) + 'x', c, c);
  };

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
    gizmo.addEventListener('contextmenu', e => e.preventDefault());
    /* drag on the gizmo orbits the camera (either button); a plain
     * tap keeps the double-tap-reset behavior */
    let gDown = null, gDrag = false;
    gizmo.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      gDown = [e.clientX, e.clientY]; gDrag = false;
      tgt.yaw = cam.yaw; tgt.pitch = cam.pitch;
      gizmo.setPointerCapture(e.pointerId);
    });
    gizmo.addEventListener('pointermove', e => {
      if (!gDown) return;
      const dx = e.clientX - gDown[0], dy = e.clientY - gDown[1];
      if (Math.abs(dx) + Math.abs(dy) > 3) gDrag = true;
      if (gDrag) {
        tgt.yaw += dx * 0.008;
        tgt.pitch = Math.max(-1.4, Math.min(1.4, tgt.pitch + dy * 0.008));
        gDown = [e.clientX, e.clientY];
        dirty = true;
      }
    });
    gizmo.addEventListener('pointerup', () => {
      if (gDown && !gDrag) {
        const t = performance.now();
        if (t - lastTap < 330) resetView();
        lastTap = t;
      }
      gDown = null;
    });
  }
  bind('[data-uitoggle]', 'click', () => root.classList.toggle('dock-hidden'));
  bind('[data-fs]', 'click', () => {
    const el = root;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  });

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
      drawGizmo(); drawLens();
      dirty = false;
    }

    if (hud && (ui.tick < 10 || ui.tick % 10 === 0 || !ui.playing)) {
      /* i64 exports marshal as BigInt in the threaded (emsdk 6.x)
       * build — coerce to Number so arithmetic doesn't throw. */
      const mass = Number(wasm._moore26_sum(0)), wind = Number(wasm._moore26_sum(1));
      const phot = Number(wasm._moore26_sum(2)), chg = Number(wasm._moore26_sum(4));
      const cx = Number(wasm._moore26_cm(0)) / 256, cyy = Number(wasm._moore26_cm(1)) / 256, cz = Number(wasm._moore26_cm(2)) / 256;
      const cm = mass > 0 ? `core@(${cx.toFixed(1)},${cyy.toFixed(1)},${cz.toFixed(1)})` : 'no knot';
      /* relative clock: 1 tick = light crossing 1 node = 0.1fm/c
       * (~3.3e-25 s) — same convention as the size scale. */
      const age = Math.round(ui.tick * 0.1);
      hud.textContent = `${ui.playing ? '' : 'PAUSED · '}T=${age}fm/c · mass=${mass} · wind=${(wind/1000).toFixed(0)}k · pkt=${phot} · |q|=${chg} · ${cm} · ${fps.toFixed(0)}fps · ${ui.tickMs.toFixed(0)}ms/t${mtLive ? `·mt${mtLive}` : ''}`;
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
