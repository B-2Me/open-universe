let animationId = null;

// 1. Define the Emscripten lifecycle hooks BEFORE planck.js loads
var Module = {
    onRuntimeInitialized: function() {
        console.log("Planck Field binary loaded.");
        try {
            startEngine();
        } catch (error) {
            triggerErrorState("Engine failed to initialize: " + error.message);
        }
    },
    onAbort: function(reason) {
        // This catches C segfaults and out-of-memory errors
        triggerErrorState("Fatal Error: The Planck Field collapsed (Segfault).");
        if (animationId) cancelAnimationFrame(animationId);
    }
};

function triggerErrorState(message) {
    const errorBanner = document.getElementById('error-banner');
    errorBanner.innerText = message;
    errorBanner.style.display = 'block';
    
    // Dim the canvas to visually indicate a crash
    document.getElementById('universe_canvas').style.opacity = '0.3';
}

function startEngine() {
    const canvas = document.getElementById('universe_canvas');
    const ctx = canvas.getContext('2d');

    // Initialize the C memory grids
    Module._init_grid();

    // Setup the Zero-Copy Memory Bridge
    const bufferPointer = Module._get_pixel_buffer_pointer();
    const bufferLength = 400 * 400 * 4; // WIDTH * HEIGHT * 4 (RGBA)
    const pixelArray = new Uint8ClampedArray(Module.HEAPU8.buffer, bufferPointer, bufferLength);
    const imgData = new ImageData(pixelArray, 400, 400);

    // The Render Loop with a try/catch safety net
    function renderFrame() {
        try {
            Module._tick();
            ctx.putImageData(imgData, 0, 0);
            animationId = requestAnimationFrame(renderFrame);
        } catch (error) {
            triggerErrorState("Runtime exception during frame calculation.");
            cancelAnimationFrame(animationId);
        }
    }

    // Ignite the grid
    renderFrame();
}
