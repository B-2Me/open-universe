import { GRID_WIDTH, GRID_HEIGHT } from './constants.js';

const VS_SOURCE = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
        v_uv = a_position * 0.5 + 0.5;
        v_uv.y = 1.0 - v_uv.y;
        gl_Position = vec4(a_position, 0.0, 1.0);
    }
`;

const FS_SOURCE = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    uniform sampler2D u_texture;
    uniform int u_projection_mode; // 0: Quad, 1: Hex, 2: Oct
    uniform float u_cell_px;     // backing px per grid cell (supersample density)
    varying vec2 v_uv;

    void main() {
        vec2 coord = v_uv;

        if (u_projection_mode == 1) {
            // Hexagonal cells (odd-r lattice): each fragment resolves to
            // the nearest cell center in hex metric space — dy scaled by
            // sqrt(3)/2 equalizes all six neighbor distances, producing
            // true interlocking hex tiles (stretched ~15% vertically to
            // fill the square canvas).
            vec2 p = coord * vec2(${GRID_WIDTH.toFixed(1)}, ${GRID_HEIGHT.toFixed(1)});
            float rc = floor(p.y);
            float d1 = 9e9, d2 = 9e9;
            vec2 c1 = vec2(0.0), c2 = vec2(0.0);
            for (int rr = -1; rr <= 1; rr++) {
                float r = rc + float(rr);
                float par = mod(r, 2.0);
                float c0 = floor(p.x - 0.5 * par);
                for (int cc = -1; cc <= 1; cc++) {
                    float c = c0 + float(cc);
                    float dx = p.x - (c + 0.5 * par + 0.5);
                    float dy = (p.y - (r + 0.5)) * 0.8660254;
                    float dd = dx * dx + dy * dy;
                    if (dd < d1) { d2 = d1; c2 = c1; d1 = dd; c1 = vec2(c, r); }
                    else if (dd < d2) { d2 = dd; c2 = vec2(c, r); }
                }
            }
            c1 = vec2(mod(c1.x, ${GRID_WIDTH.toFixed(1)}), mod(c1.y, ${GRID_HEIGHT.toFixed(1)}));
            c2 = vec2(mod(c2.x, ${GRID_WIDTH.toFixed(1)}), mod(c2.y, ${GRID_HEIGHT.toFixed(1)}));
            vec4 t1 = texture2D(u_texture, (c1 + 0.5) / vec2(${GRID_WIDTH.toFixed(1)}, ${GRID_HEIGHT.toFixed(1)}));
            vec4 t2 = texture2D(u_texture, (c2 + 0.5) / vec2(${GRID_WIDTH.toFixed(1)}, ${GRID_HEIGHT.toFixed(1)}));
            // Seam width is pixel-proportional (1.2 backing px), and seams
            // fade out below ~2.5px cells — a cell too small to fill must be
            // solid, not a hollow outline. Zoomed in: filled hexes + thin
            // clean borders.
            float edge = smoothstep(0.0, min(0.45, 1.2 / u_cell_px), sqrt(d2) - sqrt(d1));
            vec4 col = mix(t1, t2, edge);
            float seam = (1.0 - edge) * 0.45 * smoothstep(2.5, 5.0, u_cell_px);
            col.rgb *= 1.0 - seam;
            gl_FragColor = col;
            return;
        }
        else if (u_projection_mode == 2) {
            // Octagonal Lattice (Chamfered corners with interstitial voids)
            vec2 cell = fract(coord * vec2(${GRID_WIDTH.toFixed(1)}, ${GRID_HEIGHT.toFixed(1)})) - 0.5;
            if (abs(cell.x) + abs(cell.y) > 0.70) {
                gl_FragColor = vec4(0.02, 0.04, 0.02, 1.0);
                return;
            }
        }

        gl_FragColor = texture2D(u_texture, coord);
    }
`;

class SingleRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        // Default to Oct — it's the projection that shares the engine's
        // 8-fold symmetry, so motion renders fluid instead of aliased.
        this.projectionMode = 2; // 0: Quad, 1: Hex, 2: Oct
        this.pixelScale = 1; // zoom-driven backing multiplier — keeps
                             // cell detail crisp when CSS-zoomed in
        this.isWebGL = false;

        if (!this.canvas) return;

        const opts = { antialias: false, depth: false, preserveDrawingBuffer: true };
        this.gl = this.canvas.getContext('webgl2', opts) || 
                  this.canvas.getContext('webgl', opts) || 
                  this.canvas.getContext('experimental-webgl', opts);

        if (this.gl) {
            this.isWebGL = true;
            this.initWebGL();
        } else {
            this.isWebGL = false;
            this.ctx = this.canvas.getContext('2d', { alpha: false });
            this.imgData = new ImageData(GRID_WIDTH, GRID_HEIGHT);
        }
    }

    initWebGL() {
        const gl = this.gl;
        const vs = this.compileShader(gl.VERTEX_SHADER, VS_SOURCE);
        const fs = this.compileShader(gl.FRAGMENT_SHADER, FS_SOURCE);
        this.program = gl.createProgram();
        gl.attachShader(this.program, vs);
        gl.attachShader(this.program, fs);
        gl.linkProgram(this.program);

        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            console.error("WebGL Program Link Error:", gl.getProgramInfoLog(this.program));
            this.isWebGL = false;
            this.ctx = this.canvas.getContext('2d', { alpha: false });
            this.imgData = new ImageData(GRID_WIDTH, GRID_HEIGHT);
            return;
        }

        gl.useProgram(this.program);

        this.uModeLocation = gl.getUniformLocation(this.program, "u_projection_mode");
        this.uCellPxLocation = gl.getUniformLocation(this.program, "u_cell_px");
        this.uTexLocation = gl.getUniformLocation(this.program, "u_texture");
        const aPosLocation = gl.getAttribLocation(this.program, "a_position");

        const quad = new Float32Array([
            -1.0, -1.0,
             1.0, -1.0,
            -1.0,  1.0,
            -1.0,  1.0,
             1.0, -1.0,
             1.0,  1.0
        ]);
        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

        gl.enableVertexAttribArray(aPosLocation);
        gl.vertexAttribPointer(aPosLocation, 2, gl.FLOAT, false, 0, 0);

        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        gl.uniform1i(this.uModeLocation, this.projectionMode);
        gl.uniform1i(this.uTexLocation, 0);
    }

    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error("Shader error:", gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    setPixelScale(z) { this.pixelScale = z || 1; }

    setMode(mode) {
        if (mode === 'quad') this.projectionMode = 0;
        else if (mode === 'hex') this.projectionMode = 1;
        else if (mode === 'oct') this.projectionMode = 2;

        if (this.isWebGL && this.gl) {
            this.gl.useProgram(this.program);
            this.gl.uniform1i(this.uModeLocation, this.projectionMode);
        }
    }

    render(pixelBytes) {
        if (!pixelBytes) return;

        if (this.isWebGL && this.gl) {
            const gl = this.gl;
            // Backing tracks display resolution so several fragments land
            // inside each grid cell — Voronoi/chamfer cell boundaries need
            // sub-cell fragments to exist at all (at 400px backing every
            // fragment sits on a cell center and projections no-op).
            const dpr = Math.min(window.devicePixelRatio || 1, 2) * (this.pixelScale || 1);
            const w = Math.min(4096, Math.max(GRID_WIDTH, Math.round(this.canvas.clientWidth * dpr)));
            const h = Math.min(4096, Math.max(GRID_HEIGHT, Math.round(this.canvas.clientHeight * dpr)));
            if (w > 0 && h > 0 && (this.canvas.width !== w || this.canvas.height !== h)) {
                this.canvas.width = w;
                this.canvas.height = h;
                gl.viewport(0, 0, w, h);
            }
            gl.useProgram(this.program);
            gl.uniform1f(this.uCellPxLocation, Math.max(1, this.canvas.width / GRID_WIDTH));
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.texImage2D(
                gl.TEXTURE_2D, 0, gl.RGBA, 
                GRID_WIDTH, GRID_HEIGHT, 0, 
                gl.RGBA, gl.UNSIGNED_BYTE, pixelBytes
            );
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        } else if (this.ctx) {
            this.imgData.data.set(pixelBytes);
            this.ctx.putImageData(this.imgData, 0, 0);
        }
    }
}

export class DualRenderer {
    constructor(canvasLeft, canvasRight) {
        this.left = new SingleRenderer(canvasLeft);
        this.right = new SingleRenderer(canvasRight);
        this.isWebGL = this.left.isWebGL || this.right.isWebGL;
    }

    setPixelScale(z) {
        this.left.setPixelScale(z);
        this.right.setPixelScale(z);
    }

    draw(leftLayer, rightLayer, bridge) {
        // Fresh view each draw: safe if wasm memory grows (old buffer detaches)
        const wasmPixels = bridge.getPixelView();

        bridge.renderFrame(leftLayer);
        this.left.render(wasmPixels);

        bridge.renderFrame(rightLayer);
        this.right.render(wasmPixels);
    }
}
