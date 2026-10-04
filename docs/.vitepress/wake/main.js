import { PlanckBridge } from './bridge.js';
import { DualRenderer } from './renderer.js';
import { PaletteManager } from './palette.js';
import { ControlsManager } from './controls.js';
import { EngineLoop } from './loop.js';
import { InteractionManager } from './interaction.js';
import { loadScenario } from './scenarios.js';
import {
    LAYER_MACRO,
    LAYER_ENTROPIC,
    SPEED_DEFAULT_TPS
} from './constants.js';

export async function initWakeSimulator() {
    const errorBanner = document.getElementById('error-banner');
    const diagStatus = document.getElementById('diag_status');

    try {
        if (diagStatus) diagStatus.innerText = "INITIALIZING";

        // 1. Initialize Bare-Metal WASM Bridge
        const bridge = new PlanckBridge();
        await bridge.init();

        if (diagStatus) diagStatus.innerText = "ONLINE";

        // 2. State Container
        const state = {
            isPlaying: true,
            currentScenario: 'vacuum',
            currentMode: 'move', // 'move', 'place', 'sample', 'config'
            injectionMode: 'clone', // 'clone', 'quanta', 'heat', 'spin'
            leftLayer: LAYER_MACRO,
            rightLayer: LAYER_ENTROPIC,
            forceRedraw: true,
            sampleRadius: 10
        };

        // 3. Mount Dual Canvas Renderer
        const canvasLeft = document.getElementById('canvas_left');
        const canvasRight = document.getElementById('canvas_right');
        const renderer = new DualRenderer(canvasLeft, canvasRight);

        // 4. Palette System
        const palette = new PaletteManager();

        // 5. Engine Loop Coordinator
        const loop = new EngineLoop({
            bridge,
            renderer,
            getState: () => state,
            onTelemetry: updateTelemetry
        });
        loop.setTPS(SPEED_DEFAULT_TPS);

        // 6. Mount UI Controls
        const controls = new ControlsManager({
            bridge,
            palette,
            loop,
            state,
            renderer
        });

        // 7. Mount Pointer / Touch Interaction Manager
        const interaction = new InteractionManager({
            bridge,
            palette,
            state,
            canvasContainerId: 'canvas-container',
            transformWrapperId: 'transform-wrapper'
        });

        // 8. Load Initial Scenario
        const initialParams = loadScenario(state.currentScenario, bridge);
        const md = document.getElementById('math_dissipation');
        const mt = document.getElementById('math_thermal_limit');
        if (md) md.innerText = initialParams.targetDissipation;
        if (mt) mt.innerText = initialParams.targetThermal;

        // Start Physics & Render Loop
        loop.start();

        // Teardown / Cleanup for Vue Component Unmount
        return () => {
            loop.stop();
            interaction.destroy();
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

    if (tQuanta) tQuanta.innerText = bridge.getTotalQuanta().toLocaleString();
    if (tHeat) tHeat.innerText = bridge.getTotalHeat().toLocaleString();
    if (tPhase) tPhase.innerText = (bridge.getPhaseAlignment() * 100).toFixed(1) + "%";
    if (tYield) tYield.innerText = bridge.getFrameYield().toFixed(2);
}
