// Zoo renderer — vtk.js cinematic point-cloud view of dictionary knots.
// initZoo(host) wires a full-screen vtk render window + auto-rotate and
// returns { load(entry), dispose() }; the Vue shell drives selection.
import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData';
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';

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

const parseBin = (buf) => {
  const dv = new DataView(buf);
  if (dv.getUint32(0, false) !== 0x5a4f4f33) throw new Error('bad ZOO3 magic');
  const w = dv.getUint32(4, true), h = dv.getUint32(8, true), d = dv.getUint32(12, true);
  const n = dv.getUint32(16, true);
  const raw = new Uint8Array(buf, 20);
  const pts = new Float32Array(n * 3), verts = new Uint32Array(n * 2);
  const tension = new Float32Array(n), quanta = new Float32Array(n), painted = new Float32Array(n);
  let tMax = 1;
  for (let i = 0; i < n; i++) {
    const o = i * 7;
    pts[i * 3] = raw[o]; pts[i * 3 + 1] = raw[o + 1]; pts[i * 3 + 2] = raw[o + 2];
    verts[i * 2] = 1; verts[i * 2 + 1] = i;
    quanta[i] = raw[o + 3]; tension[i] = raw[o + 5]; painted[i] = raw[o + 6];
    if (tension[i] > tMax) tMax = tension[i];
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

  // Slow Z-axis turntable; pauses while the user drags. DOM pointer
  // events are the reliable signal — vtk interactor style events vary.
  let rotating = true, disposed = false;
  const down = () => { rotating = false; };
  const up = () => { rotating = true; };
  canvasHost.addEventListener('pointerdown', down);
  window.addEventListener('pointerup', up);
  let autoRotate = true;
  const spin = () => {
    if (disposed) return;
    if (autoRotate && rotating) renderer.getActiveCamera().azimuth(0.12);
    renderWindow.render();
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
    renderer.resetCamera();
    // Frame with breathing room — resetCamera hugs the bounding box.
    const cam = renderer.getActiveCamera();
    cam.setDistance(cam.getDistance() * 1.15);
    renderWindow.render();
  };

  return {
    load,
    setAutoRotate(v) { autoRotate = v; },
    dispose() {
      disposed = true;
      canvasHost.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      glwindow.delete();
    },
  };
}
