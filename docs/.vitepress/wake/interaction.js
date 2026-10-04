import { GRID_WIDTH, GRID_HEIGHT, ZOOM_MIN, ZOOM_MAX, unpackNode } from './constants.js';

export class InteractionManager {
    constructor({ bridge, palette, state, canvasContainerId, transformWrapperId, onSample, onUndoPush, onUndoPop }) {
        this.container = document.getElementById(canvasContainerId);
        this.tWrapper = document.getElementById(transformWrapperId);
        this.bridge = bridge;
        this.palette = palette;
        this.state = state;
        this.onSample = onSample;
        this.onUndoPush = onUndoPush;
        this.onUndoPop = onUndoPop;

        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;
        this.lastTapTime = 0;

        this.lastInjectGridX = null;
        this.lastInjectGridY = null;
        this.dragDirX = 0;
        this.dragDirY = 0;
        this.strokeInjected = false;
        this.lastVibrate = 0;

        this.activePointers = new Map();
        this.initialPinchDistance = null;
        this.initialZoom = 1;
        this.lastPinchMid = null;

        this._onResize = () => { setTimeout(() => this.constrainView(), 50); };

        this.init();
    }

    init() {
        if (!this.container) return;
        this.bindEvents();
        window.addEventListener('resize', this._onResize);
    }

    clampZoom(z) {
        return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
    }

    // Anchors the zoom on a screen point so the content under it stays fixed.
    zoomAtPoint(clientX, clientY, newZoom) {
        const rect = this.container.getBoundingClientRect();
        const sx = (clientX - rect.left) - rect.width / 2;
        const sy = (clientY - rect.top) - rect.height / 2;
        const z = this.clampZoom(newZoom);
        if (z === this.zoom) return;
        this.panX += sx * (1 / z - 1 / this.zoom);
        this.panY += sy * (1 / z - 1 / this.zoom);
        this.zoom = z;
        this.updateZoomUI();
        this.applyTransform();
    }

    bindEvents() {
        this.container.addEventListener('contextmenu', (e) => e.preventDefault());

        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            this.zoomAtPoint(e.clientX, e.clientY, this.zoom + delta);
            this.constrainView();
        }, { passive: false });

        this.container.addEventListener('dblclick', () => {
            // Config/System mode behaves exactly like Move mode on the canvas
            if (this.state.currentMode === 'move' || this.state.currentMode === 'config' || this.state.isSpaceDown) {
                this.resetView();
            }
        });

        this.container.addEventListener('pointerdown', (e) => {
            // Ignore right/middle mouse clicks entirely (paint and pan are primary-button only)
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            if (e.pointerType !== 'mouse' && !e.isPrimary && this.activePointers.size === 0) return;

            this.container.setPointerCapture(e.pointerId);
            this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

            if (this.activePointers.size === 1) {
                const now = Date.now();
                if (now - this.lastTapTime < 300 && (this.state.currentMode === 'move' || this.state.currentMode === 'config' || this.state.isSpaceDown)) {
                    this.resetView();
                }
                this.lastTapTime = now;

                this.isDragging = true;
                if (this.tWrapper) this.tWrapper.style.transition = 'none';
                this.lastX = e.clientX;
                this.lastY = e.clientY;
                this.processInput(e.clientX, e.clientY, true);
            } else if (this.activePointers.size === 2) {
                // Second finger arrived: this is a pinch, not a stroke.
                // Revert the stamp finger 1 may have just injected.
                if (this.strokeInjected) {
                    this.bridge.restoreSnapshot();
                    if (this.onUndoPop) this.onUndoPop();
                    this.strokeInjected = false;
                    this.state.forceRedraw = true;
                }
                const pts = Array.from(this.activePointers.values());
                this.initialPinchDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                this.initialZoom = this.zoom;
                this.lastPinchMid = {
                    x: (pts[0].x + pts[1].x) / 2,
                    y: (pts[0].y + pts[1].y) / 2
                };
            }
        });

        this.container.addEventListener('pointermove', (e) => {
            if (!this.activePointers.has(e.pointerId)) return;
            this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

            if (this.activePointers.size === 2 && this.initialPinchDistance) {
                const pts = Array.from(this.activePointers.values());
                const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };

                // Zoom anchored at the pinch focal point
                const scaleFactor = currentDist / this.initialPinchDistance;
                this.zoomAtPoint(mid.x, mid.y, this.initialZoom * scaleFactor);

                // Two-finger pan from midpoint drift
                if (this.lastPinchMid) {
                    this.panX += (mid.x - this.lastPinchMid.x) / this.zoom;
                    this.panY += (mid.y - this.lastPinchMid.y) / this.zoom;
                    this.applyTransform();
                }
                this.lastPinchMid = mid;
                return;
            }

            if (this.isDragging && this.activePointers.size === 1) {
                this.processInput(e.clientX, e.clientY, false);
            }
        });

        const endPointer = (e) => {
            this.activePointers.delete(e.pointerId);
            if (this.activePointers.size < 2) {
                this.initialPinchDistance = null;
                this.lastPinchMid = null;
            }
            if (this.activePointers.size === 0) {
                this.isDragging = false;
                this.strokeInjected = false;
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
                if (this.onUndoPush) this.onUndoPush();
                this.injectPattern(coords.x, coords.y, pattern, this.state.injectionMode);
                this.strokeInjected = true;
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
        // Throttle haptics so drag-painting is a tick, not a continuous buzz
        const now = Date.now();
        if ('vibrate' in navigator && now - this.lastVibrate > 120) {
            navigator.vibrate(8);
            this.lastVibrate = now;
        }

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
                    this.bridge.setNodeState(tx, ty, brushNode);
                } else {
                    const b = unpackNode(brushNode);
                    if (mode === 'quanta') {
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
        
        // Hand off entirely to the UI orchestrator
        if (typeof this.onSample === 'function') {
            this.onSample(stamp);
        }
    }

    applyTransform() {
        if (!this.tWrapper) return;
        this.tWrapper.style.transform = `scale(${this.zoom}) translate(${this.panX}px, ${this.panY}px)`;
    }

    updateZoomUI() {
        const vz = document.getElementById('val_zoom');
        const sz = document.getElementById('slider_zoom');
        if (vz) vz.innerText = this.zoom.toFixed(1) + "x";
        if (sz) sz.value = this.zoom;
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

        if (this.zoom <= ZOOM_MIN) {
            targetX = 0;
            targetY = 0;
            this.zoom = ZOOM_MIN;
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
        window.removeEventListener('resize', this._onResize);
        this.activePointers.clear();
        this.isDragging = false;
    }
}
