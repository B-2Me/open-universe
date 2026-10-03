import { LAYER_LABELS } from './constants.js';
import { loadScenario } from './scenarios.js';

export class ControlsManager {
    constructor({ bridge, palette, loop, state }) {
        this.bridge = bridge;
        this.palette = palette;
        this.loop = loop;
        this.state = state;

        this.init();
    }

    init() {
        this.renderPalette();
        this.bindLayerButtons();
        this.bindScenarioButtons();
        this.bindSegmentButtons();
        this.bindSliders();
        this.bindActionButtons();
    }

    renderPalette() {
        const container = document.getElementById('brush_selector');
        if (!container) return;
        container.innerHTML = '';

        const scratchBtn = document.createElement('button');
        scratchBtn.className = `palette-btn ${this.palette.currentBrush === 'custom' ? 'active' : ''}`;
        scratchBtn.id = 'opt_custom';
        scratchBtn.innerHTML = `<span class="p-icon">⬚</span><span class="p-label" id="scratch_label">Copy</span>`;
        scratchBtn.onclick = () => { this.palette.currentBrush = 'custom'; this.renderPalette(); };
        container.appendChild(scratchBtn);

        for (const [key, brush] of Object.entries(this.palette.fullPalette)) {
            const btn = document.createElement('button');
            btn.className = `palette-btn ${this.palette.currentBrush === key ? 'active' : ''}`;
            btn.innerHTML = `<span class="p-icon">${brush.icon}</span><span class="p-label">${brush.label}</span>`;
            btn.onclick = () => { this.palette.currentBrush = key; this.renderPalette(); };
            container.appendChild(btn);
        }
    }

    bindLayerButtons() {
        const btnL = document.getElementById('btn_toggle_left');
        const btnR = document.getElementById('btn_toggle_right');
        if (btnL) {
            btnL.innerText = LAYER_LABELS[this.state.leftLayer];
            btnL.onclick = () => {
                this.state.leftLayer = (this.state.leftLayer + 1) % 4;
                btnL.innerText = LAYER_LABELS[this.state.leftLayer];
                this.state.forceRedraw = true;
            };
        }
        if (btnR) {
            btnR.innerText = LAYER_LABELS[this.state.rightLayer];
            btnR.onclick = () => {
                this.state.rightLayer = (this.state.rightLayer + 1) % 4;
                btnR.innerText = LAYER_LABELS[this.state.rightLayer];
                this.state.forceRedraw = true;
            };
        }
    }

    bindScenarioButtons() {
        this.setupGroup('scenario_selector', (val) => {
            this.bridge.saveSnapshot();
            this.state.currentScenario = val;
            const res = loadScenario(val, this.bridge);
            const md = document.getElementById('math_dissipation');
            const mt = document.getElementById('math_thermal_limit');
            if (md) md.innerText = res.targetDissipation;
            if (mt) mt.innerText = res.targetThermal;
            this.state.forceRedraw = true;
        });
    }

    bindSegmentButtons() {
        document.querySelectorAll('.segment-btn').forEach(btn => {
            btn.onclick = (e) => {
                const mode = e.currentTarget.dataset.mode;
                this.state.currentMode = mode;
                document.querySelectorAll('.segment-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
                document.getElementById('context_place')?.classList.toggle('show', mode === 'place');
                document.getElementById('context_sample')?.classList.toggle('show', mode === 'sample');
            };
        });

        this.setupGroup('injection_mode_selector', (val) => { this.state.injectionMode = val; });
        this.setupGroup('impedance_mode_selector', (val) => { this.bridge.setImpedanceMode(parseInt(val, 10)); });
    }

    bindSliders() {
        const speed = document.getElementById('slider_speed');
        if (speed) {
            speed.oninput = (e) => {
                const v = parseInt(e.target.value, 10);
                this.state.isPlaying = v > 0;
                this.loop.setTPS(v);
                document.getElementById('val_speed').innerText = v === 0 ? "Paused" : `${v} TPS`;
            };
        }
        const diss = document.getElementById('slider_dissipation');
        if (diss) {
            diss.oninput = (e) => {
                const v = parseInt(e.target.value, 10);
                this.bridge.setDissipation(v);
                document.getElementById('math_dissipation').innerText = v;
                this.state.forceRedraw = true;
            };
        }
        const therm = document.getElementById('slider_thermal');
        if (therm) {
            therm.oninput = (e) => {
                const v = parseInt(e.target.value, 10);
                this.bridge.setThermalLimit(v);
                document.getElementById('math_thermal_limit').innerText = v;
                this.state.forceRedraw = true;
            };
        }
    }

    bindActionButtons() {
        const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
        bind('btn_reset', () => { this.bridge.saveSnapshot(); loadScenario(this.state.currentScenario, this.bridge); this.state.forceRedraw = true; });
        bind('btn_soup', () => { this.bridge.saveSnapshot(); this.bridge.randomizeGrid(); this.state.forceRedraw = true; });
        bind('btn_clear', () => { this.bridge.saveSnapshot(); this.bridge.clearGrid(); this.state.forceRedraw = true; });
        bind('btn_undo', () => { this.bridge.restoreSnapshot(); this.state.forceRedraw = true; });
        bind('btn_save_scratch', () => { this.palette.saveCurrentCopy(); this.renderPalette(); });
    }

    setupGroup(containerId, callback) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const buttons = container.querySelectorAll('.group-btn');
        buttons.forEach(btn => {
            btn.onclick = () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                callback(btn.dataset.val);
            };
        });
    }
}
