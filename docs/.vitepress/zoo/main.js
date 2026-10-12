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

// Aurora ramp: deep navy → royal blue → cyan → mint → white crest.
// No violet family — the void background is indigo, and purple-on-purple
// has no contrast. Cyan/white reads luminous against it.
const buildLut = () => {
  const lut = vtkColorTransferFunction.newInstance();
  lut.addRGBPoint(0, 0.02, 0.10, 0.30);
  lut.addRGBPoint(60, 0.05, 0.35, 0.85);
  lut.addRGBPoint(140, 0.15, 0.90, 1.0);
  lut.addRGBPoint(200, 0.70, 1.0, 0.90);
  lut.addRGBPoint(255, 1.0, 1.0, 1.0);
  return lut;
};

// Fake key light, fixed in world space. Baked into the display scalar so
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
  // Display scalar: sqrt-normalized tension (spreads the low-tension detail
  // where most knot mass sits) lifted off zero, then shaded by a lambert
  // term around the knot's bbox center — gives the blob real geometry.
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += pts[i * 3]; cy += pts[i * 3 + 1]; cz += pts[i * 3 + 2]; }
  cx /= n; cy /= n; cz /= n;
  const glow = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const nx = pts[i * 3] - cx, ny = pts[i * 3 + 1] - cy, nz = pts[i * 3 + 2] - cz;
    const nl = Math.hypot(nx, ny, nz) || 1;
    const lam = Math.max(0, (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / nl);
    const base = 0.15 + 0.85 * Math.sqrt(tension[i] / tMax);
    glow[i] = 255 * base * (0.45 + 0.55 * lam);
  }
  const pd = vtkPolyData.newInstance();
  pd.getPoints().setData(pts, 3);
  pd.getVerts().setData(verts);
  for (const [name, vals] of [['tension', tension], ['quanta', quanta], ['painted', painted], ['glow', glow]]) {
    const arr = vtkDataArray.newInstance({ name, values: vals, numberOfComponents: 1 });
    pd.getPointData().addArray(arr);
  }
  pd.getPointData().setActiveScalars('glow');
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
  const lut = buildLut();
  const newMapper = () => {
    const m = vtkMapper.newInstance();
    m.setLookupTable(lut);
    m.setUseLookupTableScalarRange(true);
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
