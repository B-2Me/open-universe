import { PlanckBridge } from './bridge.js';
import { SimulationRenderer } from './renderer.js';
import { PaletteManager } from './palette.js';
import { ControlsManager } from './controls.js';
import { SimulationLoop } from './loop.js';
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

        // 3. Hardware / Fallback Renderers for Split Screen
        const rendererLeft = new SimulationRenderer('canvas_left');
        const rendererRight = new SimulationRenderer('canvas_right');

        // 4. Palette System
        const palette = new PaletteManager();

        // 5. Physics Stepping & Telemetry Update
        const onTick = () => {
            bridge.tick();
            updateTelemetry(bridge);
        };

        // 6. Split-View Canvas Paint
        const onRender = () => {
            // Render Left Split
            bridge.renderLayer(state.leftLayer, 0);
            rendererLeft.render(bridge.getPixelBuffer());

            // Render Right Split
            bridge.renderLayer(state.rightLayer, 1);
            rendererRight.render(bridge.getPixelBuffer());
        };

        // 7. Loop Coordinator
        const loop = new SimulationLoop({
            onTick,
            onRender,
            tps: SPEED_DEFAULT_TPS
        });

        // 8. Mount UI Controls & Pass WebGL Renderers for Live Projection Toggling
        const controls = new ControlsManager({
            bridge,
            palette,
            loop,
            state,
            rendererLeft,
            rendererRight
        });

        // 9. Mount Pointer / Touch Interaction Manager
        const interaction = new InteractionManager({
            bridge,
            palette,
            state,
            canvasContainerId: 'canvas-container',
            transformWrapperId: 'transform-wrapper'
        });

        // 10. Load Initial Scenario
        const initialParams = loadScenario(state.currentScenario, bridge);
        const md = document.getElementById('math_dissipation');
        const mt = document.getElementById('math_thermal_limit');
        if (md) md.innerText = initialParams.targetDissipation;
        if (mt) mt.innerText = initialParams.targetThermal;

        // Start Physics & Render Loops
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
