import { GRID_WIDTH, GRID_HEIGHT, unpackNode, packNode } from './constants.js';

export class InteractionController {
    constructor({ container, bridge, palette, getState }) {
        this.container = container;
        this.bridge = bridge;
        this.palette = palette;
        this.getState = getState;
        this.tWrapper = document.getElementById('transform-wrapper');

        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;
        this.lastTapTime = 0;

        this.bindEvents();
    }

    bindEvents() {
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.zoom = Math.max(1, Math.min(10, this.zoom + (e.deltaY > 0 ? -0.1 : 0.1)));
            this.applyTransform();
        }, { passive: false });

        this.container.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
            this.handlePointer(e.clientX, e.clientY, true);
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            this.handlePointer(e.clientX, e.clientY, false);
        });

        window.addEventListener('mouseup', () => { this.isDragging = false; });
    }

    getGridCoords(clientX, clientY) {
        const rect = this.container.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const dx = (clientX - rect.left) - cx;
        const dy = (clientY - rect.top) - cy;
        const unscaledX = (dx / this.zoom) - this.panX;
        const unscaledY = (dy / this.zoom) - this.panY;
        return {
            x: Math.floor((cx + unscaledX) * (GRID_WIDTH / rect.width)),
            y: Math.floor((cy + unscaledY) * (GRID_HEIGHT / rect.height))
        };
    }

    handlePointer(clientX, clientY, isInitial) {
        const state = this.getState();
        if (state.currentMode === 'move' || state.isSpaceDown) {
            if (!isInitial) {
                this.panX += (clientX - this.lastX) / this.zoom;
                this.panY += (clientY - this.lastY) / this.zoom;
                this.applyTransform();
            }
            this.lastX = clientX;
            this.lastY = clientY;
            return;
        }

        const coords = this.getGridCoords(clientX, clientY);
        if (state.currentMode === 'sample' && isInitial) {
            this.sampleRegion(coords.x, coords.y);
        } else if (state.currentMode === 'place') {
            const pattern = this.palette.getPattern();
            if (pattern) {
                if (isInitial) this.bridge.saveSnapshot();
                this.injectPattern(coords.x, coords.y, pattern, state.injectionMode);
                state.forceRedraw = true;
            }
        }
    }

    injectPattern(centerX, centerY, pattern, mode) {
        const startX = centerX - Math.floor(pattern[0].length / 2);
        const startY = centerY - Math.floor(pattern.length / 2);
        const thermLimit = parseInt(document.getElementById('slider_thermal')?.value, 10) || 50000;

        for (let py = 0; py < pattern.length; py++) {
            for (let px = 0; px < pattern[0].length; px++) {
                const brushNode = pattern[py][px];
                if (brushNode === 0 && mode !== 'clone') continue;

                const b = unpackNode(brushNode);
                const tx = startX + px;
                const ty = startY + py;
                if (tx < 0 || tx >= GRID_WIDTH || ty < 0 || ty >= GRID_HEIGHT) continue;

                if (mode === 'clone') {
                    this.bridge.setNodeState(tx, ty, brushNode);
                } else {
                    const curr = unpackNode(this.bridge.getNodeState(tx, ty));
                    if (mode === 'quanta') {
                        curr.quanta = Math.min(255, curr.quanta + Math.max(1, Math.floor(b.quanta / 4)));
                    } else if (mode === 'heat') {
                        const deltaHeat = Math.floor((b.heat / 60000) * (thermLimit * 0.05));
                        curr.heat = Math.min(65535, curr.heat + deltaHeat);
                    } else if (mode === 'spin') {
                        if (curr.quanta > 0 && b.spin > 0) curr.spin = b.spin;
                    }
                    this.bridge.setNodeState(tx, ty, packNode(curr.quanta, curr.spin, curr.heat));
                }
            }
        }
    }

    sampleRegion(centerX, centerY) {
        const radius = parseInt(document.getElementById('slider_radius')?.value, 10) || 10;
        const stamp = [];
        for (let dy = -radius; dy <= radius; dy++) {
            const row = [];
            for (let dx = -radius; dx <= radius; dx++) {
                row.push(this.bridge.getNodeState(centerX + dx, centerY + dy));
            }
            stamp.push(row);
        }
        this.palette.setCopy(stamp);
        const btnSave = document.getElementById('btn_save_scratch');
        if (btnSave) btnSave.disabled = false;
        const lbl = document.getElementById('scratch_label');
        if (lbl) lbl.innerText = `[${radius * 2 + 1}px]`;
    }

    applyTransform() {
        if (!this.tWrapper) return;
        this.tWrapper.style.transform = `scale(${this.zoom}) translate(${this.panX}px, ${this.panY}px)`;
        const vz = document.getElementById('val_zoom');
        if (vz) vz.innerText = this.zoom.toFixed(1) + "x";
    }
}
