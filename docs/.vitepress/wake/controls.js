import { LAYER_LABELS, SPEED_DEFAULT_TPS, SPEED_MAX_TPS, UNDO_MAX_DEPTH, UNDO_WINDOW_TICKS, AUTOSAVE_INTERVAL_MS, TOPOLOGY_KEY } from './constants.js';
import { loadScenario, randomizeScenarioSoup, SCENARIO_DOSSIERS } from './scenarios.js';
import { WakeLockManager } from './wakelock.js';
import { saveSimState } from './persist.js';

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

        // Undo buffer depth (display mirrors the engine's own snap_count)
        this.undoDepth = 0;
        this.lastCheckpointTick = 0;

        // Screen wake lock: held while the sim plays (see wakelock.js)
        this.wakeLock = new WakeLockManager();

        this._onPageHide = () => saveSimState(this.bridge, this.state.currentScenario, this.state.topology);

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
        this.bindSubstrateSelector();
        this.bindOutsideDismiss();
        this.bindKeyboard();
        this.updateDossierContent(this.state.currentScenario);
        this.updateGpuBadge();
        this.updateUndoFill();

        // Periodic autosave + a final flush when the page is hidden/closed
        this._autosaveInterval = setInterval(
            () => saveSimState(this.bridge, this.state.currentScenario, this.state.topology),
            AUTOSAVE_INTERVAL_MS
        );
        window.addEventListener('pagehide', this._onPageHide);
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
        this.wakeLock.setActive(v > 0);
        if (speedVal) speedVal.innerText = v === 0 ? "Paused" : `${v} TPS`;
        if (speedSlider && parseInt(speedSlider.value, 10) !== v) speedSlider.value = v;
        if (playBtn) playBtn.innerText = v > 0 ? '⏸ Pause' : '▶ Play';
    }

    setPlaying(playing) {
        this.applySpeed(playing ? (this.lastTPS || SPEED_DEFAULT_TPS) : 0);
    }

    // Undo-aware mutation wrapper: snapshot the grid, run the change, flag redraw.
    mutate(fn) {
        if (this.state.undoEnabled) {
            this.bridge.saveSnapshot();
            this.pushUndoDepth();
        }
        const result = fn();
        this.state.forceRedraw = true;
        this.scheduleAutosave();
        return result;
    }

    // Debounced autosave after user mutations (the interval handles play).
    scheduleAutosave() {
        clearTimeout(this._autosaveTimer);
        this._autosaveTimer = setTimeout(
            () => saveSimState(this.bridge, this.state.currentScenario, this.state.topology),
            1500
        );
    }

    // --- Undo Buffer ---
    // The engine holds a small ring of snapshots. Every mutation pushes a
    // checkpoint; while the sim plays, a roller pushes one every
    // UNDO_WINDOW_TICKS so "letting it run" gradually refills the buffer.
    // Undo pops the newest checkpoint and the button's fill gradient shows
    // how much depth remains.

    pushUndoDepth() {
        this.undoDepth = Math.min(UNDO_MAX_DEPTH, this.undoDepth + 1);
        this.updateUndoFill();
    }

    // Called by InteractionManager when a stroke-start checkpoint is consumed
    // by the pinch stray-stamp revert (net effect: checkpoint spent, no undo).
    popUndoDepth() {
        this.undoDepth = Math.max(0, this.undoDepth - 1);
        this.updateUndoFill();
    }

    // Called once per engine tick via EngineLoop.onTick.
    onEngineTick(frameCount) {
        if (!this.state.undoEnabled) return;
        if (frameCount - this.lastCheckpointTick >= UNDO_WINDOW_TICKS) {
            this.lastCheckpointTick = frameCount;
            this.bridge.saveSnapshot();
            this.pushUndoDepth();
        }
    }

    setUndoEnabled(enabled) {
        this.state.undoEnabled = enabled;
        this.bridge.setUndoEnabled(enabled);
        this.undoDepth = 0;
        this.updateUndoFill();
    }

    undo() {
        if (!this.state.undoEnabled || this.undoDepth <= 0) return;
        // Snapshots capture raw field bytes only — cumulative engine stats
        // (yield) aren't rolled back, so they drift from the restored state.
        this.bridge.restoreSnapshot();
        this.undoDepth--;
        this.updateUndoFill();
        this.state.forceRedraw = true;
    }

    updateUndoFill() {
        // The engine tracks its own ring depth — prefer it over the JS mirror.
        const engineDepth = this.bridge.getSnapshotCount();
        if (engineDepth >= 0) this.undoDepth = Math.min(UNDO_MAX_DEPTH, engineDepth);

        const btn = document.getElementById('btn_undo');
        if (!btn) return;
        const pct = (this.undoDepth / UNDO_MAX_DEPTH) * 100;
        btn.style.setProperty('--undo-fill', pct + '%');
        btn.title = `Undo (${this.undoDepth}/${UNDO_MAX_DEPTH}) — Ctrl+Z · restores field only, stats persist`;
    }

    downloadBlob(blob, filename) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }

    updateGpuBadge() {
        const badge = document.getElementById('gpu_status_badge');
        if (!badge) return;
        const active = (this.rendererLeft?.isWebGL || this.rendererRight?.isWebGL);
        badge.innerText = active ? "WebGL Active" : "2D Fallback";
        badge.style.color = active ? "var(--pf-brand-hover)" : "#888";

        // Hex/oct projections are shader effects — the 2D fallback blits
        // raw pixels and can't honor them, so the buttons must not lie.
        document.querySelectorAll('#projection_mode_selector .group-btn').forEach(btn => {
            const needsGl = btn.dataset.val !== 'quad';
            btn.disabled = needsGl && !active;
            btn.title = btn.disabled ? 'Requires WebGL' : '';
        });
    }

    bindProjectionSelector() {
        // Boot-state sync: the substrate decides the honest projection
        // (hex stagger on hex6, oct chamfer on oct8) — markup can't know
        // which engine booted, so the state flag owns the active class.
        document.querySelectorAll('#projection_mode_selector .group-btn').forEach(btn =>
            btn.classList.toggle('active', btn.dataset.val === this.state.projection)
        );
        this.rendererLeft?.setMode(this.state.projection);
        this.rendererRight?.setMode(this.state.projection);

        this.setupGroup('projection_mode_selector', (mode) => {
            this.state.projection = mode;
            this.rendererLeft?.setMode(mode);
            this.rendererRight?.setMode(mode);
            this.state.forceRedraw = true;
        });
    }

    // The substrate switch reboots the simulator on the other engine
    // module — the Vue wrapper listens for 'wake:topology' and re-runs
    // initWakeSimulator. The current field autosaves under its own
    // topology tag first, so each universe keeps its own field.
    bindSubstrateSelector() {
        const container = document.getElementById('substrate_selector');
        if (!container) return;
        container.querySelectorAll('.group-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.val === this.state.topology);
            btn.onclick = () => {
                const val = btn.dataset.val;
                if (val === this.state.topology) return;
                const label = val === 'hex' ? 'hex6 (6-fold adjacency)' : 'oct8 (8-fold Moore)';
                if (!confirm(`Rebuild the universe on the ${label} substrate?\n\nThe current field autosaves tagged to its own adjacency — switching back restores your session.`)) return;
                saveSimState(this.bridge, this.state.currentScenario, this.state.topology);
                localStorage.setItem(TOPOLOGY_KEY, val);
                window.dispatchEvent(new CustomEvent('wake:topology'));
            };
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
                this.state.leftLayer = (this.state.leftLayer + 1) % LAYER_LABELS.length;
                updateBtn(btnL, this.state.leftLayer);
                this.state.forceRedraw = true;
            };
        }
        if (btnR) {
            updateBtn(btnR, this.state.rightLayer);
            btnR.onclick = () => {
                this.state.rightLayer = (this.state.rightLayer + 1) % LAYER_LABELS.length;
                updateBtn(btnR, this.state.rightLayer);
                this.state.forceRedraw = true;
            };
        }
    }

    bindScenarioDropdown() {
        const select = document.getElementById('scenario_dropdown');
        if (select) {
            // Options are scoped to the active substrate — a hex-native
            // scenario can't run on oct8 and vice versa.
            select.innerHTML = '';
            for (const [key, d] of Object.entries(SCENARIO_DOSSIERS)) {
                if (!(d.topologies || ['square']).includes(this.state.topology)) continue;
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = d.title;
                select.appendChild(opt);
            }
            select.value = this.state.currentScenario;
            select.onchange = (e) => {
                const val = e.target.value;
                this.state.currentScenario = val;
                const res = this.mutate(() => loadScenario(val, this.bridge, this.state.topology));
                
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
                if (modal.classList.contains('show')) this.closeDossier();
                else this.openDossier();
            };
        }
        if (closeBtn && modal) {
            closeBtn.onclick = () => this.closeDossier();
        }
    }

    openDossier() {
        const modal = document.getElementById('modal_scenario_info');
        if (!modal) return;
        this.updateDossierContent(this.state.currentScenario);
        this._prevFocus = document.activeElement;
        modal.classList.add('show');
        document.getElementById('btn_close_dossier')?.focus();
    }

    closeDossier() {
        const modal = document.getElementById('modal_scenario_info');
        if (!modal || !modal.classList.contains('show')) return;
        modal.classList.remove('show');
        if (this._prevFocus && typeof this._prevFocus.focus === 'function') this._prevFocus.focus();
        this._prevFocus = null;
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

    // Drawers track mode but have their own visibility flag — a second tap
    // on the active tool collapses its drawer without disarming the tool.
    renderModeUI() {
        const mode = this.state.currentMode;
        const open = this.state.drawerVisible;
        document.getElementById('context_place')?.classList.toggle('show', mode === 'place' && open);
        document.getElementById('context_sample')?.classList.toggle('show', mode === 'sample' && open);
        document.getElementById('context_config')?.classList.toggle('show', mode === 'config' && open);

        // Mode-specific canvas cursors (move was never wired up after the refactor)
        const container = document.getElementById('canvas-container');
        if (container) {
            container.classList.toggle('mode-move', mode === 'move' || mode === 'config');
            container.classList.toggle('mode-place', mode === 'place');
            container.classList.toggle('mode-sample', mode === 'sample');
        }
    }

    // Handles the rigorous switching of UI mode tabs and drawers
    setMode(mode) {
        this.state.currentMode = mode;
        this.state.drawerVisible = mode !== 'move';

        document.querySelectorAll('.segment-btn').forEach(b =>
            b.classList.toggle('active', b.dataset.mode === mode)
        );

        this.renderModeUI();

        // On mobile the drawers live below the canvas — bring the freshly
        // opened one into view so the mode change is visibly confirmed.
        if (mode !== 'move') {
            document.getElementById(`context_${mode}`)
                ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }

        this.interaction?.hideBrushPreview();
    }

    bindSegmentButtons() {
        document.querySelectorAll('.segment-btn').forEach(btn => {
            btn.onclick = (e) => {
                const mode = e.currentTarget.dataset.mode;

                if (this.state.currentMode === mode) {
                    if (mode === 'config') {
                        // System dismisses back to Move entirely.
                        this.setMode('move');
                    } else if (mode !== 'move') {
                        // Place/Sample: collapse or reopen the drawer but
                        // keep the tool armed — a stamp or capture in
                        // progress is never cancelled by the button.
                        this.state.drawerVisible = !this.state.drawerVisible;
                        this.renderModeUI();
                        if (this.state.drawerVisible) {
                            document.getElementById(`context_${mode}`)
                                ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                        }
                    }
                    return;
                }

                this.setMode(mode);
            };
        });

        this.bindInjectionToggles();
        this.bindDoseSliders();
    }

    // Injection channels are independent toggles, not a radio group —
    // Density/Heat/Spin each inject only their own component, and all
    // three enabled is a verbatim Clone write. The last enabled channel
    // can't be toggled off (a stamp with no channels would inject nothing).
    bindInjectionToggles() {
        document.querySelectorAll('#injection_mode_selector .group-btn').forEach(btn => {
            btn.onclick = () => {
                const val = btn.dataset.val;
                if (val === 'clone') {
                    this.setInjectionChannels({ quanta: true, heat: true, spin: true });
                    return;
                }
                const next = { ...this.state.injectionChannels, [val]: !this.state.injectionChannels[val] };
                if (!next.quanta && !next.heat && !next.spin) next[val] = true;
                this.setInjectionChannels(next);
            };
        });
        // Sync active classes, aria-pressed, and the hint to initial state
        this.setInjectionChannels(this.state.injectionChannels);
    }

    setInjectionChannels(ch) {
        this.state.injectionChannels = { ...ch };
        const allOn = ch.quanta && ch.heat && ch.spin;
        document.querySelectorAll('#injection_mode_selector .group-btn').forEach(b => {
            const active = b.dataset.val === 'clone' ? allOn : !!ch[b.dataset.val];
            b.classList.toggle('active', active);
            b.setAttribute('aria-pressed', String(active));
        });
        // Dose sliders only mean something when their channel is active and
        // the write isn't a verbatim clone — gray them out honestly otherwise.
        ['quanta', 'heat', 'spin'].forEach(k => {
            const s = document.getElementById(`dose_${k}`);
            if (s) s.disabled = allOn || !ch[k];
        });

        const hint = document.getElementById('hint_injection_mode');
        if (hint) {
            const CHANNEL_LABELS = { quanta: 'DENSITY', heat: 'HEAT', spin: 'SPIN' };
            hint.innerText = allOn ? 'CLONE'
                : Object.keys(CHANNEL_LABELS).filter(k => ch[k]).map(k => CHANNEL_LABELS[k]).join(' + ');
        }
    }

    bindDoseSliders() {
        ['quanta', 'heat', 'spin'].forEach(k => {
            const s = document.getElementById(`dose_${k}`);
            if (s) s.oninput = (e) => {
                const v = parseInt(e.target.value, 10);
                this.state.injectionDose[k] = v;
                const label = document.getElementById(`val_dose_${k}`);
                if (label) label.innerText = v + '%';
            };
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
                this.closeDossier();
            }
        };
        document.addEventListener('pointerdown', this._onDocPointerDown);
    }

    bindKeyboard() {
        this._onKeyDown = (e) => {
            const tag = e.target?.tagName;
            const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable;
            const modal = document.getElementById('modal_scenario_info');
            const modalOpen = modal?.classList.contains('show');
            const canvasEl = document.getElementById('canvas-container');
            const canvasFocused = document.activeElement === canvasEl;

            if (e.code === 'Escape') {
                if (modalOpen) this.closeDossier();
                else if (canvasFocused) canvasEl.blur(); // release arrow keys
                return;
            }

            // Focus trap: keep Tab cycling inside the open dossier modal
            if (modalOpen && e.code === 'Tab') {
                const focusables = modal.querySelectorAll('button, [href], input, select, [tabindex]:not([tabindex="-1"])');
                if (focusables.length) {
                    const first = focusables[0];
                    const last = focusables[focusables.length - 1];
                    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
                }
                return;
            }
            if (typing) return;

            // Keyboard brush cursor — only when the canvas itself holds focus,
            // so arrows keep their normal scrolling behavior elsewhere.
            if (canvasFocused && (e.code === 'Enter' || e.code === 'NumpadEnter')) {
                e.preventDefault();
                this.interaction?.stampAtCursor();
                return;
            }
            if (canvasFocused && e.code.startsWith('Arrow')) {
                e.preventDefault();
                const step = e.shiftKey ? 10 : 1;
                const d = { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] }[e.code];
                const mode = this.state.currentMode;
                if (mode === 'place' || mode === 'sample') this.interaction?.moveBrushCursor(d[0], d[1]);
                else this.interaction?.panBy(d[0] * -20, d[1] * -20);
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
                e.preventDefault();
                if (this.state.undoEnabled) this.undo();
                return;
            }
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            switch (e.code) {
                case 'Space':
                    // A focused button must keep its native Space-to-activate
                    // behavior — space-pan is for the canvas and body, not for
                    // hijacking control activation.
                    if (tag === 'BUTTON') break;
                    e.preventDefault();
                    this.state.isSpaceDown = true;
                    document.getElementById('canvas-container')?.classList.add('mode-move');
                    break;
                case 'KeyP':
                    this.setPlaying(!this.state.isPlaying);
                    break;
                case 'KeyR':
                    this.mutate(() => randomizeScenarioSoup(this.state.currentScenario, this.bridge, this.state.topology));
                    break;
                case 'KeyC':
                    this.mutate(() => this.bridge.clearGrid());
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
        this.wakeLock.destroy();
        clearInterval(this._autosaveInterval);
        clearTimeout(this._autosaveTimer);
        window.removeEventListener('pagehide', this._onPageHide);
    }

    bindSliders() {
        const speed = document.getElementById('slider_speed');
        if (speed) {
            speed.max = SPEED_MAX_TPS;
            speed.oninput = (e) => this.applySpeed(parseInt(e.target.value, 10));
        }

        const radius = document.getElementById('slider_radius');
        if (radius) {
            radius.oninput = (e) => {
                const vr = document.getElementById('val_radius');
                if (vr) vr.innerText = e.target.value;
            };
        }

        const zoom = document.getElementById('slider_zoom');
        if (zoom) {
            zoom.oninput = (e) => {
                const v = parseFloat(e.target.value);
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

        const undoChk = document.getElementById('chk_undo');
        if (undoChk) {
            undoChk.onchange = (e) => this.setUndoEnabled(e.target.checked);
        }

        const iobufChk = document.getElementById('chk_iobuf');
        if (iobufChk) {
            iobufChk.onchange = (e) => this.bridge.setIOBufMode(e.target.checked ? 1 : 0);
        }
    }

    bindActionButtons() {
        const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
        
        bind('btn_injection_info', () => {
            alert("INJECTION MATRIX\n\nChannels toggle independently — combine them freely. Each slider sets that channel's dose (% of the stamp's stored value per node); sliders are ignored during a verbatim Clone write.\n\nCLONE (all channels on):\nOverwrites reality verbatim. Punches rigid holes through matter (and empty cells erase).\n\nDENSITY:\nFluid displacement only. Splashes and mixes naturally with oceans and gases.\n\nHEAT:\nInjects pure thermal energy without adding mass.\n\nSPIN:\nAlters directional momentum without adding mass. Its slider is an imposition dial — 100% forces the stamp's direction, 0% entrains nodes to the dominant ambient flow, and values between blend the two per node.");
        });
        
        bind('btn_reset', () =>
            this.mutate(() => loadScenario(this.state.currentScenario, this.bridge, this.state.topology)));
        bind('btn_soup', () =>
            this.mutate(() => randomizeScenarioSoup(this.state.currentScenario, this.bridge, this.state.topology)));
        bind('btn_clear', () =>
            this.mutate(() => this.bridge.clearGrid()));
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
                this.downloadBlob(
                    new Blob([vtkString], { type: 'text/plain' }),
                    `planck_frame_${Date.now()}.vtk`
                );
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
            this.downloadBlob(
                new Blob([JSON.stringify(userPal)], { type: 'application/json' }),
                'planck_custom_palette.json'
            );
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

    // Renders the on-screen split field (each canvas holds its own half of
    // the view window) into a single exportable canvas — this is also the
    // source a future captureStream()/timelapse pump would draw each frame.
    compositeCanvas() {
        const l = document.getElementById('canvas_left');
        const r = document.getElementById('canvas_right');
        if (!l || !r) return null;
        const c = document.createElement('canvas');
        c.width = l.width + r.width;
        c.height = l.height;
        const ctx = c.getContext('2d');
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
