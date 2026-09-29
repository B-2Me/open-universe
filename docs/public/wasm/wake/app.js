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
let rightLayer = 1; // 1 = Metabolic, 2 = Phase
const LAYER_LABELS = ["👁 Macro", "♨ Metabolic", "🧲 Phase"];

// --- DYNAMIC PALETTE MANAGER ---
const defaultPalette = {
    "A": { icon: "●", label: "Point", data: [[(255 << 24) | (1 << 16) | 100]] },
    "B": { icon: "∴", label: "Triangle", data: [[(20<<24)|100, 0, (20<<24)|100], [0, 0, 0], [0, (20<<24)|100, 0]] },
    "C": { icon: "〰", label: "Wall", data: [[(255<<24)|(2<<16)|500, (255<<24)|(2<<16)|500, (255<<24)|(2<<16)|500]] }
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
    
    for (const [key, brush] of Object.entries(fullPalette)) {
        const btn = document.createElement('button');
        btn.className = `palette-btn ${currentBrush === key ? 'active' : ''}`;
        btn.dataset.val = key;
        btn.innerHTML = `<span class="p-icon">${brush.icon}</span><span class="p-label">${brush.label}</span>`;
        container.appendChild(btn);
    }
    
    const scratchBtn = document.createElement('button');
    scratchBtn.className = `palette-btn ${currentBrush === 'custom' ? 'active' : ''}`;
    scratchBtn.dataset.val = 'custom';
    scratchBtn.id = 'opt_custom';
    scratchBtn.innerHTML = `<span class="p-icon">⬚</span><span class="p-label" id="scratch_label">Scratch</span>`;
    container.appendChild(scratchBtn);

    setupButtonGroup('brush_selector', val => {
        currentBrush = val;
    }, '.palette-btn');
}

function startEngine(Module) {
    const canvasContainer = document.getElementById('canvas-container');
    const tWrapper = document.getElementById('transform-wrapper');
    const canvasLeft = document.getElementById('canvas_left');
    const canvasRight = document.getElementById('canvas_right');
    
    if (!canvasContainer || !canvasLeft || !canvasRight) return; 
    
    const ctxLeft = canvasLeft.getContext('2d', { alpha: false });
    const ctxRight = canvasRight.getContext('2d', { alpha: false });

    gridWidth = Module._get_grid_width();
    gridHeight = Module._get_grid_height();
    document.getElementById('diag_nodes').innerText = (gridWidth * gridHeight).toLocaleString();

    Module._init_grid();
    const buffer = Module.HEAPU8 ? Module.HEAPU8.buffer : Module.wasmMemory.buffer;
    const pixelArray = new Uint8ClampedArray(buffer, Module._get_pixel_buffer_pointer(), gridWidth * gridHeight * 4);
    const imgData = new ImageData(pixelArray, gridWidth, gridHeight);

    document.getElementById('btn_toggle_left').innerText = LAYER_LABELS[leftLayer];
    document.getElementById('btn_toggle_right').innerText = LAYER_LABELS[rightLayer];

    document.getElementById('btn_toggle_left').addEventListener('click', (e) => {
        leftLayer = (leftLayer + 1) % 3;
        e.target.innerText = LAYER_LABELS[leftLayer];
    });
    
    document.getElementById('btn_toggle_right').addEventListener('click', (e) => {
        rightLayer = (rightLayer + 1) % 3;
        e.target.innerText = LAYER_LABELS[rightLayer];
    });

    let frameCount = 0;

    function renderFrame() {
        if (isPlaying) {
            Module._tick();
            frameCount++;
            if (frameCount % 10 === 0) {
                document.getElementById('diag_quanta').innerText = Module._get_total_quanta().toLocaleString();
                document.getElementById('diag_heat').innerText = Module._get_total_heat().toLocaleString();
                document.getElementById('diag_phase').innerText = Module._get_phase_alignment().toFixed(1) + "%";
            }
        }
        
        Module._render_frame(leftLayer);
        ctxLeft.putImageData(imgData, 0, 0);

        Module._render_frame(rightLayer);
        ctxRight.putImageData(imgData, 0, 0);
        
        animationId = requestAnimationFrame(renderFrame);
    }

    function applyTransform() {
        currentZoom = Math.max(0.5, Math.min(currentZoom, 10)); 
        tWrapper.style.transform = `scale(${currentZoom}) translate(${panX}px, ${panY}px)`;
    }

    function resetView() {
        currentZoom = window.innerWidth <= 768 ? 2.5 : 1; 
        panX = 0; panY = 0;
        tWrapper.style.transition = 'transform 0.2s ease-out';
        applyTransform();
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
        document.getElementById('context_place').classList.remove('show');
        document.getElementById('context_sample').classList.remove('show');
    }

    renderPaletteUI();
    
    setupButtonGroup('injection_mode_selector', val => {
        currentInjectionMode = val;
    });

    function setMode(mode) {
        currentMode = mode;
        document.querySelectorAll('.segment-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
        hidePopups();
        if (mode === 'place') document.getElementById('context_place').classList.add('show');
        if (mode === 'sample') document.getElementById('context_sample').classList.add('show');
        canvasContainer.className = (mode === 'move' || isSpaceDown) ? 'mode-move' : '';
    }
    
    document.querySelectorAll('.segment-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mode = e.currentTarget.dataset.mode;
            if (currentMode === mode) {
                if (mode === 'place') document.getElementById('context_place').classList.toggle('show');
                if (mode === 'sample') document.getElementById('context_sample').classList.toggle('show');
            } else setMode(mode);
        });
    });

    setupButtonGroup('biome_selector', val => {
        const biomes = { "0": [15, 1200], "1": [2, 300], "2": [45, 600] };
        Module._set_dissipation(biomes[val][0]);
        Module._set_thermal_limit(biomes[val][1]);
        document.getElementById('math_dissipation').innerText = biomes[val][0];
        document.getElementById('math_thermal_limit').innerText = biomes[val][1];
    });
    
    const bindBtn = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    
    bindBtn('btn_zoom_in', () => { currentZoom += 0.5; applyTransform(); constrainView(); });
    bindBtn('btn_zoom_out', () => { currentZoom -= 0.5; applyTransform(); constrainView(); });
    bindBtn('btn_zoom_reset', resetView);
    bindBtn('btn_play', () => isPlaying = !isPlaying);
    bindBtn('btn_step', () => { isPlaying = false; Module._tick(); });
    bindBtn('btn_clear', () => Module._clear_grid());
    bindBtn('btn_soup', () => Module._randomize_grid());
    
    // Palette Management Buttons
    bindBtn('btn_save_scratch', () => {
        if (!customStamp || customStamp.length === 0) return;
        const customCount = Object.keys(userPalette).length + 1;
        const newId = 'U' + Date.now().toString().slice(-6);
        userPalette[newId] = { icon: "⚙", label: "Cstm " + customCount, data: customStamp };
        fullPalette = { ...defaultPalette, ...userPalette };
        localStorage.setItem('planck_palette', JSON.stringify(userPalette));
        currentBrush = newId; 
        renderPaletteUI();
        document.getElementById('btn_save_scratch').disabled = true;
    });

    bindBtn('btn_export_palette', () => {
        if (Object.keys(userPalette).length === 0) { alert("No custom stamps to export yet!"); return; }
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(userPalette));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", "planck_custom_palette.json");
        dlAnchorElem.click();
    });

    document.getElementById('import_palette_input').addEventListener('change', (e) => {
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
    document.getElementById('slider_radius').addEventListener('input', e => {
        document.getElementById('val_radius').innerText = e.target.value;
    });

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
        document.getElementById('scratch_label').innerText = `[${radius*2+1}px]`;
        
        const saveBtn = document.getElementById('btn_save_scratch');
        if (saveBtn) saveBtn.disabled = false;
        
        document.querySelectorAll('#brush_selector .palette-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('opt_custom').classList.add('active');
        currentBrush = 'custom';
        
        setMode('place');
        hidePopups();
    }

    function injectPattern(centerX, centerY, pattern) {
        if (!pattern.length) return;
        const startX = centerX - Math.floor(pattern[0].length / 2);
        const startY = centerY - Math.floor(pattern.length / 2);
        
        for (let y = 0; y < pattern.length; y++) {
            for (let x = 0; x < pattern[0].length; x++) {
                const val = pattern[y][x];
                
                // Extract Quanta safely
                const quanta = (val >>> 24) & 0xFF;
                
                if (val !== 0 && quanta > 0) {
                    if (currentInjectionMode === 'clone') {
                        Module._set_node_state(startX + x, startY + y, val);
                    } else if (currentInjectionMode === 'quanta') {
                        Module._add_quanta(startX + x, startY + y, quanta);
                    } else if (currentInjectionMode === 'heat') {
                        // Extract original heat from the stamp to use as injection magnitude
                        const heat = val & 0xFFFF;
                        Module._add_heat(startX + x, startY + y, heat > 0 ? heat : 500);
                    } else if (currentInjectionMode === 'spin') {
                        // Force a spin (extract from stamp, or default to 1)
                        const spin = (val >>> 16) & 0xFF;
                        Module._set_spin(startX + x, startY + y, spin > 0 ? spin : 1);
                    }
                }
            }
        }
    }

    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') { 
            e.preventDefault(); 
            if (!isSpaceDown) { isSpaceDown = true; canvasContainer.className = 'mode-move'; }
        }
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.code === 'KeyP') isPlaying = !isPlaying;
        if (e.code === 'KeyR') Module._randomize_grid();
        if (e.code === 'KeyC') Module._clear_grid();
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
        applyTransform();
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(constrainView, 150);
    }, { passive: false });

    canvasContainer.addEventListener('dblclick', resetView);

    let isDragging = false;
    let lastX = 0, lastY = 0;
    let initialPinchDist = 0, initialPinchZoom = 1;
    let lastTapTime = 0;

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
        } else if (activeAction === 'place' && (isClick || currentBrush === 'A')) {
            const patternData = currentBrush === 'custom' ? customStamp : fullPalette[currentBrush].data;
            injectPattern(coords.x, coords.y, patternData);
        }
    }

    canvasContainer.addEventListener('mousedown', (e) => { hidePopups(); isDragging = true; tWrapper.style.transition = 'none'; processInput(e.clientX, e.clientY, true); });
    canvasContainer.addEventListener('mousemove', (e) => { if (isDragging) processInput(e.clientX, e.clientY, false); });
    window.addEventListener('mouseup', () => { if(isDragging) { isDragging = false; constrainView(); } });

    canvasContainer.addEventListener('touchstart', (e) => {
        hidePopups(); e.preventDefault(); isDragging = true; tWrapper.style.transition = 'none';
        if (e.touches.length === 1) {
            const now = Date.now();
            if (now - lastTapTime < 300) resetView();
            lastTapTime = now;
            processInput(e.touches[0].clientX, e.touches[0].clientY, true);
        } else if (e.touches.length === 2) {
            initialPinchDist = getTouchDist(e.touches);
            initialPinchZoom = currentZoom;
            lastX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            lastY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        }
    }, { passive: false });

    canvasContainer.addEventListener('touchmove', (e) => {
        e.preventDefault(); if (!isDragging) return;
        if (e.touches.length === 1) {
            processInput(e.touches[0].clientX, e.touches[0].clientY, false);
        } else if (e.touches.length === 2) {
            const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            currentZoom = initialPinchZoom * (getTouchDist(e.touches) / initialPinchDist);
            panX += (midX - lastX) / currentZoom; panY += (midY - lastY) / currentZoom;
            lastX = midX; lastY = midY;
            applyTransform();
        }
    }, { passive: false });
    
    window.addEventListener('touchend', () => { if(isDragging) { isDragging = false; constrainView(); } });

    Module._randomize_grid(); 
    renderFrame();
}

function reportHeight() { window.parent.postMessage({ type: 'RESIZE_IFRAME', height: document.documentElement.scrollHeight }, '*'); }
window.addEventListener('load', reportHeight);
new ResizeObserver(reportHeight).observe(document.body);
