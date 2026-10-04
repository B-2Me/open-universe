import { GRID_WIDTH, GRID_HEIGHT, unpackNode, packNode } from './constants.js';

export class InteractionManager {
    constructor({ bridge, palette, state, canvasContainerId, transformWrapperId }) {
        this.container = document.getElementById(canvasContainerId);
        this.tWrapper = document.getElementById(transformWrapperId);
        this.bridge = bridge;
        this.palette = palette;
        this.state = state;

        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;
        this.lastTapTime = 0;

        // Stamp drag tiling trackers
        this.lastInjectGridX = null;
        this.lastInjectGridY = null;
        this.dragDirX = 0;
        this.dragDirY = 0;

        // Multi-touch pinch tracking
        this.activePointers = new Map();
        this.initialPinchDistance = null;
        this.initialZoom = 1;

        this.init();
    }

    init() {
        if (!this.container) return;
        this.bindEvents();
        window.addEventListener('resize', () => { setTimeout(() => this.constrainView(), 50); });
    }

    bindEvents() {
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            this.zoom = Math.max(1, Math.min(10, this.zoom + delta));
            this.updateZoomUI();
            this.applyTransform();
            this.constrainView();
        }, { passive: false });

        this.container.addEventListener('dblclick', () => {
            if (this.state.currentMode === 'move' || this.state.isSpaceDown) {
                this.resetView();
            }
        });

        this.container.addEventListener('pointerdown', (e) => {
            // Prevent multi-touch interference for standard drawing
            if (e.pointerType !== 'mouse' && !e.isPrimary && this.activePointers.size === 0) return;

            this.container.setPointerCapture(e.pointerId);
            this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

            if (this.activePointers.size === 1) {
                const now = Date.now();
                if (now - this.lastTapTime < 300 && (this.state.currentMode === 'move' || this.state.isSpaceDown)) {
                    this.resetView();
                }
                this.lastTapTime = now;

                this.isDragging = true;
                if (this.tWrapper) this.tWrapper.style.transition = 'none';
                this.lastX = e.clientX;
                this.lastY = e.clientY;
                this.processInput(e.clientX, e.clientY, true);
            } else if (this.activePointers.size === 2) {
                const pts = Array.from(this.activePointers.values());
                this.initialPinchDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                this.initialZoom = this.zoom;
            }
        });

        this.container.addEventListener('pointermove', (e) => {
            if (!this.activePointers.has(e.pointerId)) return;
            this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

            if (this.activePointers.size === 2 && this.initialPinchDistance) {
                const pts = Array.from(this.activePointers.values());
                const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                const scaleFactor = currentDist / this.initialPinchDistance;
                this.zoom = Math.max(1, Math.min(10, this.initialZoom * scaleFactor));
                this.updateZoomUI();
                this.applyTransform();
                return;
            }

            if (this.isDragging && this.activePointers.size === 1) {
                this.processInput(e.clientX, e.clientY, false);
            }
        });

        const endPointer = (e) => {
            this.activePointers.delete(e.pointerId);
            if (this.activePointers.size < 2) this.initialPinchDistance = null;
            if (this.activePointers.size === 0) {
                this.isDragging = false;
                this.lastInjectGridX = null;
                this.lastInjectGridY = null;
                this.constrainView();
            }
        };

        this.container.addEventListener('pointerup', endPointer);
        this.container.addEventListener('pointercancel', endPointer);
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

    processInput(clientX, clientY, isClick) {
        let activeAction = this.state.isSpaceDown ? 'move' : this.state.currentMode;

        // Config mode always acts as move
        if (activeAction === 'config') activeAction = 'move';
        
        // Sample mode acts as move if dragging, but executes sample if tapped
        if (activeAction === 'sample' && !isClick) activeAction = 'move';

        if (activeAction === 'move') {
            if (isClick) {
                this.lastX = clientX;
                this.lastY = clientY;
                return;
            }
            this.panX += (clientX - this.lastX) / this.zoom;
            this.panY += (clientY - this.lastY) / this.zoom;
            this.lastX = clientX;
            this.lastY = clientY;
            this.applyTransform();
            return;
        }

        const coords = this.getGridCoords(clientX, clientY);

        if (activeAction === 'sample' && isClick) {
            this.sampleRegion(coords.x, coords.y);
        } else if (activeAction === 'place') {
            const pattern = this.palette.getPattern();
            if (!pattern || !pattern.length) return;
            const stampW = pattern[0].length;
            const stampH = pattern.length;

            if (isClick) {
                this.bridge.saveSnapshot();
                this.injectPattern(coords.x, coords.y, pattern, this.state.injectionMode);
                this.lastInjectGridX = coords.x;
                this.lastInjectGridY = coords.y;
                this.dragDirX = 0;
                this.dragDirY = 0;
                this.state.forceRedraw = true;
            } else if (this.lastInjectGridX !== null && this.lastInjectGridY !== null) {
                const dx = coords.x - this.lastInjectGridX;
                const dy = coords.y - this.lastInjectGridY;
                const currentDirX = Math.sign(dx);
                const currentDirY = Math.sign(dy);

                let directionChanged = false;
                if ((currentDirX !== 0 && this.dragDirX !== 0 && currentDirX !== this.dragDirX) ||
                    (currentDirY !== 0 && this.dragDirY !== 0 && currentDirY !== this.dragDirY)) {
                    directionChanged = true;
                }

                if (directionChanged) {
                    this.injectPattern(coords.x, coords.y, pattern, this.state.injectionMode);
                    this.lastInjectGridX = coords.x;
                    this.lastInjectGridY = coords.y;
                    this.dragDirX = currentDirX;
                    this.dragDirY = currentDirY;
                    this.state.forceRedraw = true;
                } else if (Math.abs(dx) >= stampW || Math.abs(dy) >= stampH) {
                    let tileX = this.lastInjectGridX;
                    let tileY = this.lastInjectGridY;

                    if (Math.abs(dx) >= stampW) tileX += currentDirX * stampW * Math.floor(Math.abs(dx) / stampW);
                    if (Math.abs(dy) >= stampH) tileY += currentDirY * stampH * Math.floor(Math.abs(dy) / stampH);

                    this.injectPattern(tileX, tileY, pattern, this.state.injectionMode);
                    this.lastInjectGridX = tileX;
                    this.lastInjectGridY = tileY;
                    if (currentDirX !== 0) this.dragDirX = currentDirX;
                    if (currentDirY !== 0) this.dragDirY = currentDirY;
                    this.state.forceRedraw = true;
                }
            }
        }
    }

    injectPattern(centerX, centerY, pattern, mode) {
        if ('vibrate' in navigator) navigator.vibrate(8);

        const pHeight = pattern.length;
        const pWidth = pattern[0].length;
        const startX = centerX - Math.floor(pWidth / 2);
        const startY = centerY - Math.floor(pHeight / 2);
        const thermLimit = parseInt(document.getElementById('slider_thermal')?.value, 10) || 50000;

        for (let py = 0; py < pHeight; py++) {
            for (let px = 0; px < pWidth; px++) {
                const brushNode = pattern[py][px];
                if (brushNode === 0 && mode !== 'clone') continue;

                const tx = startX + px;
                const ty = startY + py;
                if (tx < 0 || tx >= GRID_WIDTH || ty < 0 || ty >= GRID_HEIGHT) continue;

                if (mode === 'clone') {
                    // Clone punches rigid holes (overwrites reality)
                    this.bridge.setNodeState(tx, ty, brushNode);
                } else {
                    const b = unpackNode(brushNode);
                    if (mode === 'quanta') {
                        // Density routes through the engine's fluid displacement logic
                        if (b.quanta > 0) this.bridge.addQuanta(tx, ty, Math.max(1, Math.floor(b.quanta / 4)));
                        if (b.heat > 0) this.bridge.addHeat(tx, ty, Math.floor(b.heat / 10)); 
                        if (b.spin > 0) this.bridge.setSpin(tx, ty, b.spin);
                    } else if (mode === 'heat') {
                        const deltaHeat = Math.floor((b.heat / 60000) * (thermLimit * 0.05));
                        this.bridge.addHeat(tx, ty, deltaHeat);
                    } else if (mode === 'spin') {
                        if (b.spin > 0) this.bridge.setSpin(tx, ty, b.spin);
                    }
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
                if (centerX + dx >= 0 && centerX + dx < GRID_WIDTH && centerY + dy >= 0 && centerY + dy < GRID_HEIGHT) {
                    row.push(this.bridge.getNodeState(centerX + dx, centerY + dy));
                } else {
                    row.push(0);
                }
            }
            stamp.push(row);
        }
        
        this.palette.setCopy(stamp);
        
        const btnSave = document.getElementById('btn_save_scratch');
        if (btnSave) btnSave.disabled = false;
        
        // Auto-switch back to Place mode and equip custom brush
        this.state.currentMode = 'place';
        this.state.injectionMode = 'clone';
        
        document.querySelectorAll('.segment-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.mode === 'place');
        });
        
        const placeDrawer = document.getElementById('context_place');
        const sampleDrawer = document.getElementById('context_sample');
        
        if (sampleDrawer) sampleDrawer.classList.remove('show');
        if (placeDrawer) placeDrawer.classList.add('show');
        
        document.getElementById('opt_custom')?.click();
    }

    applyTransform() {
        if (!this.tWrapper) return;
        // Keep zoom scale and pans synced with the UI component state
        this.state.zoom = this.zoom;
        this.state.panX = this.panX;
        this.state.panY = this.panY;
        this.tWrapper.style.transform = `scale(${this.zoom}) translate(${this.panX}px, ${this.panY}px)`;
    }

    updateZoomUI() {
        const vz = document.getElementById('val_zoom');
        const sz = document.getElementById('slider_zoom');
        if (vz) vz.innerText = this.zoom.toFixed(1) + "x";
        if (sz) sz.value = this.zoom;
        this.state.zoom = this.zoom;
    }

    resetView() {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        if (this.tWrapper) {
            this.tWrapper.style.transition = 'transform 0.2s ease-out';
            this.applyTransform();
            this.updateZoomUI();
            setTimeout(() => { if (this.tWrapper) this.tWrapper.style.transition = 'none'; }, 200);
        }
    }

    constrainView() {
        if (!this.container) return;
        const rect = this.container.getBoundingClientRect();
        const maxPanX = (rect.width * (this.zoom - 1)) / (2 * this.zoom);
        const maxPanY = (rect.height * (this.zoom - 1)) / (2 * this.zoom);
        let targetX = this.panX;
        let targetY = this.panY;

        if (this.zoom <= 1) {
            targetX = 0;
            targetY = 0;
            this.zoom = 1;
        } else {
            if (this.panX > maxPanX) targetX = maxPanX;
            if (this.panX < -maxPanX) targetX = -maxPanX;
            if (this.panY > maxPanY) targetY = maxPanY;
            if (this.panY < -maxPanY) targetY = -maxPanY;
        }

        if (targetX !== this.panX || targetY !== this.panY) {
            if (this.tWrapper) {
                this.tWrapper.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.2)';
                this.panX = targetX;
                this.panY = targetY;
                this.applyTransform();
                setTimeout(() => { if (!this.isDragging && this.tWrapper) this.tWrapper.style.transition = 'none'; }, 300);
            }
        }
    }

    destroy() {
        // Handled securely when the Vue component unmounts
    }
}
