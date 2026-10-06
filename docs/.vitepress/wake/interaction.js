import {
    GRID_WIDTH,
    GRID_HEIGHT,
    ZOOM_MIN,
    ZOOM_MAX,
    TOUCH_STAMP_OFFSET_PX,
    SPIN_DX,
    SPIN_DY,
    OCTANT_SPIN_MAP,
    unpackNode
} from './constants.js';

// --- Interaction-local tuning ---
const DOUBLE_TAP_MS = 300;          // Pointer-tap window that triggers resetView
const VIBRATE_THROTTLE_MS = 120;    // Min spacing between haptic ticks while painting
const VIBRATE_PULSE_MS = 8;         // Single haptic tick duration
const SAMPLE_RADIUS_FALLBACK = 10;  // Probe radius when the slider is unavailable

export class InteractionManager {
    constructor({ bridge, palette, state, canvasContainerId, touchZoneId, transformWrapperId, onSample, onUndoPush, onUndoPop, onView, useCssZoom }) {
        this.container = document.getElementById(canvasContainerId);
        // Events bind to the touch zone (canvas + the coarse-pointer pad strip
        // below it); rect/grid math always uses the canvas container itself.
        this.eventsEl = (touchZoneId && document.getElementById(touchZoneId)) || this.container;
        this.tWrapper = document.getElementById(transformWrapperId);
        this.splitView = document.getElementById('split-view');
        // 2D fallback canvases can't take a shader view uniform — they get
        // the old CSS transform on #split-view instead.
        this.useCssZoom = !!useCssZoom;
        this.bridge = bridge;
        this.palette = palette;
        this.state = state;
        this.onSample = onSample;
        this.onUndoPush = onUndoPush;
        this.onUndoPop = onUndoPop;
        this.onView = onView;

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

        // Keyboard brush cursor (arrow-key painting when the canvas is focused)
        this.kbdX = Math.floor(GRID_WIDTH / 2);
        this.kbdY = Math.floor(GRID_HEIGHT / 2);

        this.activePointers = new Map();
        this.initialPinchDistance = null;
        this.initialZoom = 1;
        this.lastPinchMid = null;
        // When a pinch collapses to one finger, that finger's anchor would be
        // stale (lastX/lastY were frozen pre-pinch) — suppress its input until
        // full liftoff so the view doesn't jump and no stray stamp lands.
        this.pinchActive = false;
        this.suppressUntilLiftoff = false;

        this._onResize = () => { setTimeout(() => this.constrainView(), 50); };

        this.init();
    }

    init() {
        if (!this.container) return;
        // The DOM outlives the engine — a substrate switch re-runs init on
        // the same elements, so every element-bound listener hangs off one
        // AbortController that destroy() trips (no stacked handlers).
        this._abort = new AbortController();
        this.bindEvents();
        window.addEventListener('resize', this._onResize);

        // Stamp footprint preview: lives inside the transformed wrapper so it
        // tracks zoom/pan automatically; positioned in full-field pixel units
        // (the two canvases form one continuous 400-wide view).
        this.preview = document.createElement('div');
        this.preview.className = 'brush-preview';
        this.preview.style.display = 'none';
        this.tWrapper?.appendChild(this.preview);

        // Keyboard cursor visibility follows canvas focus
        this._onCanvasFocus = () => {
            const box = this.cursorBox();
            if (box) this.positionPreview(this.kbdX, this.kbdY, box.w, box.h);
        };
        const sig = { signal: this._abort.signal };
        this.container.addEventListener('focus', this._onCanvasFocus, sig);
        this.container.addEventListener('blur', () => this.hideBrushPreview(), sig);
    }

    hideBrushPreview() {
        if (this.preview) this.preview.style.display = 'none';
    }

    // Places the footprint box at the grid anchor matching injectPattern's
    // centering (startX = centerX - floor(w/2)).
    positionPreview(centerX, centerY, boxW, boxH) {
        if (!this.preview || !this.tWrapper) return;
        const cellPxX = this.tWrapper.clientWidth / GRID_WIDTH;
        const cellPxY = this.tWrapper.clientHeight / GRID_HEIGHT;
        this.preview.style.display = 'block';
        this.preview.style.left = ((centerX - Math.floor(boxW / 2)) * cellPxX) + 'px';
        this.preview.style.top = ((centerY - Math.floor(boxH / 2)) * cellPxY) + 'px';
        this.preview.style.width = (boxW * cellPxX) + 'px';
        this.preview.style.height = (boxH * cellPxY) + 'px';
    }

    // Footprint dimensions for the active tool, or null for move/config.
    cursorBox() {
        const mode = this.state.isSpaceDown ? 'move' : this.state.currentMode;
        if (mode === 'place') {
            const pattern = this.palette.getPattern();
            if (pattern && pattern.length) return { w: pattern[0].length, h: pattern.length };
        } else if (mode === 'sample') {
            const r = parseInt(document.getElementById('slider_radius')?.value, 10) || SAMPLE_RADIUS_FALLBACK;
            return { w: 2 * r + 1, h: 2 * r + 1 };
        }
        return null;
    }

    // Shows the footprint for the current mode/tool at the pointer's target
    // (touch input is lifted above the fingertip — same math as processInput).
    updateBrushPreview(clientX, clientY, pointerType) {
        if (!this.preview) return;
        const box = this.cursorBox();
        if (!box) { this.hideBrushPreview(); return; }

        const ly = pointerType === 'touch' ? clientY - TOUCH_STAMP_OFFSET_PX : clientY;
        const coords = this.getGridCoords(clientX, ly);
        this.positionPreview(coords.x, coords.y, box.w, box.h);
    }

    // --- Keyboard brush cursor (canvas container must be focused) ---

    moveBrushCursor(dx, dy) {
        this.kbdX = Math.max(0, Math.min(GRID_WIDTH - 1, this.kbdX + dx));
        this.kbdY = Math.max(0, Math.min(GRID_HEIGHT - 1, this.kbdY + dy));
        const status = document.getElementById('kbd_cursor_status');
        if (status) status.textContent = `Cursor ${this.kbdX}, ${this.kbdY}`;
        const box = this.cursorBox();
        if (box) this.positionPreview(this.kbdX, this.kbdY, box.w, box.h);
        else this.hideBrushPreview();
    }

    stampAtCursor() {
        const mode = this.state.isSpaceDown ? 'move' : this.state.currentMode;
        if (mode === 'place') {
            const pattern = this.palette.getPattern();
            if (!pattern || !pattern.length) return;
            if (this.state.undoEnabled) {
                this.bridge.saveSnapshot();
                if (this.onUndoPush) this.onUndoPush();
            }
            this.injectPattern(this.kbdX, this.kbdY, pattern, this.state.injectionChannels);
            this.state.forceRedraw = true;
        } else if (mode === 'sample') {
            this.sampleRegion(this.kbdX, this.kbdY);
        }
    }

    // Arrow-key pan in move/config mode (screen-px per press, clamped inline
    // so held-down keys don't stack constrainView transitions).
    panBy(dxPx, dyPx) {
        const rect = this.container.getBoundingClientRect();
        const maxX = (rect.width * (this.zoom - 1)) / (2 * this.zoom);
        const maxY = (rect.height * (this.zoom - 1)) / (2 * this.zoom);
        this.panX = Math.max(-maxX, Math.min(maxX, this.panX + dxPx / this.zoom));
        this.panY = Math.max(-maxY, Math.min(maxY, this.panY + dyPx / this.zoom));
        this.applyTransform();
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
        const host = this.eventsEl;
        const sig = this._abort.signal;
        host.addEventListener('contextmenu', (e) => e.preventDefault(), { signal: sig });

        host.addEventListener('wheel', (e) => {
            // Zoom only when the cursor is directly over the canvas — wheel
            // anywhere else (the touch pad, drawers, the rest of the page)
            // falls through to normal page scrolling.
            const rect = this.container.getBoundingClientRect();
            if (e.clientX < rect.left || e.clientX > rect.right ||
                e.clientY < rect.top || e.clientY > rect.bottom) return;
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            this.zoomAtPoint(e.clientX, e.clientY, this.zoom + delta);
            this.constrainView();
        }, { passive: false, signal: sig });

        host.addEventListener('dblclick', () => {
            // Config/System mode behaves exactly like Move mode on the canvas
            if (this.state.currentMode === 'move' || this.state.currentMode === 'config' || this.state.isSpaceDown) {
                this.resetView();
            }
        }, { signal: sig });

        host.addEventListener('pointerdown', (e) => {
            // Ignore right/middle mouse clicks entirely (paint and pan are primary-button only)
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            if (e.pointerType !== 'mouse' && !e.isPrimary && this.activePointers.size === 0) return;

            // Grab keyboard focus so arrow-key painting works after a tap/click
            if (document.activeElement !== this.container) {
                this.container.focus({ preventScroll: true });
            }
            host.setPointerCapture(e.pointerId);
            this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

            if (this.activePointers.size === 1) {
                const now = Date.now();
                if (now - this.lastTapTime < DOUBLE_TAP_MS && (this.state.currentMode === 'move' || this.state.currentMode === 'config' || this.state.isSpaceDown)) {
                    this.resetView();
                }
                this.lastTapTime = now;

                this.isDragging = true;
                if (this.tWrapper) this.tWrapper.style.transition = 'none';
                this.lastX = e.clientX;
                this.lastY = e.clientY;
                this.processInput(e.clientX, e.clientY, true, e.pointerType);
            } else if (this.activePointers.size === 2) {
                // Second finger arrived: this is a pinch, not a stroke.
                this.pinchActive = true;
                this.hideBrushPreview();
                // Revert the stamp finger 1 may have just injected (needs the
                // undo ring — without it the stray stamp stays, no copy exists).
                if (this.strokeInjected) {
                    if (this.state.undoEnabled) {
                        this.bridge.restoreSnapshot();
                        if (this.onUndoPop) this.onUndoPop();
                        this.state.forceRedraw = true;
                    }
                    this.strokeInjected = false;
                }
                const pts = Array.from(this.activePointers.values());
                this.initialPinchDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                this.initialZoom = this.zoom;
                this.lastPinchMid = {
                    x: (pts[0].x + pts[1].x) / 2,
                    y: (pts[0].y + pts[1].y) / 2
                };
            }
        }, { signal: sig });

        host.addEventListener('pointermove', (e) => {
            if (!this.activePointers.has(e.pointerId)) {
                // Mouse hover: keep the footprint preview tracking the cursor
                if (e.pointerType === 'mouse') this.updateBrushPreview(e.clientX, e.clientY, e.pointerType);
                return;
            }
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
                // Finger surviving a released pinch has a stale drag anchor —
                // swallow its motion until it lifts rather than jump the view.
                if (this.suppressUntilLiftoff) return;
                this.processInput(e.clientX, e.clientY, false, e.pointerType);
            }
        }, { signal: sig });

        const endPointer = (e) => {
            this.activePointers.delete(e.pointerId);
            if (e.pointerType === 'touch') this.hideBrushPreview();
            if (this.activePointers.size < 2) {
                this.initialPinchDistance = null;
                this.lastPinchMid = null;
            }
            if (this.activePointers.size === 1 && this.pinchActive) {
                this.suppressUntilLiftoff = true;
            }
            if (this.activePointers.size === 0) {
                this.pinchActive = false;
                this.suppressUntilLiftoff = false;
                this.isDragging = false;
                this.strokeInjected = false;
                this.lastInjectGridX = null;
                this.lastInjectGridY = null;
                this.constrainView();
            }
        };

        host.addEventListener('pointerup', endPointer, { signal: sig });
        host.addEventListener('pointercancel', endPointer, { signal: sig });
        host.addEventListener('pointerleave', () => this.hideBrushPreview(), { signal: sig });
    }

    // Maps a client point to grid coordinates, clamped into the field so
    // touches inside the sub-canvas touch pad resolve to the edge rows.
    getGridCoords(clientX, clientY) {
        const rect = this.container.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const dx = (clientX - rect.left) - cx;
        const dy = (clientY - rect.top) - cy;
        const unscaledX = (dx / this.zoom) - this.panX;
        const unscaledY = (dy / this.zoom) - this.panY;
        return {
            x: Math.max(0, Math.min(GRID_WIDTH - 1, Math.floor((cx + unscaledX) * (GRID_WIDTH / rect.width)))),
            y: Math.max(0, Math.min(GRID_HEIGHT - 1, Math.floor((cy + unscaledY) * (GRID_HEIGHT / rect.height))))
        };
    }

    processInput(clientX, clientY, isClick, pointerType) {
        let activeAction = this.state.isSpaceDown ? 'move' : this.state.currentMode;

        // Config mode always acts as move
        if (activeAction === 'config') activeAction = 'move';

        // Sample mode acts as move if dragging, but executes sample if tapped
        if (activeAction === 'sample' && !isClick) activeAction = 'move';

        if (activeAction === 'move') {
            this.hideBrushPreview();
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

        this.updateBrushPreview(clientX, clientY, pointerType);

        // Lift touch input above the fingertip so the user can see where the
        // stamp/sample actually lands (mirrored by updateBrushPreview).
        const ly = pointerType === 'touch' ? clientY - TOUCH_STAMP_OFFSET_PX : clientY;
        const coords = this.getGridCoords(clientX, ly);

        // Keep the keyboard cursor unified with pointer position so swapping
        // between mouse/touch and arrows continues from the same cell.
        this.kbdX = Math.max(0, Math.min(GRID_WIDTH - 1, coords.x));
        this.kbdY = Math.max(0, Math.min(GRID_HEIGHT - 1, coords.y));

        if (activeAction === 'sample' && isClick) {
            this.sampleRegion(coords.x, coords.y);
        } else if (activeAction === 'place') {
            const pattern = this.palette.getPattern();
            if (!pattern || !pattern.length) return;
            const stampW = pattern[0].length;
            const stampH = pattern.length;

            if (isClick) {
                if (this.state.undoEnabled) {
                    this.bridge.saveSnapshot();
                    if (this.onUndoPush) this.onUndoPush();
                }
                this.injectPattern(coords.x, coords.y, pattern, this.state.injectionChannels);
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
                    this.injectPattern(coords.x, coords.y, pattern, this.state.injectionChannels);
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

                    this.injectPattern(tileX, tileY, pattern, this.state.injectionChannels);
                    this.lastInjectGridX = tileX;
                    this.lastInjectGridY = tileY;
                    if (currentDirX !== 0) this.dragDirX = currentDirX;
                    if (currentDirY !== 0) this.dragDirY = currentDirY;
                    this.state.forceRedraw = true;
                }
            }
        }
    }

    injectPattern(centerX, centerY, pattern, channels) {
        // Throttle haptics so drag-painting is a tick, not a continuous buzz
        const now = Date.now();
        if ('vibrate' in navigator && now - this.lastVibrate > VIBRATE_THROTTLE_MS) {
            navigator.vibrate(VIBRATE_PULSE_MS);
            this.lastVibrate = now;
        }

        const pHeight = pattern.length;
        const pWidth = pattern[0].length;
        const startX = centerX - Math.floor(pWidth / 2);
        const startY = centerY - Math.floor(pHeight / 2);
        // Per-channel dose: % of the stamp's stored value injected per node.
        // Spin's dose is imposition strength — see the channel branch below.
        const dose = this.state.injectionDose || { quanta: 25, heat: 5, spin: 100 };

        for (let py = 0; py < pHeight; py++) {
            for (let px = 0; px < pWidth; px++) {
                const brushNode = pattern[py][px];
                // All channels on = verbatim write (clone); empty stamp cells
                // only write zeros in clone (that's what makes Erase work).
                const isClone = channels.quanta && channels.heat && channels.spin;
                if (brushNode === 0 && !isClone) continue;

                const tx = startX + px;
                const ty = startY + py;
                if (tx < 0 || tx >= GRID_WIDTH || ty < 0 || ty >= GRID_HEIGHT) continue;

                if (isClone) {
                    this.bridge.setNodeState(tx, ty, brushNode);
                } else {
                    const b = unpackNode(brushNode);
                    if (channels.quanta && b.quanta > 0) {
                        const q = Math.floor(b.quanta * dose.quanta / 100);
                        if (q > 0) this.bridge.addQuanta(tx, ty, q);
                    }
                    if (channels.heat) {
                        const deltaHeat = Math.floor(b.heat * dose.heat / 100);
                        if (deltaHeat > 0) this.bridge.addHeat(tx, ty, deltaHeat);
                    }
                    if (channels.spin && b.spin > 0) {
                        // Spin dose is a momentum-imposition dial, not a
                        // probability: 100% forces the stamp's direction,
                        // 0% entrains the node to the dominant ambient spin,
                        // values between blend the two per node.
                        const imposed = Math.random() * 100 < dose.spin;
                        const spin = imposed ? b.spin : this.dominantNeighborSpin(tx, ty);
                        if (spin > 0) this.bridge.setSpin(tx, ty, spin);
                    }
                }
            }
        }
    }

    // Dominant spin among the 8 neighbors (same vector-sum rule as the
    // engine's refractive momentum inheritance). Returns 0 when there's
    // no net ambient momentum — callers treat that as "no write".
    dominantNeighborSpin(x, y) {
        let sumDx = 0, sumDy = 0;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = (x + dx + GRID_WIDTH) % GRID_WIDTH;
                const ny = (y + dy + GRID_HEIGHT) % GRID_HEIGHT;
                const s = unpackNode(this.bridge.getNodeState(nx, ny)).spin;
                if (s > 0 && s <= 8) {
                    sumDx += SPIN_DX[s];
                    sumDy += SPIN_DY[s];
                }
            }
        }
        if (sumDx === 0 && sumDy === 0) return 0;
        let angle = Math.atan2(sumDy, sumDx);
        if (angle < 0) angle += Math.PI * 2;
        const octant = Math.floor((angle + Math.PI / 8) / (Math.PI / 4)) % 8;
        return OCTANT_SPIN_MAP[octant];
    }

    sampleRegion(centerX, centerY) {
        const radius = parseInt(document.getElementById('slider_radius')?.value, 10) || SAMPLE_RADIUS_FALLBACK;
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
        const t = `scale(${this.zoom}) translate(${this.panX}px, ${this.panY}px)`;
        // The preview overlay always tracks via CSS (it's positioned in
        // full-field px). In the 2D fallback the canvases zoom the same way.
        if (this.tWrapper) this.tWrapper.style.transform = t;
        if (this.useCssZoom && this.splitView) this.splitView.style.transform = t;
        // View window in field-uv: same math as getGridCoords inverted —
        // screen center dx=0 maps to field-uv 0.5 - pan/rect, window extent
        // is 1/zoom per axis.
        if (this.container && this.onView) {
            const rect = this.container.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                const invZ = 1 / this.zoom;
                this.onView(
                    0.5 - 0.5 * invZ - this.panX / rect.width,
                    0.5 - 0.5 * invZ - this.panY / rect.height,
                    invZ, invZ
                );
            }
        }
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
            if (this.splitView) this.splitView.style.transition = 'transform 0.2s ease-out';
            this.applyTransform();
            this.updateZoomUI();
            setTimeout(() => {
                if (this.tWrapper) this.tWrapper.style.transition = 'none';
                if (this.splitView) this.splitView.style.transition = 'none';
            }, 200);
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
                if (this.splitView) this.splitView.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.2)';
                this.panX = targetX;
                this.panY = targetY;
                this.applyTransform();
                setTimeout(() => {
                    if (!this.isDragging && this.tWrapper) this.tWrapper.style.transition = 'none';
                    if (!this.isDragging && this.splitView) this.splitView.style.transition = 'none';
                }, 300);
            }
        }
    }

    destroy() {
        this._abort?.abort(); // drops every element-bound listener at once
        window.removeEventListener('resize', this._onResize);
        this.activePointers.clear();
        this.isDragging = false;
        this.preview?.remove();
    }
}
