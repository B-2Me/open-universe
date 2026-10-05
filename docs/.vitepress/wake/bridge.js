import { PIXEL_BUFFER_SIZE, WAKE_BUILD_ID } from './constants.js';

export class PlanckBridge {
    constructor(wasmModule) {
        this.wasm = wasmModule;
        this.wasm._init_grid();
    }

    getPixelView() {
        const ptr = this.wasm._get_pixel_buffer_pointer();
        const buffer = this.wasm.HEAPU8 ? this.wasm.HEAPU8.buffer : this.wasm.wasmMemory.buffer;
        return new Uint8ClampedArray(buffer, ptr, PIXEL_BUFFER_SIZE);
    }

    tick() { this.wasm._tick(); }
    renderFrame(layer) { this.wasm._render_frame(layer); }
    clearGrid() { this.wasm._clear_grid(); }
    saveSnapshot() { this.wasm._save_grid_snapshot(); }
    restoreSnapshot() { this.wasm._restore_grid_snapshot(); }
    getSnapshotCount() { return typeof this.wasm._get_snapshot_count === 'function' ? this.wasm._get_snapshot_count() : -1; }
    setUndoEnabled(v) { if (typeof this.wasm._set_undo_enabled === 'function') this.wasm._set_undo_enabled(v ? 1 : 0); }
    getGridPointer() { return this.wasm._get_grid_pointer(); }

    getNodeState(x, y) { return this.wasm._get_node_state(x, y); }
    setNodeState(x, y, state) { this.wasm._set_node_state(x, y, state); }

    addQuanta(x, y, amount) { this.wasm._add_quanta(x, y, amount); }
    addHeat(x, y, amount) { this.wasm._add_heat(x, y, amount); }
    setSpin(x, y, dir) { this.wasm._set_spin(x, y, dir); }

    setDissipation(rate) { this.wasm._set_dissipation(rate); }
    setThermalLimit(limit) { this.wasm._set_thermal_limit(limit); }
    setImpedanceMode(mode) { this.wasm._set_impedance_mode(mode); }

    getTotalQuanta() { return this.wasm._get_total_quanta(); }
    getTotalHeat() { return this.wasm._get_total_heat(); }
    getPhaseAlignment() { return this.wasm._get_phase_alignment(); }
    getYield() { return typeof this.wasm._get_yield === 'function' ? this.wasm._get_yield() : 0; }
    getEngineBuild() {
        return typeof this.wasm._get_engine_build === 'function'
            ? this.wasm.UTF8ToString(this.wasm._get_engine_build())
            : 'unknown build';
    }
    generateVTK() { return this.wasm._generate_vtk(); }
    freeVTK() { this.wasm._free_vtk(); }

    // Engine-side truth for the grid dimensions; constants.js must agree
    // or every pointer-offset calculation in JS silently corrupts state.
    getGridWidth() { return this.wasm._get_grid_width(); }
    getGridHeight() { return this.wasm._get_grid_height(); }

    destroy() {
        if (typeof this.wasm._free_grid === 'function') this.wasm._free_grid();
    }
}

export async function loadPlanckWasm(topology = 'square') {
    // The wasm assets live at unversioned public/ URLs — append the
    // per-deploy build token so a stale cache can never pair an old
    // engine with a new shell (or vice versa).
    const isHex = topology === 'hex';
    const file = isHex ? 'planck-hex' : 'planck';
    const factoryName = isHex ? 'createPlanckHex' : 'createPlanck';
    if (typeof window[factoryName] === 'undefined') {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `/wasm/wake/${file}.js?v=${WAKE_BUILD_ID}`;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load /wasm/wake/${file}.js`));
            document.head.appendChild(script);
        });
    }

    return new Promise((resolve, reject) => {
        window[factoryName]({
            locateFile: (path) => `/wasm/wake/${path}?v=${WAKE_BUILD_ID}`,
            onAbort: () => reject(new Error("The Planck Field collapsed."))
        }).then(resolve).catch(reject);
    });
}
