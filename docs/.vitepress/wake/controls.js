import { LAYER_LABELS, SPEED_DEFAULT_TPS, SPEED_MAX_TPS, UNDO_MAX_DEPTH, UNDO_WINDOW_TICKS, AUTOSAVE_INTERVAL_MS, TOPOLOGY_KEY } from './constants.js';
import { loadScenario, randomizeScenarioSoup, SCENARIO_DOSSIERS } from './scenarios.js';
import { composeScenario, defaultSpec, PRIMITIVES, validateSpec } from './painter.js';
import { WakeLockManager } from './wakelock.js';
import {
    saveSimState,
    saveCustomScenario,
    listCustomScenarios,
    deleteCustomScenario,
    exportScenarioFile,
    importScenarioFile
} from './persist.js';

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

        // Composer library — saved custom specs keyed by id; loaded
        // async from IndexedDB (customsReady resolves once the dropdown
        // reflects them). editSpec is the working copy in the composer.
        this.customSpecs = new Map();
        this.editSpec = null;
        this.customsReady = this.loadCustomScenarios();

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
        this.bindComposer();
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

    // Paints a scenario key onto the field: built-ins run through
    // scenarios.js, `custom:<id>` keys compose a saved painter spec.
    // Returns the { targetDissipation, targetThermal } both produce.
    runScenario(key) {
        if (key?.startsWith('custom:')) {
            const spec = this.customSpecs.get(key.slice(7));
            if (spec) return composeScenario(spec, this.bridge, this.state.topology);
            // Spec was deleted out from under the key — don't blank the
            // field, fall back to the substrate's flagship.
            key = this.state.topology === 'hex' ? 'filament' : 'vacuum';
            this.state.currentScenario = key;
        }
        return loadScenario(key, this.bridge, this.state.topology);
    }

    async loadCustomScenarios() {
        this.customSpecs = new Map();
        for (const spec of await listCustomScenarios()) {
            if (spec && spec.id) this.customSpecs.set(spec.id, spec);
        }
        this.rebuildScenarioOptions();
    }

    rebuildScenarioOptions() {
        const select = document.getElementById('scenario_dropdown');
        if (!select) return;
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
        for (const [id, spec] of this.customSpecs) {
            if (!(spec.topologies || ['square', 'hex']).includes(this.state.topology)) continue;
            const opt = document.createElement('option');
            opt.value = `custom:${id}`;
            opt.textContent = `🎨 ${spec.name}`;
            select.appendChild(opt);
        }
        if (this.state.currentScenario &&
            !select.querySelector(`option[value="${this.state.currentScenario}"]`)) {
            // Current pick isn't valid on this substrate — the field
            // still holds it, but the dropdown should show the flagship.
            this.state.currentScenario = this.state.topology === 'hex' ? 'filament' : 'vacuum';
        }
        select.value = this.state.currentScenario;
    }

    bindScenarioDropdown() {
        const select = document.getElementById('scenario_dropdown');
        if (select) {
            this.rebuildScenarioOptions();
            select.onchange = (e) => {
                const val = e.target.value;
                this.state.currentScenario = val;
                const res = this.mutate(() => this.runScenario(val));
                
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
        let data = SCENARIO_DOSSIERS[type];
        if (!data && type?.startsWith('custom:')) {
            const spec = this.customSpecs.get(type.slice(7));
            if (spec) {
                // A painted spec's "dossier" is its layer stack —
                // mechanisms read straight off the composition.
                const layerNames = spec.layers.map(l => PRIMITIVES[l.prim]?.label || l.prim);
                data = {
                    title: `🎨 ${spec.name}`,
                    objective: 'User-authored composition — a painted initial condition.',
                    mechanisms: layerNames.length ? layerNames.join(' → ') : 'Empty field',
                    recommendedBrushes: ['✏️ Any — the field is yours'],
                    bestLayers: '👁 Macro + 🕳 Entropic',
                    tips: 'Reopen the 🎨 Composer any time to tweak parameters, restack layers, or re-paint.'
                };
            }
        }
        if (!data) return;
        const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.innerText = txt; };
        setTxt('dossier_title', data.title);
        setTxt('dossier_objective', data.objective);
        setTxt('dossier_mechanisms', data.mechanisms);
        setTxt('dossier_brushes', data.recommendedBrushes.join(', '));
        setTxt('dossier_layers', data.bestLayers);
        setTxt('dossier_tips', data.tips);
    }

    // --- Scenario Composer ---
    // Edits a declarative painter spec (painter.js), not grid bytes.
    // Apply composes the spec through the normal mutate/undo path;
    // Save persists it to the IndexedDB library where it becomes a
    // selectable `custom:<id>` scenario.

    openComposer() {
        const modal = document.getElementById('modal_composer');
        if (!modal) return;
        // Editing the active custom scenario clones its spec; anything
        // else starts a fresh spec seeded with the live environment knobs.
        const active = this.state.currentScenario?.startsWith('custom:')
            ? this.customSpecs.get(this.state.currentScenario.slice(7)) : null;
        this.editSpec = active
            ? JSON.parse(JSON.stringify(active))
            : { ...defaultSpec(),
                knobs: {
                    dissipation: parseInt(document.getElementById('slider_dissipation')?.value ?? 15, 10),
                    thermal: parseInt(document.getElementById('slider_thermal')?.value ?? 50000, 10)
                } };
        this.syncComposerInputs();
        this.renderComposerLayers();
        this._prevFocusComposer = document.activeElement;
        modal.classList.add('show');
        document.getElementById('composer_name')?.focus();
    }

    closeComposer() {
        const modal = document.getElementById('modal_composer');
        if (!modal || !modal.classList.contains('show')) return;
        modal.classList.remove('show');
        if (this._prevFocusComposer && typeof this._prevFocusComposer.focus === 'function') {
            this._prevFocusComposer.focus();
        }
        this._prevFocusComposer = null;
    }

    get composerOpen() {
        return document.getElementById('modal_composer')?.classList.contains('show');
    }

    // Pulls the header inputs (name, substrate, knobs) into editSpec.
    syncComposerSpec() {
        const s = this.editSpec;
        if (!s) return s;
        const name = document.getElementById('composer_name');
        if (name) s.name = name.value.trim() || 'Custom Scenario';
        const sub = document.getElementById('composer_substrate');
        if (sub) {
            s.topologies = sub.value === 'both' ? ['square', 'hex'] : [sub.value];
        }
        const diss = document.getElementById('composer_dissipation');
        const therm = document.getElementById('composer_thermal');
        if (diss) s.knobs.dissipation = parseInt(diss.value, 10);
        if (therm) s.knobs.thermal = parseInt(therm.value, 10);
        return s;
    }

    // Pushes editSpec into the header inputs.
    syncComposerInputs() {
        const s = this.editSpec;
        const name = document.getElementById('composer_name');
        if (name) name.value = s.name;
        const sub = document.getElementById('composer_substrate');
        if (sub) {
            const list = s.topologies || ['square', 'hex'];
            sub.value = list.length > 1 ? 'both' : list[0];
        }
        const diss = document.getElementById('composer_dissipation');
        const therm = document.getElementById('composer_thermal');
        if (diss) diss.value = s.knobs.dissipation;
        if (therm) therm.value = s.knobs.thermal;
        const vd = document.getElementById('val_composer_dissipation');
        const vt = document.getElementById('val_composer_thermal');
        if (vd) vd.innerText = s.knobs.dissipation;
        if (vt) vt.innerText = s.knobs.thermal;
        const delBtn = document.getElementById('btn_composer_delete');
        if (delBtn) delBtn.disabled = !(s.id && this.customSpecs.has(s.id));
    }

    renderComposerLayers() {
        const container = document.getElementById('composer_layers');
        if (!container || !this.editSpec) return;
        container.innerHTML = '';
        const layers = this.editSpec.layers;

        if (!layers.length) {
            const empty = document.createElement('div');
            empty.className = 'composer-empty';
            empty.innerText = 'No paint yet — add a primitive layer below.';
            container.appendChild(empty);
        }

        layers.forEach((layer, i) => {
            const prim = PRIMITIVES[layer.prim];
            if (!prim) return;

            const row = document.createElement('div');
            row.className = 'composer-layer';

            // Header: primitive picker + reorder + delete
            const head = document.createElement('div');
            head.className = 'composer-layer-head';
            const primSel = document.createElement('select');
            primSel.className = 'scenario-select';
            for (const [key, p] of Object.entries(PRIMITIVES)) {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = p.label;
                primSel.appendChild(opt);
            }
            primSel.value = layer.prim;
            primSel.onchange = () => {
                // Switching primitives resets params to that primitive's defaults.
                const p = {};
                for (const [k, d] of Object.entries(PRIMITIVES[primSel.value].params)) p[k] = d.def;
                layers[i] = { prim: primSel.value, p };
                this.renderComposerLayers();
            };
            head.appendChild(primSel);

            const mkBtn = (txt, title, fn, disabled = false) => {
                const b = document.createElement('button');
                b.className = 'composer-layer-btn';
                b.innerText = txt;
                b.title = title;
                b.disabled = disabled;
                b.onclick = fn;
                return b;
            };
            head.appendChild(mkBtn('↑', 'Paint earlier', () => {
                if (i === 0) return;
                [layers[i - 1], layers[i]] = [layers[i], layers[i - 1]];
                this.renderComposerLayers();
            }, i === 0));
            head.appendChild(mkBtn('↓', 'Paint later', () => {
                if (i === layers.length - 1) return;
                [layers[i + 1], layers[i]] = [layers[i], layers[i + 1]];
                this.renderComposerLayers();
            }, i === layers.length - 1));
            head.appendChild(mkBtn('✕', 'Remove layer', () => {
                layers.splice(i, 1);
                this.renderComposerLayers();
            }));
            row.appendChild(head);

            const hint = document.createElement('div');
            hint.className = 'composer-layer-hint';
            hint.innerText = prim.hint;
            row.appendChild(hint);

            // Params auto-generated from the primitive's schema.
            const params = document.createElement('div');
            params.className = 'composer-params';
            for (const [pk, d] of Object.entries(prim.params)) {
                const wrap = document.createElement('div');
                wrap.className = 'composer-param';
                const lbl = document.createElement('label');
                lbl.innerText = d.label;
                wrap.appendChild(lbl);
                if (d.type === 'select') {
                    const sel = document.createElement('select');
                    sel.className = 'scenario-select';
                    for (const [v, txt] of Object.entries(d.opts)) {
                        const opt = document.createElement('option');
                        opt.value = v;
                        opt.textContent = txt;
                        sel.appendChild(opt);
                    }
                    sel.value = layer.p[pk] ?? d.def;
                    sel.onchange = () => { layer.p[pk] = sel.value; };
                    wrap.appendChild(sel);
                } else {
                    const inp = document.createElement('input');
                    inp.type = 'number';
                    inp.min = d.min;
                    inp.max = d.max;
                    inp.step = d.step;
                    inp.value = layer.p[pk] ?? d.def;
                    inp.onchange = () => {
                        let v = parseInt(inp.value, 10);
                        if (isNaN(v)) v = d.def;
                        layer.p[pk] = Math.min(d.max, Math.max(d.min, v));
                        inp.value = layer.p[pk];
                    };
                    wrap.appendChild(inp);
                }
                params.appendChild(wrap);
            }
            row.appendChild(params);
            container.appendChild(row);
        });
    }

    applyComposer() {
        const spec = this.syncComposerSpec();
        try {
            validateSpec(spec);
        } catch (err) {
            alert(`Invalid scenario: ${err.message}`);
            return;
        }
        const res = this.mutate(() => composeScenario(spec, this.bridge, this.state.topology));
        // Reflect the spec's environment on the main sliders
        const sd = document.getElementById('slider_dissipation');
        const st = document.getElementById('slider_thermal');
        if (sd) { sd.value = res.targetDissipation; document.getElementById('math_dissipation').innerText = res.targetDissipation; }
        if (st) { st.value = res.targetThermal; document.getElementById('math_thermal_limit').innerText = res.targetThermal; }
        // If the applied spec is a saved custom, bind the scenario state
        // to it so Reset/Random/dossier repaint the same composition.
        if (spec.id && this.customSpecs.has(spec.id)) {
            this.state.currentScenario = `custom:${spec.id}`;
            const dd = document.getElementById('scenario_dropdown');
            if (dd) dd.value = this.state.currentScenario;
            this.updateDossierContent(this.state.currentScenario);
        }
        this.closeComposer();
    }

    async saveComposerSpec() {
        const spec = this.syncComposerSpec();
        try {
            validateSpec(spec);
        } catch (err) {
            alert(`Invalid scenario: ${err.message}`);
            return;
        }
        if (!spec.id) spec.id = `c${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
        const ok = await saveCustomScenario(spec);
        if (!ok) {
            alert('Save failed — browser storage may be unavailable (private mode?).');
            return;
        }
        await this.loadCustomScenarios();
        // Make the saved spec the live scenario so Reset/Random/dossier follow it
        this.state.currentScenario = `custom:${spec.id}`;
        const dd = document.getElementById('scenario_dropdown');
        if (dd) dd.value = this.state.currentScenario;
        this.updateDossierContent(this.state.currentScenario);
        const delBtn = document.getElementById('btn_composer_delete');
        if (delBtn) delBtn.disabled = false;
        const btn = document.getElementById('btn_composer_save');
        if (btn) {
            btn.innerText = '✅ Saved';
            setTimeout(() => { btn.innerText = '💾 Save'; }, 1500);
        }
    }

    bindComposer() {
        const modal = document.getElementById('modal_composer');
        const openBtn = document.getElementById('btn_composer');
        const closeBtn = document.getElementById('btn_close_composer');
        if (!modal || !openBtn) return;

        // Primitive picker for new layers
        const addSel = document.getElementById('composer_add_prim');
        if (addSel) {
            for (const [key, p] of Object.entries(PRIMITIVES)) {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = p.label;
                addSel.appendChild(opt);
            }
        }

        openBtn.onclick = () => {
            if (this.composerOpen) this.closeComposer();
            else this.openComposer();
        };
        if (closeBtn) closeBtn.onclick = () => this.closeComposer();

        const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };

        bind('btn_add_layer', () => {
            const prim = addSel?.value || 'anchor';
            const p = {};
            for (const [k, d] of Object.entries(PRIMITIVES[prim].params)) p[k] = d.def;
            this.editSpec.layers.push({ prim, p });
            this.renderComposerLayers();
        });

        bind('btn_composer_apply', () => this.applyComposer());
        bind('btn_composer_save', () => this.saveComposerSpec());

        bind('btn_composer_export', () => {
            const spec = this.syncComposerSpec();
            try {
                validateSpec(spec);
            } catch (err) {
                alert(`Invalid scenario: ${err.message}`);
                return;
            }
            this.downloadBlob(
                exportScenarioFile(spec),
                `${spec.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'scenario'}.json`
            );
        });

        bind('btn_composer_delete', async () => {
            const id = this.editSpec?.id;
            if (!id || !this.customSpecs.has(id)) return;
            if (!confirm(`Delete "${this.editSpec.name}" from the library?`)) return;
            await deleteCustomScenario(id);
            await this.loadCustomScenarios();
            if (this.state.currentScenario === `custom:${id}`) {
                this.state.currentScenario = this.state.topology === 'hex' ? 'filament' : 'vacuum';
                const dd = document.getElementById('scenario_dropdown');
                if (dd) dd.value = this.state.currentScenario;
                this.updateDossierContent(this.state.currentScenario);
            }
            this.editSpec.id = null;
            const delBtn = document.getElementById('btn_composer_delete');
            if (delBtn) delBtn.disabled = true;
        });

        const importInput = document.getElementById('composer_import_input');
        if (importInput) {
            importInput.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async (ev) => {
                    try {
                        const spec = importScenarioFile(ev.target.result);
                        this.editSpec = spec;
                        // Imports land in the library immediately so they
                        // survive the session; drop the id only if it
                        // collides with a different existing spec.
                        if (!spec.id || (this.customSpecs.has(spec.id) &&
                            JSON.stringify(this.customSpecs.get(spec.id)) !== JSON.stringify(spec))) {
                            spec.id = `c${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
                        }
                        await saveCustomScenario(spec);
                        await this.loadCustomScenarios();
                        this.syncComposerInputs();
                        this.renderComposerLayers();
                    } catch (err) {
                        alert(`Import failed: ${err.message}`);
                    }
                };
                reader.readAsText(file);
                e.target.value = '';
            };
        }

        // Knob sliders live-update editSpec (applied on Apply/Save)
        const dissSlider = document.getElementById('composer_dissipation');
        if (dissSlider) dissSlider.oninput = (e) => {
            const v = parseInt(e.target.value, 10);
            if (this.editSpec) this.editSpec.knobs.dissipation = v;
            const lbl = document.getElementById('val_composer_dissipation');
            if (lbl) lbl.innerText = v;
        };
        const thermSlider = document.getElementById('composer_thermal');
        if (thermSlider) thermSlider.oninput = (e) => {
            const v = parseInt(e.target.value, 10);
            if (this.editSpec) this.editSpec.knobs.thermal = v;
            const lbl = document.getElementById('val_composer_thermal');
            if (lbl) lbl.innerText = v;
        };
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
            // Only the Scenario Dossier pop-over is dismissed on outside
            // clicks — the composer holds unsaved edits, so it stays
            // open until ✕, Esc, or the 🎨 button closes it.
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
            const composer = document.getElementById('modal_composer');
            const dossierOpen = modal?.classList.contains('show');
            const composerOpen = composer?.classList.contains('show');
            const openModal = dossierOpen ? modal : (composerOpen ? composer : null);
            const canvasEl = document.getElementById('canvas-container');
            const canvasFocused = document.activeElement === canvasEl;

            if (e.code === 'Escape') {
                if (composerOpen) this.closeComposer();
                else if (dossierOpen) this.closeDossier();
                else if (canvasFocused) canvasEl.blur(); // release arrow keys
                return;
            }

            // Focus trap: keep Tab cycling inside whichever modal is open
            if (openModal && e.code === 'Tab') {
                const focusables = openModal.querySelectorAll('button, [href], input, select, [tabindex]:not([tabindex="-1"])');
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
                    this.mutate(() => this.state.currentScenario?.startsWith('custom:')
                        ? this.runScenario(this.state.currentScenario)
                        : randomizeScenarioSoup(this.state.currentScenario, this.bridge, this.state.topology));
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

        const undoChk = document.getElementById('chk_undo');
        if (undoChk) {
            undoChk.onchange = (e) => this.setUndoEnabled(e.target.checked);
        }
    }

    bindActionButtons() {
        const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
        
        bind('btn_injection_info', () => {
            alert("INJECTION MATRIX\n\nChannels toggle independently — combine them freely. Each slider sets that channel's dose (% of the stamp's stored value per node); sliders are ignored during a verbatim Clone write.\n\nCLONE (all channels on):\nOverwrites reality verbatim. Punches rigid holes through matter (and empty cells erase).\n\nDENSITY:\nFluid displacement only. Splashes and mixes naturally with oceans and gases.\n\nHEAT:\nInjects pure thermal energy without adding mass.\n\nSPIN:\nAlters directional momentum without adding mass. Its slider is an imposition dial — 100% forces the stamp's direction, 0% entrains nodes to the dominant ambient flow, and values between blend the two per node.");
        });
        
        bind('btn_reset', () =>
            this.mutate(() => this.runScenario(this.state.currentScenario)));
        bind('btn_soup', () =>
            this.mutate(() => this.state.currentScenario?.startsWith('custom:')
                ? this.runScenario(this.state.currentScenario)   // repaint the spec — no soup mutations for customs
                : randomizeScenarioSoup(this.state.currentScenario, this.bridge, this.state.topology)));
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
