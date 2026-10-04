import { LAYER_LABELS, SPEED_DEFAULT_TPS } from './constants.js';
import { loadScenario, randomizeScenarioSoup, SCENARIO_DOSSIERS } from './scenarios.js';

export class ControlsManager {
    constructor({ bridge, palette, loop, state, rendererLeft, rendererRight, interaction }) {
        this.bridge = bridge;
        this.palette = palette;
        this.loop = loop;
        this.state = state;
        this.rendererLeft = rendererLeft;
        this.rendererRight = rendererRight;
        this.interaction = interaction;
        this.lastTPS = SPEED_DEFAULT_TPS;

        this.init();
    }

    init() {
        this.renderPalette();
        this.bindLayerButtons();
        this.bindScenarioDropdown();
        this.bindSegmentButtons();
        this.bindSliders();
        this.bindActionButtons();
        this.bindProjectionSelector();
        this.bindOutsideDismiss();
        this.bindKeyboard();
        this.updateDossierContent(this.state.currentScenario);
        this.updateGpuBadge();
    }

    // Single source of truth for run/pause so the slider, button, and
    // keyboard can never disagree about engine state.
    applySpeed(v) {
        const speedSlider = document.getElementById('slider_speed');
        const speedVal = document.getElementById('val_speed');
        const playBtn = document.getElementById('btn_play');
        if (v > 0) this.lastTPS = v;
        this.state.isPlaying = v > 0;
        this.loop.setTPS(v);
        if (speedVal) speedVal.innerText = v === 0 ? "Paused" : `${v} TPS`;
        if (speedSlider && parseInt(speedSlider.value, 10) !== v) speedSlider.value = v;
        if (playBtn) playBtn.innerText = v > 0 ? '⏸ Pause' : '▶ Play';
    }

    setPlaying(playing) {
        this.applySpeed(playing ? (this.lastTPS || SPEED_DEFAULT_TPS) : 0);
    }

    updateGpuBadge() {
        const badge = document.getElementById('gpu_status_badge');
        if (!badge) return;
        const active = (this.rendererLeft?.isWebGL || this.rendererRight?.isWebGL);
        badge.innerText = active ? "WebGL Active" : "2D Fallback";
        badge.style.color = active ? "var(--pf-brand-hover)" : "#888";
    }

    bindProjectionSelector() {
        this.setupGroup('projection_mode_selector', (mode) => {
            if (this.rendererLeft) {
                if (typeof this.rendererLeft.setProjectionMode === 'function') this.rendererLeft.setProjectionMode(mode);
                else if (typeof this.rendererLeft.setMode === 'function') this.rendererLeft.setMode(mode);
            }
            if (this.rendererRight) {
                if (typeof this.rendererRight.setProjectionMode === 'function') this.rendererRight.setProjectionMode(mode);
                else if (typeof this.rendererRight.setMode === 'function') this.rendererRight.setMode(mode);
            }
            this.state.forceRedraw = true;
        });
    }

    renderPalette() {
        const container = document.getElementById('brush_selector');
        if (!container) return;
        container.innerHTML = '';

        const stamp = this.palette.customStamp;
        const hasStamp = stamp && stamp.length > 0;

        const scratchBtn = document.createElement('button');
        scratchBtn.className = `palette-btn ${this.palette.currentBrush === 'custom' ? 'active' : ''}`;
        scratchBtn.id = 'opt_custom';

        if (hasStamp) {
            const h = stamp.length;
            const w = stamp[0].length;
            scratchBtn.innerHTML = `<span class="p-icon">⬚</span><span class="p-label">${w}x${h}</span>`;
            scratchBtn.onclick = () => { this.palette.currentBrush = 'custom'; this.renderPalette(); };
        } else {
            scratchBtn.innerHTML = `<span class="p-icon">🔍</span><span class="p-label">Sample</span>`;
            scratchBtn.onclick = () => {
                const sampleBtn = document.querySelector('.segment-btn[data-mode="sample"]');
                if (sampleBtn) sampleBtn.click();
            };
        }

        const elements = [];
        for (const [key, brush] of Object.entries(this.palette.fullPalette)) {
            const btn = document.createElement('button');
            btn.className = `palette-btn ${this.palette.currentBrush === key ? 'active' : ''}`;
            btn.innerHTML = `<span class="p-icon">${brush.icon}</span><span class="p-label">${brush.label}</span>`;
            btn.onclick = () => { this.palette.currentBrush = key; this.renderPalette(); };
            elements.push(btn);
        }

        elements.splice(3, 0, scratchBtn);
        elements.forEach(el => container.appendChild(el));
    }

    bindLayerButtons() {
        const btnL = document.getElementById('btn_toggle_left');
        const btnR = document.getElementById('btn_toggle_right');
        
        const updateBtn = (btn, layer) => {
            if (!btn) return;
            btn.innerHTML = `<span class="lens-tag">VIEW</span><span class="lens-label">${LAYER_LABELS[layer]}</span>`;
        };

        if (btnL) {
            updateBtn(btnL, this.state.leftLayer);
            btnL.onclick = () => {
                this.state.leftLayer = (this.state.leftLayer + 1) % 4;
                updateBtn(btnL, this.state.leftLayer);
                this.state.forceRedraw = true;
            };
        }
        if (btnR) {
            updateBtn(btnR, this.state.rightLayer);
            btnR.onclick = () => {
                this.state.rightLayer = (this.state.rightLayer + 1) % 4;
                updateBtn(btnR, this.state.rightLayer);
                this.state.forceRedraw = true;
            };
        }
    }

    bindScenarioDropdown() {
        const select = document.getElementById('scenario_dropdown');
        if (select) {
            select.value = this.state.currentScenario;
            select.onchange = (e) => {
                const val = e.target.value;
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

                this.updateDossierContent(val);
                this.state.forceRedraw = true;
            };
        }

        const infoBtn = document.getElementById('btn_scenario_info');
        const modal = document.getElementById('modal_scenario_info');
        const closeBtn = document.getElementById('btn_close_dossier');

        if (infoBtn && modal) {
            infoBtn.onclick = () => {
                this.updateDossierContent(this.state.currentScenario);
                modal.classList.toggle('show');
            };
        }
        if (closeBtn && modal) {
            closeBtn.onclick = () => modal.classList.remove('show');
        }
    }

    updateDossierContent(type) {
        const data = SCENARIO_DOSSIERS[type];
        if (!data) return;
        const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.innerText = txt; };
        setTxt('dossier_title', data.title);
        setTxt('dossier_objective', data.objective);
        setTxt('dossier_mechanisms', data.mechanisms);
        setTxt('dossier_brushes', data.recommendedBrushes.join(', '));
        setTxt('dossier_layers', data.bestLayers);
        setTxt('dossier_tips', data.tips);
    }

    // Handles the rigorous switching of UI mode tabs and drawers
    setMode(mode) {
        this.state.currentMode = mode;
        
        document.querySelectorAll('.segment-btn').forEach(b => 
            b.classList.toggle('active', b.dataset.mode === mode)
        );
        
        document.getElementById('context_place')?.classList.toggle('show', mode === 'place');
        document.getElementById('context_sample')?.classList.toggle('show', mode === 'sample');
        document.getElementById('context_config')?.classList.toggle('show', mode === 'config');

        // On mobile the drawers live below the canvas — bring the freshly
        // opened one into view so the mode change is visibly confirmed.
        if (mode !== 'move') {
            document.getElementById(`context_${mode}`)
                ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }

        // Mode-specific canvas cursors (move was never wired up after the refactor)
        const container = document.getElementById('canvas-container');
        if (container) {
            container.classList.toggle('mode-move', mode === 'move' || mode === 'config');
            container.classList.toggle('mode-place', mode === 'place');
            container.classList.toggle('mode-sample', mode === 'sample');
        }
    }

    bindSegmentButtons() {
        document.querySelectorAll('.segment-btn').forEach(btn => {
            btn.onclick = (e) => {
                const mode = e.currentTarget.dataset.mode;
                
                // If clicking an already active button, toggle it off and fallback to 'move'
                if (this.state.currentMode === mode) {
                    if (mode !== 'move') {
                        this.setMode('move');
                    }
                    return;
                }

                // Otherwise, switch to the requested mode and leave the drawer open
                this.setMode(mode);
            };
        });

        this.setupGroup('injection_mode_selector', (val) => { 
            this.state.injectionMode = val;
            const hint = document.getElementById('hint_injection_mode');
            if (hint) hint.innerText = val.toUpperCase();
        });
    }

    // Context drawers (Place, Config, Sample) NO LONGER dismiss when clicking the canvas.
    // They are completely persistent until the user explicitly toggles the segment button.
    bindOutsideDismiss() {
        this._onDocPointerDown = (e) => {
            const modal = document.getElementById('modal_scenario_info');
            const infoBtn = document.getElementById('btn_scenario_info');

            // Only the Scenario Dossier pop-over is dismissed on outside clicks.
            if (modal && modal.classList.contains('show') && !modal.contains(e.target) && !infoBtn?.contains(e.target)) {
                modal.classList.remove('show');
            }
        };
        document.addEventListener('pointerdown', this._onDocPointerDown);
    }

    bindKeyboard() {
        this._onKeyDown = (e) => {
            const tag = e.target?.tagName;
            const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable;

            if (e.code === 'Escape') {
                document.getElementById('modal_scenario_info')?.classList.remove('show');
                return;
            }
            if (typing) return;

            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
                e.preventDefault();
                this.bridge.restoreSnapshot();
                this.state.forceRedraw = true;
                return;
            }
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    this.state.isSpaceDown = true;
                    document.getElementById('canvas-container')?.classList.add('mode-move');
                    break;
                case 'KeyP':
                    this.setPlaying(!this.state.isPlaying);
                    break;
                case 'KeyR':
                    this.bridge.saveSnapshot();
                    randomizeScenarioSoup(this.state.currentScenario, this.bridge);
                    this.state.forceRedraw = true;
                    break;
                case 'KeyC':
                    this.bridge.saveSnapshot();
                    this.bridge.clearGrid();
                    this.state.forceRedraw = true;
                    break;
            }
        };
        this._onKeyUp = (e) => {
            if (e.code === 'Space') {
                this.state.isSpaceDown = false;
                if (this.state.currentMode !== 'move' && this.state.currentMode !== 'config') {
                    document.getElementById('canvas-container')?.classList.remove('mode-move');
                }
            }
        };
        this._onBlur = () => {
            this.state.isSpaceDown = false;
            if (this.state.currentMode !== 'move' && this.state.currentMode !== 'config') {
                document.getElementById('canvas-container')?.classList.remove('mode-move');
            }
        };
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        window.addEventListener('blur', this._onBlur);
    }

    destroy() {
        if (this._onDocPointerDown) document.removeEventListener('pointerdown', this._onDocPointerDown);
        if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown);
        if (this._onKeyUp) window.removeEventListener('keyup', this._onKeyUp);
        if (this._onBlur) window.removeEventListener('blur', this._onBlur);
    }

    bindSliders() {
        const speed = document.getElementById('slider_speed');
        if (speed) {
            speed.oninput = (e) => this.applySpeed(parseInt(e.target.value, 10));
        }

        const zoom = document.getElementById('slider_zoom');
        if (zoom) {
            zoom.oninput = (e) => {
                const v = parseFloat(e.target.value);
                this.state.zoom = v;
                document.getElementById('val_zoom').innerText = v.toFixed(1) + 'x';
                
                if (this.interaction) {
                    this.interaction.zoom = v;
                    this.interaction.constrainView();
                    this.interaction.applyTransform();
                }
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

        const imp = document.getElementById('chk_impedance');
        if (imp) {
            imp.onchange = (e) => this.bridge.setImpedanceMode(e.target.checked ? 1 : 0);
        }
    }

    bindActionButtons() {
        const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
        
        bind('btn_injection_info', () => {
            alert("INJECTION MATRIX\n\nCLONE (Default):\nOverwrites reality. Punches rigid holes through matter.\n\nDENSITY:\nFluid displacement. Splashes and mixes naturally with oceans and gases.\n\nHEAT:\nInjects pure thermal energy without adding mass.\n\nSPIN:\nAlters directional momentum without adding mass.");
        });
        
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
        bind('btn_play', () => this.setPlaying(!this.state.isPlaying));
        bind('btn_step', () => {
            this.setPlaying(false);
            this.bridge.tick();
            if (typeof this.loop.onTelemetry === 'function') this.loop.onTelemetry(this.bridge);
            this.state.forceRedraw = true;
        });
        bind('btn_save_scratch', () => { 
            this.palette.saveCurrentCopy(); 
            this.renderPalette(); 
            const btn = document.getElementById('btn_save_scratch');
            if (btn) btn.disabled = true;
        });

        bind('btn_export_png', () => {
            const composite = this.compositeCanvas();
            if (!composite) return;
            const link = document.createElement('a');
            link.href = composite.toDataURL('image/png');
            link.download = `planck_field_${Date.now()}.png`;
            link.click();
        });

        bind('btn_share', async () => {
            const composite = this.compositeCanvas();
            if (!composite) return;
            try {
                const dataUrl = composite.toDataURL('image/png');
                const blob = await (await fetch(dataUrl)).blob();
                const file = new File([blob], `planck_field_${Date.now()}.png`, { type: 'image/png' });
                
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: 'Planck Field Simulation',
                        text: 'Check out this thermodynamic simulation state from Langevin\'s Wake.',
                        files: [file]
                    });
                } else {
                    alert('Web Share with files is not supported on this browser/device.');
                }
            } catch (err) {
                if (err.name !== 'AbortError') console.error("Share failed:", err);
            }
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

    // Renders both layer views side-by-side into a single exportable canvas.
    compositeCanvas() {
        const l = document.getElementById('canvas_left');
        const r = document.getElementById('canvas_right');
        if (!l || !r) return null;
        const c = document.createElement('canvas');
        c.width = l.width + r.width;
        c.height = Math.max(l.height, r.height);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(l, 0, 0);
        ctx.drawImage(r, l.width, 0);
        return c;
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
