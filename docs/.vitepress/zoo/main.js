// Zoo renderer — vtk.js cinematic point-cloud view of dictionary knots.
// initZoo(host) wires a full-screen vtk render window + auto-rotate and
// returns { load(entry), dispose() }; the Vue shell drives selection.
import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData';
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';
import vtkInteractorStyleManipulator from '@kitware/vtk.js/Interaction/Style/InteractorStyleManipulator';
import vtkPlane from '@kitware/vtk.js/Common/DataModel/Plane';

// Spin-class palette — the same visual language as Hopf's Loom:
// equatorial (toroidal) warm gold, zenith cyan, nadir violet, dead slate.
// Slight per-port variation keeps each class from reading as a flat fill.
const SPIN_RGB = [
  [0.20, 0.22, 0.38],                                     // 0 dead
  [1.00, 0.55, 0.10], [1.00, 0.68, 0.20], [1.00, 0.48, 0.12], // 1-3 equatorial
  [1.00, 0.62, 0.16], [1.00, 0.75, 0.28], [0.95, 0.58, 0.10], // 4-6 equatorial
  [0.10, 0.85, 1.00], [0.30, 0.95, 0.95], [0.15, 0.75, 1.00], // 7-9 zenith
  [0.70, 0.40, 1.00], [0.58, 0.45, 1.00], [0.80, 0.35, 0.92], // 10-12 nadir
];

// Fake key light, fixed in world space. Baked into the per-point color so
// the flat point sprites pick up real depth cues — lit limb vs shadow limb.
const LIGHT = (() => {
  const l = Math.hypot(0.4, 0.55, 0.72);
  return [0.4 / l, 0.55 / l, 0.72 / l];
})();

// Aurora ramp for tension, ember ramp for quanta — the two scalar modes
// need distinct palettes or they read as the same bland blue knot.
const buildAuroraLut = () => {
  const lut = vtkColorTransferFunction.newInstance();
  lut.addRGBPoint(0, 0.04, 0.24, 0.42);   // deep teal — lifted off the void
  lut.addRGBPoint(60, 0.02, 0.50, 0.85);
  lut.addRGBPoint(140, 0.15, 0.90, 1.0);
  lut.addRGBPoint(200, 0.70, 1.0, 0.90);
  lut.addRGBPoint(255, 1.0, 1.0, 1.0);
  return lut;
};
const buildEmberLut = () => {
  const lut = vtkColorTransferFunction.newInstance();
  lut.addRGBPoint(0, 0.10, 0.03, 0.05);
  lut.addRGBPoint(60, 0.38, 0.09, 0.07);
  lut.addRGBPoint(140, 0.78, 0.30, 0.10);
  lut.addRGBPoint(200, 0.88, 0.58, 0.28);
  lut.addRGBPoint(255, 0.95, 0.85, 0.62);  // warm cream, not blown-out white
  return lut;
};

const parseBin = (buf) => {
  const dv = new DataView(buf);
  if (dv.getUint32(0, false) !== 0x5a4f4f33) throw new Error('bad ZOO3 magic');
  const w = dv.getUint32(4, true), h = dv.getUint32(8, true), d = dv.getUint32(12, true);
  const n = dv.getUint32(16, true);
  const raw = new Uint8Array(buf, 20);
  const pts = new Float32Array(n * 3), verts = new Uint32Array(n * 2);
  const tension = new Float32Array(n), quanta = new Float32Array(n), painted = new Float32Array(n);
  let tMin = 255, tMax = 1, qMax = 1;
  for (let i = 0; i < n; i++) {
    const o = i * 7;
    pts[i * 3] = raw[o]; pts[i * 3 + 1] = raw[o + 1]; pts[i * 3 + 2] = raw[o + 2];
    verts[i * 2] = 1; verts[i * 2 + 1] = i;
    quanta[i] = raw[o + 3]; tension[i] = raw[o + 5]; painted[i] = raw[o + 6];
    if (tension[i] > tMax) tMax = tension[i];
    if (tension[i] < tMin) tMin = tension[i];
    if (quanta[i] > qMax) qMax = quanta[i];
  }
  // Per-point RGBA: spin-class hue × lambert shade (bbox-center normals vs
  // the key light) × a soft tension luminance. Direct scalars — no LUT.
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += pts[i * 3]; cy += pts[i * 3 + 1]; cz += pts[i * 3 + 2]; }
  cx /= n; cy /= n; cz /= n;
  const colors = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const nx = pts[i * 3] - cx, ny = pts[i * 3 + 1] - cy, nz = pts[i * 3 + 2] - cz;
    const nl = Math.hypot(nx, ny, nz) || 1;
    const lam = Math.max(0, (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / nl);
    const shade = (0.40 + 0.60 * lam) * (0.78 + 0.22 * Math.sqrt(tension[i] / tMax));
    const rgb = SPIN_RGB[Math.min(raw[i * 7 + 4], 12)];
    colors[i * 4] = Math.min(255, rgb[0] * shade * 255);
    colors[i * 4 + 1] = Math.min(255, rgb[1] * shade * 255);
    colors[i * 4 + 2] = Math.min(255, rgb[2] * shade * 255);
    colors[i * 4 + 3] = painted[i] ? 255 : 60;
  }
  // Scalar display modes: compress the real spread across most of the
  // ramp (sqrt for tension, log for quanta — settled knots cluster hard)
  // and fold in the same lambert term so the field has surface texture
  // even where the underlying scalar is nearly uniform.
  const tR = (tMax - tMin) || 1, lq = Math.log1p(qMax) || 1;
  for (let i = 0; i < n; i++) {
    const nx = pts[i * 3] - cx, ny = pts[i * 3 + 1] - cy, nz = pts[i * 3 + 2] - cz;
    const nl = Math.hypot(nx, ny, nz) || 1;
    const lam = Math.max(0, (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / nl);
    tension[i] = Math.min(255, 255 * (0.15 + 0.55 * Math.sqrt((tension[i] - tMin) / tR) + 0.30 * lam));
    quanta[i] = Math.min(255, 255 * (0.15 + 0.55 * (Math.log1p(quanta[i]) / lq) + 0.30 * lam));
    // Accreted flood mass sits behind the skeleton in spin mode; keep it
    // recessed in scalar modes too so the painted structure dominates.
    if (!painted[i]) { tension[i] *= 0.22; quanta[i] *= 0.22; }
  }
  const pd = vtkPolyData.newInstance();
  pd.getPoints().setData(pts, 3);
  pd.getVerts().setData(verts);
  for (const [name, vals, nc] of [['tension', tension, 1], ['quanta', quanta, 1], ['painted', painted, 1], ['colors', colors, 4]]) {
    const arr = vtkDataArray.newInstance({ name, values: vals, numberOfComponents: nc });
    pd.getPointData().addArray(arr);
  }
  pd.getPointData().setActiveScalars('colors');
  return { pd, w, h, d, n };
};

export function initZoo(host, base = '/') {
  const canvasHost = host.querySelector('[data-canvas]');
  const glwindow = vtkFullScreenRenderWindow.newInstance({
    container: canvasHost,
    background: [0.01, 0.005, 0.05],
  });
  const renderer = glwindow.getRenderer();
  const renderWindow = glwindow.getRenderWindow();
  const newMapper = () => {
    const m = vtkMapper.newInstance();
    m.setColorModeToDirectScalars();
    m.setScalarVisibility(true);
    return m;
  };
  // Crisp core + a wide faint halo pass — cheap bloom stand-in.
  const mapper = newMapper(), haloMapper = newMapper();
  const actor = vtkActor.newInstance();
  actor.getProperty().setPointSize(2.5);
  actor.getProperty().setOpacity(0.95);
  actor.setMapper(mapper);
  const halo = vtkActor.newInstance();
  halo.getProperty().setPointSize(9);
  halo.getProperty().setOpacity(0.13);
  halo.setMapper(haloMapper);
  renderer.addActor(halo);
  renderer.addActor(actor);

  // --- controls: hand-rolled orbit, same model as Hopf's Loom. All
  // camera motion derives from an explicit { az, el, dist } state driven
  // by pointer *deltas* — every drag feels like a grab at the viewport
  // center. vtk's trackball manipulators project the cursor onto a
  // virtual sphere, so edge drags pivoted differently than center drags
  // and zoom-to-mouse let the knot drift off-axis. Empty manipulator
  // style = vtk's default trackball is disabled; the camera is ours.
  const interactor = renderWindow.getInteractor();
  interactor.setInteractorStyle(vtkInteractorStyleManipulator.newInstance());

  // Orientation gizmo — a tiny canvas in the toolbar projecting the XYZ
  // axes through the camera basis. The camera is fully described by the
  // orbit state below, so this is cheap and drift-proof — and it removes
  // the vtk OrientationMarkerWidget, whose API shape kept drifting
  // between vtk.js versions.
  const gizmoCv = host.querySelector('[data-gizmo]');
  const gctx = gizmoCv?.getContext('2d');
  const drawGizmo = (orbit, focal) => {
    if (!gctx) return;
    const s = gizmoCv.width, c = s / 2, R = s * 0.36;
    const sa = Math.sin(orbit.az), ca = Math.cos(orbit.az);
    const se = Math.sin(orbit.el), ce = Math.cos(orbit.el);
    // Camera basis for view-up +Z: right = (-sa, ca, 0),
    // up = (-ca·se, -sa·se, ce), fwd = -(ce·ca, ce·sa, se).
    const AXES = [[1, 0, 0, '#ff9a5c'], [0, 1, 0, '#7dffb0'], [0, 0, 1, '#56c8ff']];
    const items = AXES.map(([x, y, z, col]) => ({
      col,
      sx: -x * sa + y * ca,
      sy: -(x * ca + y * sa) * se + z * ce,
      depth: -ce * (x * ca + y * sa) - z * se, // >0 → pointing at viewer
    })).sort((a, b) => a.depth - b.depth);    // far axes drawn first
    gctx.clearRect(0, 0, s, s);
    for (const it of items) {
      const front = it.depth > 0;
      gctx.globalAlpha = front ? 1 : 0.3;
      gctx.strokeStyle = it.col;
      gctx.lineWidth = 2.2;
      gctx.lineCap = 'round';
      gctx.beginPath();
      gctx.moveTo(c, c);
      gctx.lineTo(c + it.sx * R, c - it.sy * R);
      gctx.stroke();
      gctx.fillStyle = it.col;
      gctx.beginPath();
      gctx.arc(c + it.sx * R, c - it.sy * R, front ? 3.4 : 2.2, 0, 7);
      gctx.fill();
    }
    gctx.globalAlpha = 1;
  };

  // Orbit state — the single source of truth for the camera. `applyOrbit`
  // rebuilds position/focal every call, so the camera can never drift.
  // `pan` is a bounded world-space offset of the look-at point: real pan
  // without the knot ever leaving the neighborhood.
  let focal = [0, 0, 0], diag = 100, bounds = null, currentPd = null;
  const orbit = { az: 0.55, el: 0.42, dist: 100 };
  let pan = [0, 0, 0];
  let elTarget = 0.42; // elevation the turntable eases back toward
  const clampD = (v) => Math.min(diag * 3.5, Math.max(diag * 0.2, v));
  const clampPan = () => {
    const pl = Math.hypot(pan[0], pan[1], pan[2]);
    const maxP = diag * 0.5;
    if (pl > maxP) for (let i = 0; i < 3; i++) pan[i] *= maxP / pl;
  };
  const applyOrbit = () => {
    orbit.dist = clampD(orbit.dist);
    clampPan();
    const fx = focal[0] + pan[0], fy = focal[1] + pan[1], fz = focal[2] + pan[2];
    const cam = renderer.getActiveCamera();
    cam.setViewUp(0, 0, 1);
    cam.setPosition(
      fx + orbit.dist * Math.cos(orbit.el) * Math.cos(orbit.az),
      fy + orbit.dist * Math.cos(orbit.el) * Math.sin(orbit.az),
      fz + orbit.dist * Math.sin(orbit.el),
    );
    cam.setFocalPoint(fx, fy, fz);
    renderer.resetCameraClippingRange();
    renderWindow.render();
    drawGizmo(orbit, focal);
  };
  // Screen-space pan: drag dx,dy translates the look-at point along the
  // camera's right/up axes so content follows the pointer.
  const panBy = (dx, dy) => {
    const s = orbit.dist * 0.0016;
    const sa = Math.sin(orbit.az), ca = Math.cos(orbit.az);
    const se = Math.sin(orbit.el), ce = Math.cos(orbit.el);
    const rx = -sa, ry = ca;                 // camera right (z = 0)
    const ux = -ca * se, uy = -sa * se, uz = ce; // camera up
    pan[0] += (dy * ux - dx * rx) * s;
    pan[1] += (dy * uy - dx * ry) * s;
    pan[2] += (dy * uz) * s;
    applyOrbit();
  };

  // Quick-view presets — the Loom's "cross-section" angles. CUT swaps the
  // mystery slider for a single honest action: a side-on view with the
  // top half clipped away, exposing the torus interior. The selected
  // preset is remembered: reset (double-click/tap, gizmo) returns to it
  // rather than always forcing the default ¾ view.
  const clipPlane = vtkPlane.newInstance({ normal: [0, 0, 1], origin: [0, 0, 0] });
  const PRESETS = { orbit: [0.55, 0.42], top: [0.55, 1.45], side: [0.55, 0.06], cut: [0.55, 0.5] };
  let activePreset = 'orbit';
  const setPreset = (name) => {
    const p = PRESETS[name];
    if (!p) return;
    activePreset = name;
    pan = [0, 0, 0];
    orbit.az = p[0]; orbit.el = p[1]; elTarget = p[1];
    for (const m of [mapper, haloMapper]) {
      m.removeAllClippingPlanes();
      if (name === 'cut' && bounds) {
        clipPlane.setOrigin(0, 0, (bounds[4] + bounds[5]) / 2);
        m.addClippingPlane(clipPlane);
      }
    }
    applyOrbit();
  };
  const resetView = () => setPreset(activePreset);

  // Scalar color modes — 'spin' uses the baked RGBA classes; tension and
  // quanta map through separate LUTs (aurora / ember) so the modes can't
  // be mistaken for each other.
  const aurora = buildAuroraLut(), ember = buildEmberLut();
  const setColorMode = (mode) => {
    if (!currentPd) return;
    for (const m of [mapper, haloMapper]) {
      if (mode === 'spin') m.setColorModeToDirectScalars();
      else {
        m.setColorModeToMapScalars();
        m.setLookupTable(mode === 'quanta' ? ember : aurora);
        m.setUseLookupTableScalarRange(true);
      }
    }
    currentPd.getPointData().setActiveScalars(mode === 'spin' ? 'colors' : mode);
    renderWindow.render();
  };

  // Slow Z-axis turntable; resumes ~1.2s after the user stops dragging.
  let lastInteract = -1e4, disposed = false;
  const touch = () => { lastInteract = performance.now(); };

  // Orbit input — deltas only, never cursor position:
  //   left/primary drag  → orbit (azimuth + elevation)
  //   right/middle drag  → pan (bounded to half the model — the knot
  //                        can drift off-center but never leave)
  //   wheel              → zoom (center-anchored by construction)
  //   two-finger drag    → pan; pinch → zoom
  const ptrs = new Map();
  let lastPinch = 0, lastMid = null, lastTap = 0;
  canvasHost.style.touchAction = 'none';
  canvasHost.addEventListener('contextmenu', (e) => e.preventDefault());
  // iOS Safari fires gesture* events for pinch regardless of touch-action.
  for (const g of ['gesturestart', 'gesturechange', 'gestureend'])
    canvasHost.addEventListener(g, (e) => e.preventDefault());
  canvasHost.addEventListener('pointerdown', (e) => {
    touch();
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, btn: e.button });
    canvasHost.setPointerCapture(e.pointerId);
    const t = performance.now(); // double-tap → reset to selected preset
    if (t - lastTap < 330) resetView();
    lastTap = t;
  });
  canvasHost.addEventListener('pointermove', (e) => {
    const prev = ptrs.get(e.pointerId);
    if (!prev) return;
    touch();
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, btn: prev.btn });
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    if (ptrs.size === 1) {
      if (prev.btn === 1 || prev.btn === 2) panBy(dx, dy);
      else {
        orbit.az -= dx * 0.006;
        orbit.el = Math.max(-1.5, Math.min(1.5, orbit.el + dy * 0.006));
        applyOrbit();
      }
    } else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastPinch) orbit.dist *= lastPinch / d;
      lastPinch = d;
      const mid = [(a.x + b.x) / 2, (a.y + b.y) / 2];
      if (lastMid) panBy(mid[0] - lastMid[0], mid[1] - lastMid[1]);
      lastMid = mid;
      applyOrbit();
    }
  });
  const endPtr = (e) => { ptrs.delete(e.pointerId); lastPinch = 0; lastMid = null; touch(); };
  canvasHost.addEventListener('pointerup', endPtr);
  canvasHost.addEventListener('pointercancel', endPtr);
  canvasHost.addEventListener('wheel', (e) => {
    e.preventDefault(); touch();
    orbit.dist *= 1 + e.deltaY * 0.001;
    applyOrbit();
  }, { passive: false });
  canvasHost.addEventListener('dblclick', (e) => { e.preventDefault(); resetView(); });
  let autoRotate = true;
  const spin = () => {
    if (disposed) return;
    // The camera is rebuilt from orbit state every frame — no drift is
    // possible: no pan, focal always pinned, distance always clamped.
    if (autoRotate && performance.now() - lastInteract > 1200) {
      orbit.az += 0.0022;
      // Ease elevation back toward the selected preset's angle so a
      // manual drag to grazing incidence can't leave the turntable
      // orbiting the flat torus edge-on.
      orbit.el += (elTarget - orbit.el) * 0.03;
    }
    applyOrbit();
    requestAnimationFrame(spin);
  };
  requestAnimationFrame(spin);

  const cache = new Map();
  const load = async (entry) => {
    if (!cache.has(entry.file)) {
      const res = await fetch(`${base}zoo/${entry.file}`);
      if (!res.ok) throw new Error(`fetch ${entry.file}: ${res.status}`);
      cache.set(entry.file, parseBin(await res.arrayBuffer()));
    }
    const { pd } = cache.get(entry.file);
    mapper.setInputData(pd);
    haloMapper.setInputData(pd);
    currentPd = pd;
    const b = pd.getBounds();
    bounds = b;
    focal = [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2, (b[4] + b[5]) / 2];
    diag = Math.hypot(b[1] - b[0], b[3] - b[2], b[5] - b[4]) || 100;
    orbit.dist = diag * 1.55;
    resetView();
  };

  return {
    load,
    setAutoRotate(v) { autoRotate = v; },
    setPreset,
    setColorMode,
    reset: resetView,
    dispose() {
      disposed = true;
      glwindow.delete();
    },
  };
}
