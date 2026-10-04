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
    SPEED_DEFAULT_TPS
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
            forceRedraw: true
        };

        const canvasLeft = document.getElementById('canvas_left');
        const canvasRight = document.getElementById('canvas_right');
        const renderer = new DualRenderer(canvasLeft, canvasRight);
        const palette = new PaletteManager();

        const telemetryEls = {
            quanta: document.getElementById('diag_quanta'),
            heat: document.getElementById('diag_heat'),
            phase: document.getElementById('diag_phase'),
            yield: document.getElementById('diag_yield')
        };
        const loop = new EngineLoop({
            bridge,
            renderer,
            getState: () => state,
            onTelemetry: (b) => updateTelemetry(telemetryEls, b)
        });
        loop.setTPS(SPEED_DEFAULT_TPS);

        let controlsRef = null;

        const interaction = new InteractionManager({
            bridge,
            palette,
            state,
            canvasContainerId: 'canvas-container',
            transformWrapperId: 'transform-wrapper',
            onSample: (stamp) => {
                if (controlsRef) {
                    // Rebuild the palette grid with the new custom brush equipped
                    controlsRef.renderPalette();

                    // Switch to Place mode with Clone injection so the stamp lands intact
                    controlsRef.setMode('place');
                    controlsRef.setInjectionMode('clone');

                    // Allow the user to save the new brush
                    const btnSave = document.getElementById('btn_save_scratch');
                    if (btnSave) btnSave.disabled = false;
                }
            }
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
        controlsRef = controls;

        const initialParams = loadScenario(state.currentScenario, bridge);
        const md = document.getElementById('math_dissipation');
        const mt = document.getElementById('math_thermal_limit');
        if (md) md.innerText = initialParams.targetDissipation;
        if (mt) mt.innerText = initialParams.targetThermal;

        loop.start();

        return () => {
            loop.stop();
            if (typeof interaction.destroy === 'function') interaction.destroy();
            if (typeof controls.destroy === 'function') controls.destroy();
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

function updateTelemetry(els, bridge) {
    if (els.quanta) els.quanta.innerText = bridge.getTotalQuanta().toLocaleString();
    if (els.heat) els.heat.innerText = bridge.getTotalHeat().toLocaleString();
    if (els.phase) els.phase.innerText = bridge.getPhaseAlignment().toFixed(1) + "%";
    if (els.yield) els.yield.innerText = bridge.getYield().toLocaleString(undefined, { maximumFractionDigits: 0 });
}
