let animationId = null;
let isPlaying = true;
let gridWidth = 400;
let gridHeight = 400;

let currentZoom = 1;
let panX = 0;
let panY = 0;
let currentMode = "move"; 
let currentBrush = "A"; 
let isSpaceDown = false;
let customStamp = [];

// Abstract Structural Ensembles
const patternPalette = {
    "A": [[20]],
    "B": [
        [20, 0, 20], 
        [0, 0, 0], 
        [0, 20, 0]
    ],
    "C": [
        [0, 20, 20, 0], 
        [20, 0, 0, 20], 
        [20, 0, 0, 20], 
        [0, 20, 20, 0]
    ],
    "D": [[255]], 
    "E": [[10, 10, 10, 10]] 
};

function triggerErrorState(message) {
    const banner = document.getElementById('error-banner');
    if (banner) {
        banner.innerText = message;
        banner.style.display = 'block';
    }
    const canvas = document.getElementById('universe_canvas');
    if (canvas) canvas.style.opacity = '0.3';
}

if (typeof createPlanck !== 'undefined') {
    createPlanck({
        onAbort: function() {
            triggerErrorState("Fatal Error: The Planck Field collapsed.");
            const diag = document.getElementById('diag_status');
            if (diag) {
                diag.innerText = "PANIC";
                diag.style.color = "var(--pf-danger)";
            }
            if (animationId) cancelAnimationFrame(animationId);
        }
    }).then((wasmModule) => {
        const diag = document.getElementById('diag_status');
        if (diag) {
            diag.innerText = "ONLINE";
            diag.style.color = "var(--pf-brand-hover)";
        }
        startEngine(wasmModule);
    }).catch((error) => triggerErrorState("Engine failed to initialize: " + error));
}

function startEngine(Module) {
    const canvas = document.getElementById('universe_canvas');
    if (!canvas) return; // Prevent crashes if HTML isn't ready
    
    const ctx = canvas.getContext('2d', { alpha: false });

    gridWidth = Module._get_grid_width();
    gridHeight = Module._get_grid_height();
    const diagNodes = document.getElementById('diag_nodes');
    if (diagNodes) diagNodes.innerText = (gridWidth * gridHeight).toLocaleString();

    Module._init_grid();
    const buffer = Module.HEAPU8 ? Module.HEAPU8.buffer : Module.wasmMemory.buffer;
    const pixelArray = new Uint8ClampedArray(buffer, Module._get_pixel_buffer_pointer(), gridWidth * gridHeight * 4);
    const imgData = new ImageData(pixelArray, gridWidth, gridHeight);

    function renderFrame() {
        if (isPlaying) Module._tick();
        ctx.putImageData(imgData, 0, 0);
        animationId = requestAnimationFrame(renderFrame);
    }

    function applyTransform() {
        currentZoom = Math.max(0.5, Math.min(currentZoom, 10)); 
        canvas.style.transform = `scale(${currentZoom}) translate(${panX}px, ${panY}px)`;
    }

    function resetView() {
        currentZoom = window.innerWidth <= 768 ? 2.5 : 1; 
        panX = 0;
        panY = 0;
        applyTransform();
    }
    resetView();

    // Robust setup function to prevent null reference crashes
    function setupButtonGroup(containerId, callback, btnClass = '.group-btn') {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`UI Element missing: ${containerId}`);
            return; 
        }
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

    setupButtonGroup('brush_selector', val => currentBrush = val, '.palette-btn');

    function setMode(mode) {
        currentMode = mode;
        document.querySelectorAll('.segment-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
        
        const ctxPlace = document.getElementById('context_place');
        const ctxSample = document.getElementById('context_sample');
        
        if (ctxPlace) ctxPlace.style.display = mode === 'place' ? 'block' : 'none';
        if (ctxSample) ctxSample.style.display = mode === 'sample' ? 'block' : 'none';
        
        canvas.className = (mode === 'move' || isSpaceDown) ? 'mode-move' : '';
    }
    
    document.querySelectorAll('.segment-btn').forEach(btn => btn.addEventListener('click', (e) => setMode(e.target.dataset.mode)));

    // Only ONE biome_selector binding!
    setupButtonGroup('biome_selector', val => {
        // [Dissipation, Thermal Limit]
        // Vacuum (0): Fast bleed, high ceiling. Smooth orbits.
        // Furnace (1): Slow bleed, low ceiling. Immediate supernovas.
        // Crust (2): Violent bleed, mid ceiling. Extreme drag, forces clustering.
        const biomes = { "0": [15, 1200], "1": [2, 300], "2": [45, 600] };
        Module._set_dissipation(biomes[val][0]);
        Module._set_thermal_limit(biomes[val][1]);
        
        const d_label = document.getElementById('math_dissipation');
        const t_label = document.getElementById('math_thermal_limit');
        if (d_label) d_label.innerText = biomes[val][0];
        if (t_label) t_label.innerText = biomes[val][1];
    });
    
    let currentLayer = 0;
    setupButtonGroup('layer_selector', val => {
        currentLayer = parseInt(val);
        Module._set_render_layer(currentLayer);
    });

    // Safely bind action buttons
    const bindBtn = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    
    bindBtn('btn_zoom_in', () => { currentZoom += 0.5; applyTransform(); });
    bindBtn('btn_zoom_out', () => { currentZoom -= 0.5; applyTransform(); });
    bindBtn('btn_zoom_reset', resetView);

    bindBtn('btn_play', () => isPlaying = !isPlaying);
    bindBtn('btn_step', () => { isPlaying = false; Module._tick(); });
    bindBtn('btn_clear', () => Module._clear_grid());
    bindBtn('btn_soup', () => Module._randomize_grid());
    bindBtn('btn_copy_stamp', () => navigator.clipboard.writeText(JSON.stringify(customStamp)));
    
    const radiusSlider = document.getElementById('slider_radius');
    if (radiusSlider) {
        radiusSlider.addEventListener('input', e => {
            const valLabel = document.getElementById('val_radius');
            if (valLabel) valLabel.innerText = e.target.value;
        });
    }

    // Wasm Bridge: Pass the specific pattern mass back to C
    function injectPattern(centerX, centerY, pattern) {
        if (!pattern.length) return;
        const startX = centerX - Math.floor(pattern[0].length / 2);
        const startY = centerY - Math.floor(pattern.length / 2);
        for (let y = 0; y < pattern.length; y++) {
            for (let x = 0; x < pattern[0].length; x++) {
                if (pattern[y][x] > 0) {
                    Module._set_node(startX + x, startY + y, pattern[y][x]);
                }
            }
        }
    }

    function sampleRegion(centerX, centerY, radius) {
        let newStamp = [];
        for (let dy = -radius; dy <= radius; dy++) {
            let row = [];
            for (let dx = -radius; dx <= radius; dx++) row.push(Module._get_node(centerX + dx, centerY + dy));
            newStamp.push(row);
        }
        customStamp = newStamp;
        
        const scratchLabel = document.getElementById('scratch_label');
        if (scratchLabel) scratchLabel.innerText = `[${radius*2+1}px]`;
        
        document.querySelectorAll('#brush_selector .palette-btn').forEach(b => b.classList.remove('active'));
        const optCustom = document.getElementById('opt_custom');
        if (optCustom) optCustom.classList.add('active');
        
        currentBrush = 'custom';
        setMode('place');
    }

    // Pro Sandbox Hotkeys & Spacebar pan toggle
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !isSpaceDown) { 
            isSpaceDown = true; 
            canvas.className = 'mode-move'; 
        }
        
        // Disable hotkeys if user is holding modifier keys to prevent interfering with normal browser shortcuts
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        if (e.code === 'KeyP') {
            isPlaying = !isPlaying;
        }
        if (e.code === 'KeyR') Module._randomize_grid();
        if (e.code === 'KeyC') Module._clear_grid();
        if (e.code === 'KeyM') {
            currentLayer = currentLayer === 0 ? 1 : 0;
            Module._set_render_layer(currentLayer);
            document.querySelectorAll('#layer_selector .group-btn').forEach(b => {
                b.classList.toggle('active', parseInt(b.dataset.val) === currentLayer);
            });
        }
    });
    
    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') { 
            isSpaceDown = false; 
            canvas.className = currentMode === 'move' ? 'mode-move' : ''; 
        }
    });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        currentZoom += e.deltaY > 0 ? -0.1 : 0.1;
        applyTransform();
    }, { passive: false });

    canvas.addEventListener('dblclick', resetView);

    let isDragging = false;
    let lastX = 0, lastY = 0;
    let initialPinchDist = 0, initialPinchZoom = 1;
    let lastTapTime = 0;

    function getTouchDist(touches) {
        return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    }

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

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = Math.floor((clientX - rect.left) * scaleX);
        const y = Math.floor((clientY - rect.top) * scaleY);

        if (activeAction === 'sample' && isClick) {
            const radius = radiusSlider ? parseInt(radiusSlider.value, 10) : 10;
            sampleRegion(x, y, radius);
        } else if (activeAction === 'place' && (isClick || currentBrush === 'A')) {
            injectPattern(x, y, currentBrush === 'custom' ? customStamp : patternPalette[currentBrush]);
        }
    }

    canvas.addEventListener('mousedown', (e) => { isDragging = true; processInput(e.clientX, e.clientY, true); });
    canvas.addEventListener('mousemove', (e) => { if (isDragging) processInput(e.clientX, e.clientY, false); });
    window.addEventListener('mouseup', () => isDragging = false);

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        isDragging = true;
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

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!isDragging) return;
        if (e.touches.length === 1) {
            processInput(e.touches[0].clientX, e.touches[0].clientY, false);
        } else if (e.touches.length === 2) {
            const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            currentZoom = initialPinchZoom * (getTouchDist(e.touches) / initialPinchDist);
            panX += (midX - lastX) / currentZoom;
            panY += (midY - lastY) / currentZoom;
            lastX = midX; lastY = midY;
            applyTransform();
        }
    }, { passive: false });
    window.addEventListener('touchend', () => isDragging = false);

    Module._randomize_grid(); 
    renderFrame();
}

function reportHeight() {
    const height = document.documentElement.scrollHeight;
    window.parent.postMessage({ type: 'RESIZE_IFRAME', height: height }, '*');
}

window.addEventListener('load', reportHeight);
new ResizeObserver(reportHeight).observe(document.body);
