let animationId = null;
let isPlaying = true;
let gridWidth = 400;
let gridHeight = 400;

// ---------------------------------------------------------
// The JavaScript Pattern Palette
// ---------------------------------------------------------
const patternPalette = {
    "dot": [[1]],
    "glider": [
        [0, 1, 0],
        [0, 0, 1],
        [1, 1, 1]
    ],
    "lwss": [
        [0, 1, 1, 1, 1],
        [1, 0, 0, 0, 1],
        [0, 0, 0, 0, 1],
        [1, 0, 0, 1, 0]
    ]
};

let activeTool = "dot";
let customStamp = [];

// ---------------------------------------------------------
// Emscripten Lifecycle
// ---------------------------------------------------------
var Module = {
    onRuntimeInitialized: function() {
        console.log("Planck Field binary loaded.");
        document.getElementById('diag_status').innerText = "ONLINE";
        document.getElementById('diag_status').style.color = "var(--pf-brand-hover)";
        
        try {
            startEngine();
        } catch (error) {
            triggerErrorState("Engine failed to initialize: " + error.message);
        }
    },
    onAbort: function(reason) {
        triggerErrorState("Fatal Error: The Planck Field collapsed (Segfault).");
        document.getElementById('diag_status').innerText = "PANIC";
        document.getElementById('diag_status').style.color = "var(--pf-danger)";
        if (animationId) cancelAnimationFrame(animationId);
    }
};

function triggerErrorState(message) {
    const errorBanner = document.getElementById('error-banner');
    errorBanner.innerText = message;
    errorBanner.style.display = 'block';
    document.getElementById('universe_canvas').style.opacity = '0.3';
}

function startEngine() {
    const canvas = document.getElementById('universe_canvas');
    const ctx = canvas.getContext('2d', { alpha: false });

    // Fetch diagnostics directly from the Wasm binary
    const versionInt = Module._get_engine_version();
    const vMajor = Math.floor(versionInt / 100);
    const vMinor = Math.floor((versionInt % 100) / 10);
    const vPatch = versionInt % 10;
    document.getElementById('diag_version').innerText = `v${vMajor}.${vMinor}.${vPatch}`;

    gridWidth = Module._get_grid_width();
    gridHeight = Module._get_grid_height();
    const totalNodes = gridWidth * gridHeight;

    document.getElementById('diag_res').innerText = `${gridWidth}x${gridHeight}`;
    document.getElementById('diag_nodes').innerText = totalNodes.toLocaleString();

    // Initialize the C memory grids
    Module._init_grid();

    // Setup the Zero-Copy Memory Bridge
    const bufferPointer = Module._get_pixel_buffer_pointer();
    const bufferLength = gridWidth * gridHeight * 4; 
    const pixelArray = new Uint8ClampedArray(Module.HEAPU8.buffer, bufferPointer, bufferLength);
    const imgData = new ImageData(pixelArray, gridWidth, gridHeight);

    // ---------------------------------------------------------
    // The Render Loop
    // ---------------------------------------------------------
    function renderFrame() {
        try {
            if (isPlaying) {
                Module._tick();
            }
            ctx.putImageData(imgData, 0, 0);
            animationId = requestAnimationFrame(renderFrame);
        } catch (error) {
            triggerErrorState("Runtime exception during frame calculation.");
            cancelAnimationFrame(animationId);
        }
    }

    // ---------------------------------------------------------
    // Environment & Simulation UI
    // ---------------------------------------------------------
    const biomes = {
        "0": { dissipation: 15, limit: 1200 }, 
        "1": { dissipation: 2,  limit: 300 },   
        "2": { dissipation: 10, limit: 2000 }  
    };

    document.getElementById('biome_selector').addEventListener('change', (e) => {
        const settings = biomes[e.target.value];
        Module._set_dissipation(settings.dissipation);
        Module._set_thermal_limit(settings.limit);
        document.getElementById('math_dissipation').innerText = settings.dissipation;
        document.getElementById('math_thermal_limit').innerText = settings.limit;
    });

    document.getElementById('layer_selector').addEventListener('change', (e) => {
        Module._set_render_layer(parseInt(e.target.value));
    });

    document.getElementById('btn_play').addEventListener('click', () => { isPlaying = !isPlaying; });
    document.getElementById('btn_step').addEventListener('click', () => { isPlaying = false; Module._tick(); });
    document.getElementById('btn_clear').addEventListener('click', () => { Module._clear_grid(); });
    document.getElementById('btn_soup').addEventListener('click', () => { Module._randomize_grid(); });

    // ---------------------------------------------------------
    // Intervention Palette UI
    // ---------------------------------------------------------
    const toolSelector = document.getElementById('tool_selector');
    const samplerControls = document.getElementById('sampler_controls');
    const radiusSlider = document.getElementById('slider_radius');
    const radiusDisplay = document.getElementById('val_radius');

    toolSelector.addEventListener('change', (e) => {
        activeTool = e.target.value;
        samplerControls.style.display = (activeTool === 'sampler') ? 'block' : 'none';
    });

    radiusSlider.addEventListener('input', (e) => {
        radiusDisplay.innerText = e.target.value;
    });

    document.getElementById('btn_copy_stamp').addEventListener('click', () => {
        if (customStamp.length === 0) return;
        const jsonStr = JSON.stringify(customStamp);
        navigator.clipboard.writeText(jsonStr).then(() => {
            const btn = document.getElementById('btn_copy_stamp');
            btn.innerText = "Copied!";
            setTimeout(() => btn.innerText = "Copy JSON to Clipboard", 2000);
        });
    });

    // ---------------------------------------------------------
    // JavaScript Tool Logic (Inject & Sample)
    // ---------------------------------------------------------
    function injectPatternToWasm(centerX, centerY, patternArray) {
        const height = patternArray.length;
        if (height === 0) return;
        const width = patternArray[0].length;
        
        const startX = centerX - Math.floor(width / 2);
        const startY = centerY - Math.floor(height / 2);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (patternArray[y][x] === 1) {
                    Module._set_node(startX + x, startY + y);
                }
            }
        }
    }

    function sampleRegionFromWasm(centerX, centerY, radius) {
        let newStamp = [];
        for (let dy = -radius; dy <= radius; dy++) {
            let row = [];
            for (let dx = -radius; dx <= radius; dx++) {
                let x = centerX + dx;
                let y = centerY + dy;
                let isAlive = Module._get_node(x, y);
                row.push(isAlive);
            }
            newStamp.push(row);
        }
        
        customStamp = newStamp;
        
        const optCustom = document.getElementById('opt_custom');
        optCustom.disabled = false;
        optCustom.innerText = `Draw: Custom Stamp (${radius*2+1}x${radius*2+1})`;
        
        toolSelector.value = 'custom';
        activeTool = 'custom';
        samplerControls.style.display = 'none';
    }

    // ---------------------------------------------------------
    // Mouse & Touch Mapping 
    // ---------------------------------------------------------
    let isDrawing = false;

    function handleInput(e, isClick = false) {
        if (!isDrawing && !isClick) return;
        
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);

        if (activeTool === 'sampler') {
            if (isClick) {
                const radius = parseInt(radiusSlider.value, 10);
                sampleRegionFromWasm(x, y, radius);
            }
            return;
        }

        if (!isClick && activeTool !== 'dot') return;

        if (activeTool === 'custom') {
            injectPatternToWasm(x, y, customStamp);
        } else if (patternPalette[activeTool]) {
            injectPatternToWasm(x, y, patternPalette[activeTool]);
        }
    }

    // Standard Mouse Events
    canvas.addEventListener('mousedown', (e) => { 
        isDrawing = true; 
        handleInput(e, true); 
    });
    canvas.addEventListener('mousemove', (e) => handleInput(e, false));
    canvas.addEventListener('mouseup', () => { isDrawing = false; });
    canvas.addEventListener('mouseleave', () => { isDrawing = false; });

    // iOS Safari / Mobile Touch Events
    canvas.addEventListener('touchstart', (e) => { 
        isDrawing = true; 
        e.preventDefault(); 
        if(e.touches.length > 0) handleInput(e.touches[0], true); 
    }, { passive: false });
    
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault(); 
        if(e.touches.length > 0) handleInput(e.touches[0], false);
    }, { passive: false });
    
    canvas.addEventListener('touchend', () => { isDrawing = false; });
    canvas.addEventListener('touchcancel', () => { isDrawing = false; });

    // Ignite the grid
    Module._randomize_grid(); 
    renderFrame();
}
