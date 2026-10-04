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
    precision mediump float;
    uniform sampler2D u_texture;
    uniform int u_projection_mode; // 0: Quad, 1: Hex, 2: Oct
    varying vec2 v_uv;

    void main() {
        vec2 coord = v_uv;

        if (u_projection_mode == 1) {
            // Hexagonal Staggered Lattice (Odd-row +0.5 shift)
            float row = floor(coord.y * 400.0);
            if (mod(row, 2.0) == 1.0) {
                coord.x += (0.5 / 400.0);
            }
            if (coord.x > 1.0) {
                gl_FragColor = vec4(0.04, 0.06, 0.04, 1.0);
                return;
            }
        } 
        else if (u_projection_mode == 2) {
            // Octagonal Lattice (Chamfered corners with interstitial voids)
            vec2 cell = fract(coord * 400.0) - 0.5;
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
        this.projectionMode = 0; // 0: Quad, 1: Hex, 2: Oct
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

    setProjectionMode(mode) {
        this.left.setMode(mode);
        this.right.setMode(mode);
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
