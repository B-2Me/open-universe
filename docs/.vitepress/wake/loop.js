export class EngineLoop {
    constructor({ bridge, renderer, getState, onTelemetry, onTick, onFatal }) {
        this.bridge = bridge;
        this.renderer = renderer;
        this.getState = getState;
        this.onTelemetry = onTelemetry;
        this.onTick = onTick;
        this.onFatal = onFatal;

        this.targetTPS = 60;
        this.frameTime = 1000 / this.targetTPS;
        this.accumulator = 0;
        this.lastTimestamp = performance.now();
        this.frameCount = 0;
        this.lastL = -1;
        this.lastR = -1;
        this.animId = null;
    }

    setTPS(tps) {
        this.targetTPS = tps;
        this.frameTime = tps > 0 ? 1000 / tps : 0;
    }

    start() {
        const frame = (timestamp) => {
            // A throw here (wasm trap, renderer fault) would otherwise kill
            // the rAF chain silently — surface it and stop the loop.
            try {
                const delta = timestamp - this.lastTimestamp;
                this.lastTimestamp = timestamp;
                const state = this.getState();

                let ticked = false;
                if (state.isPlaying && this.frameTime > 0) {
                    const safeDelta = Math.min(delta, 100);
                    this.accumulator += safeDelta;
                    let steps = 0;
                    while (this.accumulator >= this.frameTime && steps < 5) {
                        this.bridge.tick();
                        this.accumulator -= this.frameTime;
                        ticked = true;
                        steps++;
                        this.frameCount++;
                        if (this.onTick) this.onTick(this.frameCount);
                        if (this.frameCount % 10 === 0 && this.onTelemetry) {
                            this.onTelemetry(this.bridge);
                        }
                    }
                } else {
                    this.accumulator = 0;
                }

                if (ticked || state.leftLayer !== this.lastL || state.rightLayer !== this.lastR || state.forceRedraw) {
                    this.renderer.draw(state.leftLayer, state.rightLayer, this.bridge);
                    this.lastL = state.leftLayer;
                    this.lastR = state.rightLayer;
                    state.forceRedraw = false;
                }
            } catch (err) {
                console.error("Engine loop crashed:", err);
                if (this.onFatal) this.onFatal(err);
                return; // do not reschedule
            }

            this.animId = requestAnimationFrame(frame);
        };
        this.animId = requestAnimationFrame(frame);
    }

    stop() {
        if (this.animId) cancelAnimationFrame(this.animId);
    }
}
