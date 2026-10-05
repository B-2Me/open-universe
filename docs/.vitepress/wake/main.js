import { PlanckBridge, loadPlanckWasm } from './bridge.js';
import { DualRenderer } from './renderer.js';
import { PaletteManager } from './palette.js';
import { ControlsManager } from './controls.js';
import { EngineLoop } from './loop.js';
import { InteractionManager } from './interaction.js';
import { loadScenario, SCENARIO_DOSSIERS } from './scenarios.js';
import { loadSimState, restoreSimState } from './persist.js';
import {
    LAYER_MACRO,
    LAYER_ENTROPIC,
    SPEED_DEFAULT_TPS,
    TOTAL_NODES,
    GRID_WIDTH,
    GRID_HEIGHT
} from './constants.js';

export async function initWakeSimulator() {
    const errorBanner = document.getElementById('error-banner');
    const diagStatus = document.getElementById('diag_status');

    // Boot and loop share one fatal path so a crash always surfaces on screen.
    const showFatal = (err) => {
        if (errorBanner) {
            errorBanner.style.display = 'block';
            errorBanner.innerText = `Simulation Engine Exception: ${err.message || err}`;
        }
        if (diagStatus) {
            diagStatus.innerText = "CRASHED";
            diagStatus.style.color = "var(--pf-danger)";
        }
    };

    try {
        if (diagStatus) diagStatus.innerText = "INITIALIZING";

        const wasm = await loadPlanckWasm();
        const bridge = new PlanckBridge(wasm);

        // The engine reports its compiled grid dimensions — if constants.js
        // ever drifts from planck.c's WIDTH/HEIGHT, every coordinate write
        // would silently corrupt state. Fail loudly at boot instead.
        if (bridge.getGridWidth() !== GRID_WIDTH || bridge.getGridHeight() !== GRID_HEIGHT) {
            throw new Error(
                `Grid mismatch: engine is ${bridge.getGridWidth()}x${bridge.getGridHeight()}, ` +
                `constants.js expects ${GRID_WIDTH}x${GRID_HEIGHT}`
            );
        }

        const build = bridge.getEngineBuild();
        if (diagStatus) diagStatus.innerText = build;

        const diagNodes = document.getElementById('diag_nodes');
        if (diagNodes) diagNodes.innerText = `${TOTAL_NODES.toLocaleString()} Nodes`;

        const state = {
            isPlaying: true,
            currentScenario: 'vacuum',
            currentMode: 'move',
            // Mode drawers track currentMode but can be collapsed while the
            // tool stays armed (second tap on the active segment button).
            drawerVisible: false,
            // Undo ring is opt-in (System drawer → Engine Flags): it costs
            // 4×640KB plus a memcpy per checkpoint — off by default.
            undoEnabled: false,
            // Injection channels — all three on is a verbatim Clone write.
            // Per-channel dose % (spin = per-node application probability);
            // ignored while all three are on since clone writes verbatim.
            injectionChannels: { quanta: true, heat: true, spin: true },
            injectionDose: { quanta: 25, heat: 5, spin: 100 },
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
        let controlsRef = null;
        const loop = new EngineLoop({
            bridge,
            renderer,
            getState: () => state,
            onTelemetry: (b) => updateTelemetry(telemetryEls, b),
            onTick: (frameCount) => controlsRef?.onEngineTick(frameCount),
            onFatal: showFatal
        });
        loop.setTPS(SPEED_DEFAULT_TPS);

        const interaction = new InteractionManager({
            bridge,
            palette,
            state,
            canvasContainerId: 'canvas-container',
            touchZoneId: 'canvas-touch-zone',
            transformWrapperId: 'transform-wrapper',
            onUndoPush: () => controlsRef?.pushUndoDepth(),
            onUndoPop: () => controlsRef?.popUndoDepth(),
            onSample: (stamp) => {
                if (controlsRef) {
                    // Rebuild the palette grid with the new custom brush equipped
                    controlsRef.renderPalette();

                    // Switch to Place mode with all channels on so the stamp lands intact
                    controlsRef.setMode('place');
                    controlsRef.setInjectionChannels({ quanta: true, heat: true, spin: true });

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

        // Resume a previous session if an autosave exists (grid bytes override
        // the default scenario seed; the saved scenario name is restored too).
        const saved = await loadSimState();
        if (saved && saved.grid) {
            restoreSimState(bridge, saved);
            if (saved.scenario && SCENARIO_DOSSIERS[saved.scenario]) {
                state.currentScenario = saved.scenario;
                const dd = document.getElementById('scenario_dropdown');
                if (dd) dd.value = saved.scenario;
                controls.updateDossierContent(saved.scenario);
            }
        }

        const md = document.getElementById('math_dissipation');
        const mt = document.getElementById('math_thermal_limit');
        if (md) md.innerText = initialParams.targetDissipation;
        if (mt) mt.innerText = initialParams.targetThermal;

        bindWheelForwarding();

        loop.start();

        return () => {
            loop.stop();
            if (typeof interaction.destroy === 'function') interaction.destroy();
            if (typeof controls.destroy === 'function') controls.destroy();
            bridge.destroy();
        };

    } catch (err) {
        console.error("Wake Simulator Bootstrap Failed:", err);
        showFatal(err);
        return null;
    }
}

// Scroll-chain safety net: wheel deltas an in-app scroller can't consume
// (already at its boundary) must reach the page. Browser scroll chaining
// should deliver them on its own, but nested scroll containers
// (overflow:hidden ancestors) and overscroll quirks have eaten them
// before — when a scroller inside the sandbox is at its edge, take over
// and scroll the window ourselves.
function bindWheelForwarding() {
    const sandbox = document.querySelector('.wake-sandbox');
    if (!sandbox) return;
    sandbox.addEventListener('wheel', (e) => {
        if (e.defaultPrevented) return; // canvas zoom claimed it
        for (let el = e.target; el && el !== sandbox; el = el.parentElement) {
            const oy = getComputedStyle(el).overflowY;
            if (oy !== 'auto' && oy !== 'scroll') continue;
            if (el.scrollHeight <= el.clientHeight) continue;
            const px = e.deltaY * (e.deltaMode === 1 ? 33 : 1);
            const atTop = el.scrollTop <= 0;
            const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
            if ((px < 0 && atTop) || (px > 0 && atBottom)) {
                e.preventDefault();
                window.scrollBy(0, px);
            }
            return; // nearest real scroller decides — at boundary we took over
        }
        // No in-app scroller under the cursor — native bubbling scrolls the page.
    }, { passive: false });
}

function updateTelemetry(els, bridge) {
    if (els.quanta) els.quanta.innerText = bridge.getTotalQuanta().toLocaleString();
    if (els.heat) els.heat.innerText = bridge.getTotalHeat().toLocaleString();
    if (els.phase) els.phase.innerText = bridge.getPhaseAlignment().toFixed(1) + "%";
    if (els.yield) els.yield.innerText = bridge.getYield().toLocaleString(undefined, { maximumFractionDigits: 0 });
}
