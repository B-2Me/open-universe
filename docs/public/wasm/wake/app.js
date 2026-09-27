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
let scrollTimeout = null;

let leftLayer = 0;  // 0 = Macro
let rightLayer = 1; // 1 = Metabolic
const LAYER_LABELS = ["👁 Macro", "♨ Metabolic"];

const patternPalette = {
    "A": [[20]],
    "B": [[20, 0, 20], [0, 0, 0], [0, 20, 0]],
    "C": [[0, 20, 20, 0], [20, 0, 0, 20], [20, 0, 0, 20], [0, 20, 20, 0]],
    "D": [[255]], 
    "E": [[10, 10, 10, 10]] 
};

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

    // Initial Button Labels
    document.getElementById('btn_toggle_left').innerText = LAYER_LABELS[leftLayer];
    document.getElementById('btn_toggle_right').innerText = LAYER_LABELS[rightLayer];

    document.getElementById('btn_toggle_left').addEventListener('click', (e) => {
        leftLayer = 1 - leftLayer;
        e.target.innerText = LAYER_LABELS[leftLayer];
    });
    
    document.getElementById('btn_toggle_right').addEventListener('click', (e) => {
        rightLayer = 1 - rightLayer;
        e.target.innerText = LAYER_LABELS[rightLayer];
    });

    function renderFrame() {
        if (isPlaying) {
            Module._tick();
            document.getElementById('diag_quanta').innerText = Module._get_total_quanta().toLocaleString();
            document.getElementById('diag_heat').innerText = Module._get_total_heat().toLocaleString();
        }
        
        // Render Left Canvas
        Module._render_frame(leftLayer);
        ctxLeft.putImageData(imgData, 0, 0);

        // Render Right Canvas
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

    // Mathematically perfect rubber banding based on current scale
    function constrainView() {
        const rect = canvasContainer.getBoundingClientRect();
        // Max pan is half the width/height of the overflow created by scaling
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
            panX = targetX;
            panY = targetY;
            applyTransform();
            setTimeout(() => { if (!isDragging) tWrapper.style.transition = 'none'; }, 300);
        }
    }

    // Handles Coordinate Translation for Mouse/Touch clicks
    function getGridCoords(clientX, clientY) {
        const rect = canvasContainer.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        
        // Offset from center of screen
        const dx = (clientX - rect.left) - cx;
        const dy = (clientY - rect.top) - cy;
        
        // Unscale and unpan
        const unscaled_dx = (dx / currentZoom) - panX;
        const unscaled_dy = (dy / currentZoom) - panY;
        
        // Map back to Wasm grid bounds
        const gridX = Math.floor((cx + unscaled_dx) * (gridWidth / rect.width));
        const gridY = Math.floor((cy + unscaled_dy) * (gridHeight / rect.height));
        
        return { x: gridX, y: gridY };
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

    setupButtonGroup('brush_selector', val => currentBrush = val, '.palette-btn');

    function setMode(mode) {
        currentMode = mode;
        document.querySelectorAll('.segment-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
        
        document.getElementById('context_place').classList.toggle('show', mode === 'place');
        document.getElementById('context_sample').classList.toggle('show', mode === 'sample');
        canvasContainer.className = (mode === 'move' || isSpaceDown) ? 'mode-move' : '';
    }
    
    document.querySelectorAll('.segment-btn').forEach(btn => btn.addEventListener('click', (e) => setMode(e.target.dataset.mode)));

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
    bindBtn('btn_copy_stamp', () => navigator.clipboard.writeText(JSON.stringify(customStamp)));
    
    document.getElementById('slider_radius').addEventListener('input', e => {
        document.getElementById('val_radius').innerText = e.target.value;
    });

    function injectPattern(centerX, centerY, pattern) {
        if (!pattern.length) return;
        const startX = centerX - Math.floor(pattern[0].length / 2);
        const startY = centerY - Math.floor(pattern.length / 2);
        for (let y = 0; y < pattern.length; y++) {
            for (let x = 0; x < pattern[0].length; x++) {
                if (pattern[y][x] > 0) Module._set_node(startX + x, startY + y, pattern[y][x]);
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
        document.getElementById('scratch_label').innerText = `[${radius*2+1}px]`;
        
        document.querySelectorAll('#brush_selector .palette-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('opt_custom').classList.add('active');
        currentBrush = 'custom';
        setMode('place');
    }

    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !isSpaceDown) { 
            isSpaceDown = true; 
            canvasContainer.className = 'mode-move'; 
        }
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.code === 'KeyP') isPlaying = !isPlaying;
        if (e.code === 'KeyR') Module._randomize_grid();
        if (e.code === 'KeyC') Module._clear_grid();
    });
    
    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') { 
            isSpaceDown = false; 
            canvasContainer.className = currentMode === 'move' ? 'mode-move' : ''; 
        }
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

        const coords = getGridCoords(clientX, clientY);

        if (activeAction === 'sample' && isClick) {
            const radius = parseInt(document.getElementById('slider_radius').value, 10);
            sampleRegion(coords.x, coords.y, radius);
        } else if (activeAction === 'place' && (isClick || currentBrush === 'A')) {
            injectPattern(coords.x, coords.y, currentBrush === 'custom' ? customStamp : patternPalette[currentBrush]);
        }
    }

    canvasContainer.addEventListener('mousedown', (e) => { 
        isDragging = true; 
        tWrapper.style.transition = 'none'; 
        processInput(e.clientX, e.clientY, true); 
    });
    canvasContainer.addEventListener('mousemove', (e) => { if (isDragging) processInput(e.clientX, e.clientY, false); });
    window.addEventListener('mouseup', () => { 
        if(isDragging) { isDragging = false; constrainView(); }
    });

    canvasContainer.addEventListener('touchstart', (e) => {
        e.preventDefault();
        isDragging = true;
        tWrapper.style.transition = 'none';
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
    
    window.addEventListener('touchend', () => { 
        if(isDragging) { isDragging = false; constrainView(); }
    });

    Module._randomize_grid(); 
    renderFrame();
}

// --- REPLACE THE BOTTOM OF app.js WITH THIS ---

function reportHeight() {
    const height = document.documentElement.scrollHeight;
    window.parent.postMessage({ type: 'RESIZE_IFRAME', height: height }, '*');
}

window.addEventListener('load', reportHeight);
new ResizeObserver(reportHeight).observe(document.body);

