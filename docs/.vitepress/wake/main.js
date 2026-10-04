import { PlanckBridge, loadPlanckWasm } from './bridge.js';
import { DualRenderer } from './renderer.js';
import { PaletteManager } from './palette.js';
import { ControlsManager } from './controls.js';
import { EngineLoop } from './loop.js';
import { InteractionManager } from './interaction.js';
import { loadScenario } from './scenarios.js';
import {
    LAYER_MACRO,
    LAYER_ENTROPIC,
    SPEED_DEFAULT_TPS,
    SAMPLE_RADIUS_DEFAULT
} from './constants.js';

let cumulativeYield = 0;

export async function initWakeSimulator() {
    const errorBanner = document.getElementById('error-banner');
    const diagStatus = document.getElementById('diag_status');

    try {
        if (diagStatus) diagStatus.innerText = "INITIALIZING";

        // 1. Asynchronously load the Emscripten WASM module
        const wasm = await loadPlanckWasm();

        // 2. Initialize Bare-Metal WASM Bridge with the module
        const bridge = new PlanckBridge(wasm);

        // Display actual engine build version from WASM
        const version = bridge.getEngineVersion();
        if (diagStatus) diagStatus.innerText = `v${version} ONLINE`;

        // 3. State Container
        const state = {
            isPlaying: true,
            currentScenario: 'vacuum',
            currentMode: 'move', // 'move', 'place', 'sample', 'config'
            injectionMode: 'clone', // 'clone', 'quanta', 'heat', 'spin'
            leftLayer: LAYER_MACRO,
            rightLayer: LAYER_ENTROPIC,
            forceRedraw: true,
            sampleRadius: SAMPLE_RADIUS_DEFAULT
        };

        // 4. Mount Dual Canvas Renderer
        const canvasLeft = document.getElementById('canvas_left');
        const canvasRight = document.getElementById('canvas_right');
        const renderer = new DualRenderer(canvasLeft, canvasRight);

        // 5. Palette System
        const palette = new PaletteManager();

        // 6. Engine Loop Coordinator
        const loop = new EngineLoop({
            bridge,
            renderer,
            getState: () => state,
            onTelemetry: updateTelemetry
        });
        loop.setTPS(SPEED_DEFAULT_TPS);

        // 7. Mount UI Controls
        const controls = new ControlsManager({
            bridge,
            palette,
            loop,
            state,
            rendererLeft: renderer.left,
            rendererRight: renderer.right
        });

        // 8. Mount Pointer / Touch Interaction Manager
        const interaction = new InteractionManager({
            bridge,
            palette,
            state,
            canvasContainerId: 'canvas-container',
            transformWrapperId: 'transform-wrapper'
        });

        // 9. Load Initial Scenario
        const initialParams = loadScenario(state.currentScenario, bridge);
        const md = document.getElementById('math_dissipation');
        const mt = document.getElementById('math_thermal_limit');
        if (md) md.innerText = initialParams.targetDissipation;
        if (mt) mt.innerText = initialParams.targetThermal;

        // Reset cumulative yield on scenario boot
        cumulativeYield = 0;

        // Start Physics & Render Loop
        loop.start();

        // Teardown / Cleanup for Vue Component Unmount
        return () => {
            loop.stop();
            if (typeof interaction.destroy === 'function') {
                interaction.destroy();
            }
        };

    } catch (err) {
        console.error("Wake Simulator Bootstrap Failed:", err);
        if (errorBanner) {
            errorBanner.style.display = 'block';
            errorBanner.innerText = `Simulation Engine Exception: ${err.message || err}`;
        }
        if (diagStatus) {
            diagStatus.innerText = "CRASHED";
            diagStatus.style.color = "var(--pf-danger)";
        }
        return null;
    }
}

function updateTelemetry(bridge) {
    const tQuanta = document.getElementById('diag_quanta');
    const tHeat = document.getElementById('diag_heat');
    const tPhase = document.getElementById('diag_phase');
    const tYield = document.getElementById('diag_yield');

    const tickYield = bridge.getYield();
    if (tickYield > 0) {
        cumulativeYield += tickYield;
    }

    if (tQuanta) tQuanta.innerText = bridge.getTotalQuanta().toLocaleString();
    if (tHeat) tHeat.innerText = bridge.getTotalHeat().toLocaleString();
    if (tPhase) tPhase.innerText = (bridge.getPhaseAlignment() * 100).toFixed(1) + "%";
    // Show either active frame yield or cumulative yield when topological unwinding occurs
    if (tYield) {
        tYield.innerText = tickYield > 0 ? tickYield.toFixed(2) : cumulativeYield.toFixed(0);
    }
}
