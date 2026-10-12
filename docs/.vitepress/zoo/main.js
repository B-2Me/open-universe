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

// Cinematic tension ramp: deep indigo → cyan → hot pink → white crest.
const buildLut = () => {
  const lut = vtkColorTransferFunction.newInstance();
  lut.addRGBPoint(0, 0.03, 0.01, 0.12);
  lut.addRGBPoint(60, 0.0, 0.25, 0.65);
  lut.addRGBPoint(140, 0.0, 0.85, 0.95);
  lut.addRGBPoint(200, 0.85, 0.35, 0.95);
  lut.addRGBPoint(255, 1.0, 0.95, 1.0);
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
  for (let i = 0; i < n; i++) {
    const o = i * 7;
    pts[i * 3] = raw[o]; pts[i * 3 + 1] = raw[o + 1]; pts[i * 3 + 2] = raw[o + 2];
    verts[i * 2] = 1; verts[i * 2 + 1] = i;
    quanta[i] = raw[o + 3]; tension[i] = raw[o + 5]; painted[i] = raw[o + 6];
  }
  const pd = vtkPolyData.newInstance();
  pd.getPoints().setData(pts, 3);
  pd.getVerts().setData(verts);
  for (const [name, vals] of [['tension', tension], ['quanta', quanta], ['painted', painted]]) {
    const arr = vtkDataArray.newInstance({ name, values: vals, numberOfComponents: 1 });
    pd.getPointData().addArray(arr);
  }
  pd.getPointData().setActiveScalars('tension');
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
  const actor = vtkActor.newInstance();
  actor.getProperty().setPointSize(3);
  actor.getProperty().setOpacity(0.95);
  const mapper = vtkMapper.newInstance();
  const lut = buildLut();
  mapper.setLookupTable(lut);
  mapper.setUseLookupTableScalarRange(true);
  actor.setMapper(mapper);
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
    renderer.resetCamera();
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
