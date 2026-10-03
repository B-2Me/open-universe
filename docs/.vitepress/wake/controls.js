import { LAYER_LABELS } from './constants.js';
import { loadScenario, randomizeScenarioSoup } from './scenarios.js';

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
        this.bindOutsideDismiss();
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

            const sd = document.getElementById('slider_dissipation');
            const st = document.getElementById('slider_thermal');
            if (sd) sd.value = res.targetDissipation;
            if (st) st.value = res.targetThermal;

            this.state.forceRedraw = true;
        });
    }

    bindSegmentButtons() {
        document.querySelectorAll('.segment-btn').forEach(btn => {
            btn.onclick = (e) => {
                const mode = e.currentTarget.dataset.mode;
                
                if (this.state.currentMode === mode) {
                    if (mode === 'place') {
                        document.getElementById('context_place')?.classList.toggle('show');
                    } else if (mode === 'sample') {
                        document.getElementById('context_sample')?.classList.toggle('show');
                    } else if (mode === 'config') {
                        document.getElementById('context_config')?.classList.toggle('show');
                    }
                    return;
                }

                this.state.currentMode = mode;
                document.querySelectorAll('.segment-btn').forEach(b => 
                    b.classList.toggle('active', b.dataset.mode === mode)
                );
                document.getElementById('context_place')?.classList.toggle('show', mode === 'place');
                document.getElementById('context_sample')?.classList.toggle('show', mode === 'sample');
                document.getElementById('context_config')?.classList.toggle('show', mode === 'config');
            };
        });

        this.setupGroup('injection_mode_selector', (val) => { this.state.injectionMode = val; });
        this.setupGroup('impedance_mode_selector', (val) => { this.bridge.setImpedanceMode(parseInt(val, 10)); });
    }

    bindOutsideDismiss() {
        document.addEventListener('pointerdown', (e) => {
            const contextPlace = document.getElementById('context_place');
            const contextSample = document.getElementById('context_sample');
            const contextConfig = document.getElementById('context_config');
            const canvasContainer = document.getElementById('canvas-container');
            const segmentContainer = document.querySelector('.segment-container');

            const isPlaceOpen = contextPlace?.classList.contains('show');
            const isSampleOpen = contextSample?.classList.contains('show');
            const isConfigOpen = contextConfig?.classList.contains('show');
            if (!isPlaceOpen && !isSampleOpen && !isConfigOpen) return;

            if (contextPlace?.contains(e.target) || contextSample?.contains(e.target) || contextConfig?.contains(e.target)) return;
            if (canvasContainer?.contains(e.target)) return;
            if (segmentContainer?.contains(e.target)) return;

            contextPlace?.classList.remove('show');
            contextSample?.classList.remove('show');
            contextConfig?.classList.remove('show');
        });
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
        
        bind('btn_reset', () => { 
            this.bridge.saveSnapshot(); 
            loadScenario(this.state.currentScenario, this.bridge); 
            this.state.forceRedraw = true; 
        });
        bind('btn_soup', () => { 
            this.bridge.saveSnapshot(); 
            randomizeScenarioSoup(this.state.currentScenario, this.bridge); 
            this.state.forceRedraw = true; 
        });
        bind('btn_clear', () => { 
            this.bridge.saveSnapshot(); 
            this.bridge.clearGrid(); 
            this.state.forceRedraw = true; 
        });
        bind('btn_undo', () => { 
            this.bridge.restoreSnapshot(); 
            this.state.forceRedraw = true; 
        });
        bind('btn_save_scratch', () => { 
            this.palette.saveCurrentCopy(); 
            this.renderPalette(); 
            const btn = document.getElementById('btn_save_scratch');
            if (btn) btn.disabled = true;
        });

        // Frame Capture Actions
        bind('btn_export_png', () => {
            const canvasLeft = document.getElementById('canvas_left');
            if (!canvasLeft) return;
            canvasLeft.toBlob(blob => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `planck_field_${Date.now()}.png`;
                link.click();
            }, 'image/png');
        });

        bind('btn_share', async () => {
            const canvasLeft = document.getElementById('canvas_left');
            if (!canvasLeft) return;
            canvasLeft.toBlob(async blob => {
                const file = new File([blob], `planck_field_${Date.now()}.png`, { type: 'image/png' });
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    try {
                        await navigator.share({
                            title: 'Planck Field Simulation',
                            text: 'Check out this thermodynamic simulation state from Langevin\'s Wake.',
                            files: [file]
                        });
                    } catch (err) {
                        if (err.name !== 'AbortError') console.error(err);
                    }
                } else {
                    alert('Web Share with files is not supported on this browser/device.');
                }
            }, 'image/png');
        });

        bind('btn_export_vtk', () => {
            const wasPlaying = this.state.isPlaying;
            this.state.isPlaying = false;
            if (typeof this.bridge.generateVTK === 'function') {
                const vtkPtr = this.bridge.generateVTK();
                if (!vtkPtr || vtkPtr === 0) {
                    alert("Error: VTK buffer generation failed.");
                    this.state.isPlaying = wasPlaying;
                    return;
                }
                const vtkString = this.bridge.wasm.UTF8ToString(vtkPtr);
                const blob = new Blob([vtkString], { type: 'text/plain' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `planck_frame_${Date.now()}.vtk`;
                link.click();
                this.bridge.freeVTK();
            }
            this.state.isPlaying = wasPlaying;
        });

        // Palette Import / Export
        bind('btn_copy_stamp', () => {
            const stamp = this.palette.customStamp;
            if (!stamp || !stamp.length) {
                alert("Sample a region with the Sample tool first!");
                return;
            }
            navigator.clipboard.writeText(JSON.stringify(stamp));
        });

        bind('btn_export_palette', () => {
            const userPal = this.palette.userPalette;
            if (!userPal || Object.keys(userPal).length === 0) {
                alert("No custom stamps to export yet!");
                return;
            }
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(userPal));
            const dl = document.createElement('a');
            dl.setAttribute("href", dataStr);
            dl.setAttribute("download", "planck_custom_palette.json");
            dl.click();
        });

        const importInput = document.getElementById('import_palette_input');
        if (importInput) {
            importInput.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const imported = JSON.parse(ev.target.result);
                        this.palette.userPalette = { ...this.palette.userPalette, ...imported };
                        this.palette.fullPalette = { ...this.palette.fullPalette, ...this.palette.userPalette };
                        localStorage.setItem('planck_palette', JSON.stringify(this.palette.userPalette));
                        this.renderPalette();
                    } catch (err) {
                        alert("Invalid JSON palette file.");
                    }
                };
                reader.readAsText(file);
            };
        }

        bind('btn_reset_palette', () => {
            if (confirm("Delete all custom stamps? This cannot be undone.")) {
                this.palette.resetPalette();
                this.renderPalette();
            }
        });
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
