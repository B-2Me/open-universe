let animationId = null;
let isPlaying = true;
let gridWidth = 400;
let gridHeight = 400;

// 1. Define the Emscripten lifecycle hooks BEFORE planck.js loads
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
    const ctx = canvas.getContext('2d', { alpha: false }); // Optimize for no transparency

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
    const bufferLength = gridWidth * gridHeight * 4; // RGBA
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
            
            // Blast the shared Wasm memory directly to the HTML canvas
            ctx.putImageData(imgData, 0, 0);
            
            // Loop at monitor refresh rate
            animationId = requestAnimationFrame(renderFrame);
        } catch (error) {
            triggerErrorState("Runtime exception during frame calculation.");
            cancelAnimationFrame(animationId);
        }
    }

    // ---------------------------------------------------------
    // UI Event Listeners
    // ---------------------------------------------------------
    
    // Biome Settings
    const biomeSelector = document.getElementById('biome_selector');
    const displayDissipation = document.getElementById('math_dissipation');
    const displayLimit = document.getElementById('math_thermal_limit');

    const biomes = {
        "0": { dissipation: 15, limit: 1200 }, // Deep Space
        "1": { dissipation: 2, limit: 300 },   // Stellar Core
        "2": { dissipation: 10, limit: 2000 }  // Solid Lattice
    };

    biomeSelector.addEventListener('change', (e) => {
        const settings = biomes[e.target.value];
        Module._set_dissipation(settings.dissipation);
        Module._set_thermal_limit(settings.limit);
        
        displayDissipation.innerText = settings.dissipation;
        displayLimit.innerText = settings.limit;
    });

    // Playback Controls
    document.getElementById('btn_play').addEventListener('click', () => {
        isPlaying = !isPlaying;
    });

    document.getElementById('btn_step').addEventListener('click', () => {
        isPlaying = false; // Pause standard playback
        Module._tick();    // Force one exact physics calculation
    });

    document.getElementById('btn_clear').addEventListener('click', () => {
        if (Module._clear_grid) Module._clear_grid();
    });

    document.getElementById('btn_soup').addEventListener('click', () => {
        if (Module._randomize_grid) Module._randomize_grid();
    });

    // ---------------------------------------------------------
    // Mouse Interaction (Safe Wasm Coordinate Mapping)
    // ---------------------------------------------------------
    let isDrawing = false;

    function handleInput(e) {
        if (!isDrawing) return;
        
        const rect = canvas.getBoundingClientRect();
        
        // Calculate ratio between CSS size and internal memory size
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);

        // Prevent Wasm Segfaults by strictly clamping coordinates
        if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
            if (Module._inject_node) {
                Module._inject_node(x, y);
            }
        }
    }

    canvas.addEventListener('mousedown', (e) => { isDrawing = true; handleInput(e); });
    canvas.addEventListener('mousemove', handleInput);
    canvas.addEventListener('mouseup', () => { isDrawing = false; });
    canvas.addEventListener('mouseleave', () => { isDrawing = false; });

    // Ignite the grid
    if (Module._randomize_grid) Module._randomize_grid(); // Start with something to look at
    renderFrame();
}
