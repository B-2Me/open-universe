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

export async function initWakeSimulator() {
    const errorBanner = document.getElementById('error-banner');
    const diagStatus = document.getElementById('diag_status');

    try {
        if (diagStatus) diagStatus.innerText = "INITIALIZING";

        const wasm = await loadPlanckWasm();
        const bridge = new PlanckBridge(wasm);

        const version = bridge.getEngineVersion();
        if (diagStatus) diagStatus.innerText = `v${version} ONLINE`;

        const state = {
            isPlaying: true,
            currentScenario: 'vacuum',
            currentMode: 'move', 
            injectionMode: 'clone', 
            leftLayer: LAYER_MACRO,
            rightLayer: LAYER_ENTROPIC,
            forceRedraw: true,
            sampleRadius: SAMPLE_RADIUS_DEFAULT
        };

        const canvasLeft = document.getElementById('canvas_left');
        const canvasRight = document.getElementById('canvas_right');
        const renderer = new DualRenderer(canvasLeft, canvasRight);
        const palette = new PaletteManager();

        const loop = new EngineLoop({
            bridge,
            renderer,
            getState: () => state,
            onTelemetry: updateTelemetry
        });
        loop.setTPS(SPEED_DEFAULT_TPS);

        const interaction = new InteractionManager({
            bridge,
            palette,
            state,
            canvasContainerId: 'canvas-container',
            transformWrapperId: 'transform-wrapper'
        });

        const controls = new ControlsManager({
            bridge,
            palette,
            loop,
            state,
            rendererLeft: renderer.left,
            rendererRight: renderer.right,
            interaction
        });

        const initialParams = loadScenario(state.currentScenario, bridge);
        const md = document.getElementById('math_dissipation');
        const mt = document.getElementById('math_thermal_limit');
        if (md) md.innerText = initialParams.targetDissipation;
        if (mt) mt.innerText = initialParams.targetThermal;

        loop.start();

        return () => {
            loop.stop();
            if (typeof interaction.destroy === 'function') interaction.destroy();
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
    
    // Engine now permanently accumulates topological unwinding yield directly in C
    if (tYield) tYield.innerText = bridge.getYield().toLocaleString(undefined, { maximumFractionDigits: 0 });
}
