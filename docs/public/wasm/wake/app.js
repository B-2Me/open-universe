let animationId = null;
let isPlaying = true;
let gridWidth = 400;
let gridHeight = 400;

let currentZoom = 1;
let panX = 0;
let panY = 0;
let currentMode = "move"; 
let currentBrush = "dot";
let isSpaceDown = false;
let customStamp = [];

const patternPalette = {
    "dot": [[1]],
    "glider": [[0, 1, 0], [0, 0, 1], [1, 1, 1]],
    "lwss": [[0, 1, 1, 1, 1], [1, 0, 0, 0, 1], [0, 0, 0, 0, 1], [1, 0, 0, 1, 0]]
};

function triggerErrorState(message) {
    const banner = document.getElementById('error-banner');
    banner.innerText = message;
    banner.style.display = 'block';
    document.getElementById('universe_canvas').style.opacity = '0.3';
}

if (typeof createPlanck !== 'undefined') {
    createPlanck({
        onAbort: function() {
            triggerErrorState("Fatal Error: The Planck Field collapsed.");
            document.getElementById('diag_status').innerText = "PANIC";
            document.getElementById('diag_status').style.color = "var(--pf-danger)";
            if (animationId) cancelAnimationFrame(animationId);
        }
    }).then((wasmModule) => {
        document.getElementById('diag_status').innerText = "ONLINE";
        document.getElementById('diag_status').style.color = "var(--pf-brand-hover)";
        startEngine(wasmModule);
    }).catch((error) => triggerErrorState("Engine failed to initialize: " + error));
}

function startEngine(Module) {
    const canvas = document.getElementById('universe_canvas');
    const ctx = canvas.getContext('2d', { alpha: false });

    gridWidth = Module._get_grid_width();
    gridHeight = Module._get_grid_height();
    document.getElementById('diag_nodes').innerText = (gridWidth * gridHeight).toLocaleString();

    Module._init_grid();
    const buffer = Module.HEAPU8 ? Module.HEAPU8.buffer : Module.wasmMemory.buffer;
    const pixelArray = new Uint8ClampedArray(buffer, Module._get_pixel_buffer_pointer(), gridWidth * gridHeight * 4);
    const imgData = new ImageData(pixelArray, gridWidth, gridHeight);

    function renderFrame() {
        if (isPlaying) Module._tick();
        ctx.putImageData(imgData, 0, 0);
        animationId = requestAnimationFrame(renderFrame);
    }

    // --- Transform Engine ---
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

    // --- Flattened UI Logic Helper ---
    // Now accepts an optional class parameter so it works for both groups and palettes
    function setupButtonGroup(containerId, callback, btnClass = '.group-btn') {
        const container = document.getElementById(containerId);
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

    // Wiring UI (Notice the updated class targeting for the palette)
    setupButtonGroup('brush_selector', val => currentBrush = val, '.palette-btn');

    // Modes
    function setMode(mode) {
        currentMode = mode;
        document.querySelectorAll('.segment-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
        document.getElementById('context_place').style.display = mode === 'place' ? 'block' : 'none';
        document.getElementById('context_sample').style.display = mode === 'sample' ? 'block' : 'none';
        canvas.className = (mode === 'move' || isSpaceDown) ? 'mode-move' : '';
    }
    document.querySelectorAll('.segment-btn').forEach(btn => btn.addEventListener('click', (e) => setMode(e.target.dataset.mode)));

    // Wiring UI
    setupButtonGroup('brush_selector', val => currentBrush = val);
    
    const biomes = { "0": [15, 1200], "1": [2, 300], "2": [10, 2000] };
    setupButtonGroup('biome_selector', val => {
        Module._set_dissipation(biomes[val][0]);
        Module._set_thermal_limit(biomes[val][1]);
        document.getElementById('math_dissipation').innerText = biomes[val][0];
        document.getElementById('math_thermal_limit').innerText = biomes[val][1];
    });
    
    setupButtonGroup('layer_selector', val => Module._set_render_layer(parseInt(val)));

    document.getElementById('btn_zoom_in').addEventListener('click', () => { currentZoom += 0.5; applyTransform(); });
    document.getElementById('btn_zoom_out').addEventListener('click', () => { currentZoom -= 0.5; applyTransform(); });
    document.getElementById('btn_zoom_reset').addEventListener('click', resetView);

    document.getElementById('btn_play').addEventListener('click', () => isPlaying = !isPlaying);
    document.getElementById('btn_step').addEventListener('click', () => { isPlaying = false; Module._tick(); });
    document.getElementById('btn_clear').addEventListener('click', () => Module._clear_grid());
    document.getElementById('btn_soup').addEventListener('click', () => Module._randomize_grid());
    
    document.getElementById('slider_radius').addEventListener('input', e => document.getElementById('val_radius').innerText = e.target.value);
    document.getElementById('btn_copy_stamp').addEventListener('click', () => navigator.clipboard.writeText(JSON.stringify(customStamp)));

    // --- Wasm Bridge ---
    function injectPattern(centerX, centerY, pattern) {
        if (!pattern.length) return;
        const startX = centerX - Math.floor(pattern[0].length / 2);
        const startY = centerY - Math.floor(pattern.length / 2);
        for (let y = 0; y < pattern.length; y++) {
            for (let x = 0; x < pattern[0].length; x++) {
                if (pattern[y][x]) Module._set_node(startX + x, startY + y);
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
        customStamp = newStamp; // Overwrite the Scratch buffer
        
        // Update the Scratch box label to show the captured dimension
        document.getElementById('scratch_label').innerText = `[${radius*2+1}px]`;
        
        // Auto-select the Scratch box in the palette
        document.querySelectorAll('#brush_selector .palette-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('opt_custom').classList.add('active');
        currentBrush = 'custom';
        
        // Throw the user directly into Paste mode so they can use it instantly
        setMode('place');
    }

    // --- Inputs ---
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !isSpaceDown) { isSpaceDown = true; canvas.className = 'mode-move'; }
    });
    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') { isSpaceDown = false; canvas.className = currentMode === 'move' ? 'mode-move' : ''; }
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
            sampleRegion(x, y, parseInt(document.getElementById('slider_radius').value, 10));
        } else if (activeAction === 'place' && (isClick || currentBrush === 'dot')) {
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
// --- Seamless Iframe Integration ---
function reportHeight() {
    // Calculate the exact pixel height of the internal layout
    const height = document.documentElement.scrollHeight;
    // Send it securely to the parent VitePress window
    window.parent.postMessage({ type: 'RESIZE_IFRAME', height: height }, '*');
}

// Report height on load, and auto-update if the screen rotates or resizes
window.addEventListener('load', reportHeight);
new ResizeObserver(reportHeight).observe(document.body);
