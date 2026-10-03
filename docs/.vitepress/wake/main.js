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
            const dq = document.getElementById('diag_quanta');
            const dh = document.getElementById('diag_heat');
            const dp = document.getElementById('diag_phase');
            const dy = document.getElementById('diag_yield');

            if (dq) dq.innerText = b.getTotalQuanta().toLocaleString();
            if (dh) dh.innerText = b.getTotalHeat().toLocaleString();
            if (dp) dp.innerText = b.getPhaseAlignment().toFixed(1) + "%";
            if (dy) dy.innerText = b.getYield().toLocaleString();
        };

        const loop = new EngineLoop({ bridge, renderer, getState: () => state, onTelemetry });
        new InteractionController({ container, bridge, palette, getState: () => state });
        new ControlsManager({ bridge, palette, loop, state });

        loadScenario(state.currentScenario, bridge);

        const diagNodes = document.getElementById('diag_nodes');
        if (diagNodes) {
            diagNodes.innerText = (GRID_WIDTH * GRID_HEIGHT).toLocaleString();
        }
        
        const statusEl = document.getElementById('diag_status');
        if (statusEl) {
            const version = bridge.getEngineVersion();
            statusEl.innerText = `v${version}`;
            statusEl.style.color = "var(--pf-brand-hover)";
        }

        // Fix iOS Safari hyper-speed resume glitch
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                loop.lastTimestamp = performance.now();
                loop.accumulator = 0;
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        loop.start();

        return () => {
            loop.stop();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    } catch (err) {
        const banner = document.getElementById('error-banner');
        if (banner) { 
            banner.innerText = err.message; 
            banner.style.display = 'block'; 
        }
        console.error("Planck Simulator initialization error:", err);
    }
}
