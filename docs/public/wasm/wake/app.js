let animationId = null;
let isPlaying = true;
let gridWidth = 400;
let gridHeight = 400;

let currentZoom = 1;
let panX = 0;
let panY = 0;
let currentMode = "move"; 
let isSpaceDown = false;
let scrollTimeout = null;

let leftLayer = 0;  // 0 = Macro
let rightLayer = 3; // 3 = Entropic
const LAYER_LABELS = ["👁 Macro", "♨ Metabolic", "🧲 Phase", "🕳 Entropic"];

let currentScenario = "vacuum";

const defaultPalette = {
    "A": { icon: "🧱", label: "Wall", data: [
        [(255<<24)|(0<<16)|500, (255<<24)|(0<<16)|500, (255<<24)|(0<<16)|500]
    ]},
    "B": { icon: "💧", label: "Fluid", data: [
        [(200<<24)|(3<<16)|20, (200<<24)|(7<<16)|20, (200<<24)|(3<<16)|20],
        [(200<<24)|(7<<16)|20, (200<<24)|(3<<16)|20, (200<<24)|(7<<16)|20]
    ]},
    "C": { icon: "💨", label: "Gas", data: [
        [(5<<24)|(8<<16)|10000, 0, (5<<24)|(2<<16)|10000],
        [0, (5<<24)|(1<<16)|10000, 0]
    ]},
    "D": { icon: "🔥", label: "Igniter", data: [
        [(255<<24)|(8<<16)|60000, (255<<24)|(1<<16)|60000, (255<<24)|(2<<16)|60000],
        [(255<<24)|(7<<16)|60000, (255<<24)|(0<<16)|60000, (255<<24)|(3<<16)|60000],
        [(255<<24)|(6<<16)|60000, (255<<24)|(5<<16)|60000, (255<<24)|(4<<16)|60000]
    ]},
    "E": { icon: "🧊", label: "Cryo", data: [
        [(255<<24)|(5<<16)|1, (255<<24)|(5<<16)|1],
        [(255<<24)|(5<<16)|1, (255<<24)|(5<<16)|1]
    ]},
    "F": { icon: "⚙️", label: "Rotor", data: [
        [(255<<24)|(3<<16)|500, (255<<24)|(3<<16)|500, (255<<24)|(5<<16)|500],
        [(255<<24)|(1<<16)|500, (255<<24)|(0<<16)|500, (255<<24)|(5<<16)|500],
        [(255<<24)|(1<<16)|500, (255<<24)|(7<<16)|500, (255<<24)|(7<<16)|500]
    ]},
    "G": { icon: "🕳", label: "Erase", data: [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0]
    ]}
};

let userPalette = JSON.parse(localStorage.getItem('planck_palette')) || {};
let fullPalette = { ...defaultPalette, ...userPalette };
let currentBrush = "A";
let currentInjectionMode = "clone";
let customStamp = [];

function triggerErrorState(message) {
    const banner = document.getElementById('error-banner');
    if (banner) { banner.innerText = message; banner.style.display = 'block'; }
    document.getElementById('transform-wrapper').style.opacity = '0.3';
}

if (typeof createPlanck !== 'undefined') {
    createPlanck({
        onAbort: function() {
            triggerErrorState("Fatal Error: The Planck Field collapsed.");
            document.getElementById('diag_status').innerText = "PANIC";
            if (animationId) cancelAnimationFrame(animationId);
        }
    }).then((wasmModule) => {
        document.getElementById('diag_status').innerText = "ONLINE";
        document.getElementById('diag_status').style.color = "var(--pf-brand-hover)";
        startEngine(wasmModule);
    }).catch((error) => triggerErrorState("Engine failed to initialize: " + error));
}

function setupButtonGroup(containerId, callback, btnClass = '.group-btn') {
    const container = document.getElementById(containerId);
    if (!container) return; 
    const buttons = container.querySelectorAll(btnClass);
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            callback(btn.dataset.val);
        });
    });
}

function renderPaletteUI() {
    const container = document.getElementById('brush_selector');
    if (!container) return;
    container.innerHTML = '';
    
    const scratchBtn = document.createElement('button');
    scratchBtn.className = `palette-btn ${currentBrush === 'custom' ? 'active' : ''}`;
    scratchBtn.dataset.val = 'custom';
    scratchBtn.id = 'opt_custom';
    scratchBtn.innerHTML = `<span class="p-icon">⬚</span><span class="p-label" id="scratch_label">Copy</span>`;
    container.appendChild(scratchBtn);

    for (const [key, brush] of Object.entries(fullPalette)) {
        const btn = document.createElement('button');
        btn.className = `palette-btn ${currentBrush === key ? 'active' : ''}`;
        btn.dataset.val = key;
        btn.innerHTML = `<span class="p-icon">${brush.icon}</span><span class="p-label">${brush.label}</span>`;
        container.appendChild(btn);
    }
    
    setupButtonGroup('brush_selector', val => {
        currentBrush = val;
    }, '.palette-btn');
}

function loadScenario(type, Module) {
    Module._clear_grid(); 
    
    let targetDissipation = 15;
    let targetThermal = 50000;

    const cx = Math.floor(gridWidth / 2);
    const cy = Math.floor(gridHeight / 2);

    if (type === "vacuum") {
        targetDissipation = 15;
        targetThermal = 50000;
        for (let y = cy - 10; y <= cy + 10; y++) {
            for (let x = cx - 10; x <= cx + 10; x++) {
                if (Math.hypot(x - cx, y - cy) <= 8) {
                    Module._set_node_state(x, y, (255 << 24) | (0 << 16) | 48000);
                }
            }
        }
        for (let i = 0; i < 200; i++) {
            let rx = Math.floor(Math.random() * gridWidth);
            let ry = Math.floor(Math.random() * gridHeight);
            let spin = Math.floor(Math.random() * 8) + 1;
            Module._set_node_state(rx, ry, (80 << 24) | (spin << 16) | 1000);
        }
    }
    else if (type === "atmosphere") {
        targetDissipation = 15; 
        targetThermal = 50000; 
        for (let y = 0; y < gridHeight; y++) {
            let depthRatio = y / gridHeight;
            let prob = depthRatio * depthRatio * depthRatio * 20; 
            for (let x = 0; x < gridWidth; x++) {
                if (y < 5) {
                    Module._set_node_state(x, y, (255 << 24) | (0 << 16) | 0); 
                } 
                else if (y > gridHeight - 5) {
                    Module._set_node_state(x, y, (255 << 24) | (0 << 16) | 15000); 
                } 
                else if (Math.random() * 100 < prob) { 
                    let q = 2 + Math.floor(Math.random() * 4); 
                    let s = Math.floor(Math.random() * 8) + 1; 
                    let h = 10000;
                    Module._set_node_state(x, y, (q << 24) | (s << 16) | h);
                }
            }
        }
    } 
    else if (type === "nozzle") {
        targetDissipation = 45;
        targetThermal = 60000;
        for (let y = 50; y < gridHeight; y++) {
            let depth = y - 50;
            let spread = 15 + Math.floor((depth * depth) / 250); 
            for (let x = 0; x < gridWidth; x++) {
                if (x < cx - spread || x > cx + spread) {
                    Module._set_node_state(x, y, (255 << 24) | (0 << 16) | 500);
                }
            }
        }
    }
    else if (type === "ocean") {
        targetDissipation = 15;
        targetThermal = 50000; 
        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                if (y > gridHeight - 10) {
                    Module._set_node_state(x, y, (255 << 24) | (0 << 16) | 500); 
                } else if (y > gridHeight - 150) { 
                    let s = ((x + y) % 2 === 0) ? 3 : 7; 
                    Module._set_node_state(x, y, (200 << 24) | (s << 16) | 20); 
                }
            }
        }
    }
    
    Module._set_dissipation(targetDissipation);
    Module._set_thermal_limit(targetThermal);
    
    const md = document.getElementById('math_dissipation');
    const mt = document.getElementById('math_thermal_limit');
    const sd = document.getElementById('slider_dissipation');
    const st = document.getElementById('slider_thermal');
    
    if (md) md.innerText = targetDissipation;
    if (mt) mt.innerText = targetThermal;
    if (sd) sd.value = targetDissipation;
    if (st) st.value = targetThermal;
}

function startEngine(Module) {
    const canvasContainer = document.getElementById('canvas-container');
    const tWrapper = document.getElementById('transform-wrapper');
    const canvasLeft = document.getElementById('canvas_left');
    const canvasRight = document.getElementById('canvas_right');
    
    if (!canvasContainer || !canvasLeft || !canvasRight) return; 

    const appScript = document.querySelector('script[src*="app.js"]');
    if (appScript) {
        const versionMatch = appScript.getAttribute('src').match(/v=(\d+)/);
        const buildVersion = versionMatch ? `v${versionMatch[1]}` : "Live";
        const statusEl = document.getElementById('diag_status'); 
        if (statusEl) {
            statusEl.innerText = `Build: ${buildVersion}`;
            statusEl.style.color = "var(--pf-brand-hover)";
        }
    }

    gridWidth = Module._get_grid_width();
    gridHeight = Module._get_grid_height();
    document.getElementById('diag_nodes').innerText = (gridWidth * gridHeight).toLocaleString();

    Module._init_grid();
    
    let ptr = Module._get_pixel_buffer_pointer();
    let buffer = Module.HEAPU8 ? Module.HEAPU8.buffer : Module.wasmMemory.buffer;
    let pixelArray = new Uint8ClampedArray(buffer, ptr, gridWidth * gridHeight * 4);
    let imgData = new ImageData(gridWidth, gridHeight);

    document.getElementById('btn_toggle_left').innerText = LAYER_LABELS[leftLayer];
    document.getElementById('btn_toggle_right').innerText = LAYER_LABELS[rightLayer];

    document.getElementById('btn_toggle_left').addEventListener('click', (e) => {
        leftLayer = (leftLayer + 1) % 4;
        e.target.innerText = LAYER_LABELS[leftLayer];
        forceRedraw = true;
    });
    
    document.getElementById('btn_toggle_right').addEventListener('click', (e) => {
        rightLayer = (rightLayer + 1) % 4;
        e.target.innerText = LAYER_LABELS[rightLayer];
        forceRedraw = true;
    });

    async function requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                const wakeLock = await navigator.wakeLock.request('screen');
                document.addEventListener('visibilitychange', async () => {
                    if (document.visibilityState === 'visible') {
                        if (wakeLock !== null) {
                            await navigator.wakeLock.request('screen');
                        }
                        lastTimestamp = performance.now();
                        accumulator = 0;
                    }
                });
            } catch (err) {
                console.warn(`Wake Lock error: ${err.name}, ${err.message}`);
            }
        }
    }
    requestWakeLock();

    let TARGET_TPS = 60;
    let FRAME_TIME = 1000 / TARGET_TPS;
    let accumulator = 0;
    let lastTimestamp = performance.now();
    let frameCount = 0;
    let lastRenderedLeftLayer = -1;
    let lastRenderedRightLayer = -1;
    let forceRedraw = true;

    function renderFrame(timestamp) {
        const delta = timestamp - lastTimestamp;
        lastTimestamp = timestamp;

        let ticked = false;
        if (isPlaying) {
            accumulator += delta;
            let ticksThisFrame = 0;
            while (accumulator >= FRAME_TIME && ticksThisFrame < 5) {
                Module._tick();
                accumulator -= FRAME_TIME;
                ticked = true;
                ticksThisFrame++;
                frameCount++;
                if (frameCount % 10 === 0) {
                    document.getElementById('diag_quanta').innerText = Module._get_total_quanta().toLocaleString();
                    document.getElementById('diag_heat').innerText = Module._get_total_heat().toLocaleString();
                    
                    const phaseEl = document.getElementById('diag_phase');
                    if (phaseEl) phaseEl.innerText = Module._get_phase_alignment().toFixed(1) + "%";
                    
                    const yieldEl = document.getElementById('diag_yield');
                    if (yieldEl) yieldEl.innerText = typeof Module._get_yield === 'function' ? Module._get_yield().toLocaleString() : '0';
                }
            }
        } else {
            accumulator = 0;
        }
        
        if (ticked || leftLayer !== lastRenderedLeftLayer || rightLayer !== lastRenderedRightLayer || forceRedraw) {
            if (buffer.byteLength === 0) {
                buffer = Module.HEAPU8 ? Module.HEAPU8.buffer : Module.wasmMemory.buffer;
                pixelArray = new Uint8ClampedArray(buffer, ptr, gridWidth * gridHeight * 4);
            }

            Module._render_frame(leftLayer);
            imgData.data.set(pixelArray);
            ctxLeft.putImageData(imgData, 0, 0);

            Module._render_frame(rightLayer);
            imgData.data.set(pixelArray);
            ctxRight.putImageData(imgData, 0, 0);

            lastRenderedLeftLayer = leftLayer;
            lastRenderedRightLayer = rightLayer;
            forceRedraw = false;
        }
        
        animationId = requestAnimationFrame(renderFrame);
    }

    function applyTransform() {
        currentZoom = Math.max(1, Math.min(currentZoom, 10)); 
        tWrapper.style.transform = `scale(${currentZoom}) translate(${panX}px, ${panY}px)`;
    }

    function updateZoomUI() {
        const sz = document.getElementById('slider_zoom');
        const vz = document.getElementById('val_zoom');
        if (sz) sz.value = currentZoom;
        if (vz) vz.innerText = currentZoom.toFixed(1) + "x";
    }

    function resetView() {
        currentZoom = 1; 
        panX = 0; panY = 0;
        tWrapper.style.transition = 'transform 0.2s ease-out';
        applyTransform();
        updateZoomUI();
        setTimeout(() => { tWrapper.style.transition = 'none'; }, 200);
    }
    resetView();

    function constrainView() {
        const rect = canvasContainer.getBoundingClientRect();
        const maxPanX = (rect.width * (currentZoom - 1)) / (2 * currentZoom);
        const maxPanY = (rect.height * (currentZoom - 1)) / (2 * currentZoom);
        let targetX = panX;
        let targetY = panY;

        if (currentZoom <= 1) {
            targetX = 0; targetY = 0; currentZoom = 1;
        } else {
            if (panX > maxPanX) targetX = maxPanX;
            if (panX < -maxPanX) targetX = -maxPanX;
            if (panY > maxPanY) targetY = maxPanY;
            if (panY < -maxPanY) targetY = -maxPanY;
        }

        if (targetX !== panX || targetY !== panY) {
            tWrapper.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.2)';
            panX = targetX; panY = targetY;
            applyTransform();
            setTimeout(() => { if (!isDragging) tWrapper.style.transition = 'none'; }, 300);
        }
    }
    window.addEventListener('resize', () => { setTimeout(constrainView, 50); });

    function getGridCoords(clientX, clientY) {
        const rect = canvasContainer.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const dx = (clientX - rect.left) - cx;
        const dy = (clientY - rect.top) - cy;
        const unscaled_dx = (dx / currentZoom) - panX;
        const unscaled_dy = (dy / currentZoom) - panY;
        const gridX = Math.floor((cx + unscaled_dx) * (gridWidth / rect.width));
        const gridY = Math.floor((cy + unscaled_dy) * (gridHeight / rect.height));
        return { x: gridX, y: gridY };
    }

    function hidePopups() {
        const p1 = document.getElementById('context_place');
        const p2 = document.getElementById('context_sample');
        if (p1) p1.classList.remove('show');
        if (p2) p2.classList.remove('show');
    }

    renderPaletteUI();
    
    setupButtonGroup('injection_mode_selector', val => {
        currentInjectionMode = val;
    });

    setupButtonGroup('impedance_mode_selector', val => {
        if (typeof Module._set_impedance_mode === 'function') {
            Module._set_impedance_mode(parseInt(val, 10));
        }
    });

    function setMode(mode) {
        currentMode = mode;
        document.querySelectorAll('.segment-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
        hidePopups();
        const p1 = document.getElementById('context_place');
        const p2 = document.getElementById('context_sample');
        if (mode === 'place' && p1) p1.classList.add('show');
        if (mode === 'sample' && p2) p2.classList.add('show');
        canvasContainer.className = (mode === 'move' || isSpaceDown) ? 'mode-move' : '';
    }
    
    document.querySelectorAll('.segment-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mode = e.currentTarget.dataset.mode;
            if (currentMode === mode) {
                const p1 = document.getElementById('context_place');
                const p2 = document.getElementById('context_sample');
                if (mode === 'place' && p1) p1.classList.toggle('show');
                if (mode === 'sample' && p2) p2.classList.toggle('show');
            } else setMode(mode);
        });
    });

    setupButtonGroup('scenario_selector', val => {
        if (typeof Module._save_grid_snapshot === 'function') Module._save_grid_snapshot();
        currentScenario = val;
        loadScenario(currentScenario, Module);
        forceRedraw = true;
    });
    
    const bindBtn = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    
    const sliderSpeed = document.getElementById('slider_speed');
    if (sliderSpeed) {
        sliderSpeed.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            const vs = document.getElementById('val_speed');
            if (val === 0) {
                isPlaying = false;
                if (vs) vs.innerText = "Paused";
            } else {
                isPlaying = true;
                TARGET_TPS = val;
                FRAME_TIME = 1000 / TARGET_TPS;
                if (vs) vs.innerText = val + " TPS";
            }
        });
    }

    const sliderZoom = document.getElementById('slider_zoom');
    if (sliderZoom) {
        sliderZoom.addEventListener('input', (e) => {
            currentZoom = parseFloat(e.target.value);
            updateZoomUI();
            applyTransform();
            constrainView();
        });
    }
    
    bindBtn('btn_reset', () => {
        if (typeof Module._save_grid_snapshot === 'function') Module._save_grid_snapshot();
        loadScenario(currentScenario, Module);
        forceRedraw = true;
    });

    bindBtn('btn_soup', () => {
        if (typeof Module._save_grid_snapshot === 'function') Module._save_grid_snapshot();
        Module._randomize_grid();
        forceRedraw = true;
    });
    
    bindBtn('btn_clear', () => {
        if (typeof Module._save_grid_snapshot === 'function') Module._save_grid_snapshot();
        Module._clear_grid();
        forceRedraw = true;
    });

    bindBtn('btn_undo', () => {
        if (typeof Module._restore_grid_snapshot === 'function') {
            Module._restore_grid_snapshot();
            forceRedraw = true;
        }
    });
    
    bindBtn('btn_export_vtk', () => {
        const wasPlaying = isPlaying;
        isPlaying = false; 
        if (typeof Module._generate_vtk === 'function') {
            const vtkPtr = Module._generate_vtk();
            
            if (vtkPtr === 0) {
                alert("Error: VTK buffer generation failed due to a memory allocation limit.");
                if (wasPlaying) isPlaying = true;
                return;
            }

            const vtkString = UTF8ToString(vtkPtr);
            const blob = new Blob([vtkString], { type: 'text/plain' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `planck_frame_${Date.now()}.vtk`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            if (typeof Module._free_vtk === 'function') {
                Module._free_vtk();
            }

            buffer = Module.HEAPU8 ? Module.HEAPU8.buffer : Module.wasmMemory.buffer;
            pixelArray = new Uint8ClampedArray(buffer, Module._get_pixel_buffer_pointer(), gridWidth * gridHeight * 4);
            imgData = new ImageData(gridWidth, gridHeight);
        } else {
            alert("VTK Export requires the updated C-engine functions to be compiled.");
        }
        if (wasPlaying) isPlaying = true;
    });

    bindBtn('btn_export_png', () => {
        canvasLeft.toBlob(blob => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `planck_field_${Date.now()}.png`;
            link.click();
        }, 'image/png');
    });

    bindBtn('btn_share', async () => {
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
                alert('Web Share API with files is not supported on this browser/device.');
            }
        }, 'image/png');
    });

    const sliderDissipation = document.getElementById('slider_dissipation');
    const sliderThermal = document.getElementById('slider_thermal');

    if (sliderDissipation) {
        sliderDissipation.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            Module._set_dissipation(val);
            const md = document.getElementById('math_dissipation');
            if (md) md.innerText = val;
            forceRedraw = true;
        });
    }

    if (sliderThermal) {
        sliderThermal.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            Module._set_thermal_limit(val);
            const mt = document.getElementById('math_thermal_limit');
            if (mt) mt.innerText = val;
            forceRedraw = true;
        });
    }

    bindBtn('btn_save_scratch', () => {
        if (!customStamp || customStamp.length === 0) return;
        const customCount = Object.keys(userPalette).length + 1;
        const newId = 'U' + Date.now().toString().slice(-6);
        userPalette[newId] = { icon: "⚙", label: "Cstm " + customCount, data: customStamp };
        fullPalette = { ...defaultPalette, ...userPalette };
        localStorage.setItem('planck_palette', JSON.stringify(userPalette));
        currentBrush = newId; 
        renderPaletteUI();
        const btn = document.getElementById('btn_save_scratch');
        if (btn) btn.disabled = true;
    });

    bindBtn('btn_export_palette', () => {
        if (Object.keys(userPalette).length === 0) { alert("No custom stamps to export yet!"); return; }
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(userPalette));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", "planck_custom_palette.json");
        dlAnchorElem.click();
    });

    const importInput = document.getElementById('import_palette_input');
    if (importInput) {
        importInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const imported = JSON.parse(e.target.result);
                    userPalette = { ...userPalette, ...imported };
                    fullPalette = { ...defaultPalette, ...userPalette };
                    localStorage.setItem('planck_palette', JSON.stringify(userPalette));
                    renderPaletteUI();
                } catch (err) { alert("Invalid palette file."); }
            };
            reader.readAsText(file);
        });
    }

    bindBtn('btn_reset_palette', () => {
        if (confirm("Delete all custom stamps? This cannot be undone.")) {
            userPalette = {};
            fullPalette = { ...defaultPalette };
            localStorage.removeItem('planck_palette');
            currentBrush = 'A';
            renderPaletteUI();
        }
    });
    
    bindBtn('btn_copy_stamp', () => navigator.clipboard.writeText(JSON.stringify(customStamp)));
    
    const sliderRad = document.getElementById('slider_radius');
    if (sliderRad) {
        sliderRad.addEventListener('input', e => {
            const vr = document.getElementById('val_radius');
            if (vr) vr.innerText = e.target.value;
        });
    }

    function sampleRegion(centerX, centerY, radius) {
        let newStamp = [];
        for (let dy = -radius; dy <= radius; dy++) {
            let row = [];
            for (let dx = -radius; dx <= radius; dx++) {
                row.push(Module._get_node_state(centerX + dx, centerY + dy));
            }
            newStamp.push(row);
        }
        customStamp = newStamp;
        const sl = document.getElementById('scratch_label');
        if (sl) sl.innerText = `[${radius*2+1}px]`;
        
        const saveBtn = document.getElementById('btn_save_scratch');
        if (saveBtn) saveBtn.disabled = false;
        
        document.querySelectorAll('#brush_selector .palette-btn').forEach(b => b.classList.remove('active'));
        const opt = document.getElementById('opt_custom');
        if (opt) opt.classList.add('active');
        currentBrush = 'custom';
        
        setMode('place');
        hidePopups();
    }

    function injectPattern(centerX, centerY, pattern) {
        if (!pattern || !pattern.length) return;
        
        if ('vibrate' in navigator) {
            navigator.vibrate(10);
        }

        const startX = centerX - Math.floor(pattern[0].length / 2);
        const startY = centerY - Math.floor(pattern.length / 2);
        
        for (let y = 0; y < pattern.length; y++) {
            for (let x = 0; x < pattern[0].length; x++) {
                const val = pattern[y][x];
                const quanta = (val >>> 24) & 0xFF;
                
                if (currentInjectionMode === 'clone') {
                    Module._set_node_state(startX + x, startY + y, val);
                } else if (val !== 0 && quanta > 0) {
                    if (currentInjectionMode === 'quanta') {
                        if (typeof Module._add_quanta_impedance === 'function') {
                            Module._add_quanta(startX + x, startY + y, quanta); 
                        } else {
                            Module._add_quanta(startX + x, startY + y, quanta);
                        }
                    } else if (currentInjectionMode === 'heat') {
                        const heat = val & 0xFFFF;
                        Module._add_heat(startX + x, startY + y, heat > 0 ? heat : 500);
                    } else if (currentInjectionMode === 'spin') {
                        const spin = (val >>> 16) & 0xFF;
                        Module._set_spin(startX + x, startY + y, spin > 0 ? spin : 1);
                    }
                }
            }
        }
        forceRedraw = true;
    }

    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') { 
            e.preventDefault(); 
            if (!isSpaceDown) { isSpaceDown = true; canvasContainer.className = 'mode-move'; }
        }
        if (e.ctrlKey || e.metaKey || e.altKey) {
            if (e.code === 'KeyZ' && typeof Module._restore_grid_snapshot === 'function') {
                e.preventDefault();
                Module._restore_grid_snapshot();
                forceRedraw = true;
            }
            return;
        }
        if (e.code === 'KeyR') {
            if (typeof Module._save_grid_snapshot === 'function') Module._save_grid_snapshot();
            Module._randomize_grid();
            forceRedraw = true;
        }
        if (e.code === 'KeyC') {
            if (typeof Module._save_grid_snapshot === 'function') Module._save_grid_snapshot();
            Module._clear_grid();
            forceRedraw = true;
        }
    });
    
    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') { isSpaceDown = false; canvasContainer.className = currentMode === 'move' ? 'mode-move' : ''; }
    });
    window.addEventListener('blur', () => {
        isSpaceDown = false; isDragging = false; canvasContainer.className = currentMode === 'move' ? 'mode-move' : '';
    });

    canvasContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        currentZoom += e.deltaY > 0 ? -0.1 : 0.1;
        updateZoomUI();
        applyTransform();
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(constrainView, 150);
    }, { passive: false });

    canvasContainer.addEventListener('dblclick', () => {
        if (currentMode === 'move' || isSpaceDown) resetView();
    });

    let isDragging = false;
    let lastX = 0, lastY = 0;
    let initialPinchDist = 0, initialPinchZoom = 1;
    let lastTapTime = 0;

    let lastInjectGridX = null;
    let lastInjectGridY = null;
    let dragDirX = 0;
    let dragDirY = 0;

    function getTouchDist(touches) { return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY); }

    function processInput(clientX, clientY, isClick) {
        const activeAction = isSpaceDown ? 'move' : currentMode;
        
        if (activeAction === 'move') {
            if (isClick) { lastX = clientX; lastY = clientY; return; }
            panX += (clientX - lastX) / currentZoom;
            panY += (clientY - lastY) / currentZoom;
            lastX = clientX; lastY = clientY;
            applyTransform();
            return;
        }

        const coords = getGridCoords(clientX, clientY);

        if (activeAction === 'sample' && isClick) {
            const radius = parseInt(document.getElementById('slider_radius').value, 10);
            sampleRegion(coords.x, coords.y, radius);
        } 
        else if (activeAction === 'place') {
            const patternData = currentBrush === 'custom' ? customStamp : fullPalette[currentBrush].data;
            const stampW = patternData[0].length;
            const stampH = patternData.length;
            
            if (isClick) {
                if (typeof Module._save_grid_snapshot === 'function') Module._save_grid_snapshot();
                
                injectPattern(coords.x, coords.y, patternData);
                lastInjectGridX = coords.x;
                lastInjectGridY = coords.y;
                dragDirX = 0;
                dragDirY = 0;
            } 
            else if (lastInjectGridX !== null && lastInjectGridY !== null) {
                const dx = coords.x - lastInjectGridX;
                const dy = coords.y - lastInjectGridY;
                
                const currentDirX = Math.sign(dx);
                const currentDirY = Math.sign(dy);

                let directionChanged = false;
                if ((currentDirX !== 0 && dragDirX !== 0 && currentDirX !== dragDirX) || 
                    (currentDirY !== 0 && dragDirY !== 0 && currentDirY !== dragDirY)) {
                    directionChanged = true;
                }

                if (directionChanged) {
                    injectPattern(coords.x, coords.y, patternData);
                    lastInjectGridX = coords.x;
                    lastInjectGridY = coords.y;
                    dragDirX = currentDirX;
                    dragDirY = currentDirY;
                } else {
                    if (Math.abs(dx) >= stampW || Math.abs(dy) >= stampH) {
                        
                        let tileX = lastInjectGridX;
                        let tileY = lastInjectGridY;
                        
                        if (Math.abs(dx) >= stampW) tileX += currentDirX * stampW * Math.floor(Math.abs(dx) / stampW);
                        if (Math.abs(dy) >= stampH) tileY += currentDirY * stampH * Math.floor(Math.abs(dy) / stampH);
                        
                        injectPattern(tileX, tileY, patternData);
                        
                        lastInjectGridX = tileX;
                        lastInjectGridY = tileY;
                        
                        if (currentDirX !== 0) dragDirX = currentDirX;
                        if (currentDirY !== 0) dragDirY = currentDirY;
                    }
                }
            }
        }
    }

    canvasContainer.addEventListener('mousedown', (e) => { 
        hidePopups(); 
        isDragging = true; 
        tWrapper.style.transition = 'none'; 
        processInput(e.clientX, e.clientY, true); 
    });
    canvasContainer.addEventListener('mousemove', (e) => { 
        if (isDragging) processInput(e.clientX, e.clientY, false); 
    });
    window.addEventListener('mouseup', () => { 
        if(isDragging) { isDragging = false; constrainView(); } 
    });

    canvasContainer.addEventListener('touchstart', (e) => {
        hidePopups(); 
        e.preventDefault(); 
        isDragging = true; 
        tWrapper.style.transition = 'none';
        
        if (e.touches.length === 2) {
            initialPinchDist = getTouchDist(e.touches);
            initialPinchZoom = currentZoom;
            lastX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            lastY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        } else if (e.touches.length === 1) {
            const now = Date.now();
            if (now - lastTapTime < 300 && (currentMode === 'move' || isSpaceDown)) resetView();
            lastTapTime = now;
            processInput(e.touches[0].clientX, e.touches[0].clientY, true);
        }
    }, { passive: false });

    canvasContainer.addEventListener('touchmove', (e) => {
        e.preventDefault(); 
        if (!isDragging) return;
        
        if (e.touches.length === 1) {
            processInput(e.touches[0].clientX, e.touches[0].clientY, false);
        } else if (e.touches.length === 2) {
            const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            currentZoom = initialPinchZoom * (getTouchDist(e.touches) / initialPinchDist);
            updateZoomUI();
            panX += (midX - lastX) / currentZoom; 
            panY += (midY - lastY) / currentZoom;
            lastX = midX; 
            lastY = midY;
            applyTransform();
        }
    }, { passive: false });
    
    window.addEventListener('touchend', () => { 
        if(isDragging) { isDragging = false; constrainView(); } 
    });
    window.addEventListener('touchcancel', () => { 
        if(isDragging) { isDragging = false; constrainView(); } 
    });

    loadScenario(currentScenario, Module); 
    animationId = requestAnimationFrame(renderFrame);
}

function reportHeight() { 
    window.parent.postMessage({ type: 'RESIZE_IFRAME', height: document.documentElement.scrollHeight }, '*'); 
}
window.addEventListener('load', reportHeight);
new ResizeObserver(reportHeight).observe(document.body);
