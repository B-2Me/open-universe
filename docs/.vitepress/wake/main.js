import { GRID_WIDTH, GRID_HEIGHT, LAYER_MACRO, LAYER_ENTROPIC } from './constants.js';
import { PlanckBridge, loadPlanckWasm } from './bridge.js';
import { DualRenderer } from './renderer.js';
import { EngineLoop } from './loop.js';
import { PaletteManager } from './palette.js';
import { InteractionController } from './interaction.js';
import { ControlsManager } from './controls.js';
import { loadScenario } from './scenarios.js';

export async function initWakeSimulator() {
    const canvasL = document.getElementById('canvas_left');
    const canvasR = document.getElementById('canvas_right');
    const container = document.getElementById('canvas-container');
    if (!canvasL || !canvasR || !container) return;

    try {
        const wasmModule = await loadPlanckWasm();
        const bridge = new PlanckBridge(wasmModule);
        const renderer = new DualRenderer(canvasL, canvasR);
        const palette = new PaletteManager();

        const state = {
            isPlaying: true,
            currentMode: "move",
            injectionMode: "clone",
            currentScenario: "vacuum",
            leftLayer: LAYER_MACRO,
            rightLayer: LAYER_ENTROPIC,
            forceRedraw: true,
            isSpaceDown: false
        };

        const onTelemetry = (b) => {
            document.getElementById('diag_quanta').innerText = b.getTotalQuanta().toLocaleString();
            document.getElementById('diag_heat').innerText = b.getTotalHeat().toLocaleString();
            document.getElementById('diag_phase').innerText = b.getPhaseAlignment().toFixed(1) + "%";
            document.getElementById('diag_yield').innerText = b.getYield().toLocaleString();
        };

        const loop = new EngineLoop({ bridge, renderer, getState: () => state, onTelemetry });
        new InteractionController({ container, bridge, palette, getState: () => state });
        new ControlsManager({ bridge, palette, loop, state });

        loadScenario(state.currentScenario, bridge);
        document.getElementById('diag_nodes').innerText = (GRID_WIDTH * GRID_HEIGHT).toLocaleString();
        
        const statusEl = document.getElementById('diag_status');
        if (statusEl) {
            statusEl.innerText = "ONLINE";
            statusEl.style.color = "var(--pf-brand-hover)";
        }

        loop.start();
    } catch (err) {
        const banner = document.getElementById('error-banner');
        if (banner) { banner.innerText = err.message; banner.style.display = 'block'; }
        console.error(err);
    }
}

if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', initWakeSimulator);
    } else {
        initWakeSimulator();
    }
}
