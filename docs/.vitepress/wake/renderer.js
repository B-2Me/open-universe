import { GRID_WIDTH, GRID_HEIGHT } from './constants.js';

export class DualRenderer {
    constructor(canvasLeft, canvasRight) {
        this.ctxLeft = canvasLeft.getContext('2d', { alpha: false });
        this.ctxRight = canvasRight.getContext('2d', { alpha: false });
        this.imgData = new ImageData(GRID_WIDTH, GRID_HEIGHT);
    }

    draw(leftLayer, rightLayer, bridge) {
        const wasmPixels = bridge.getPixelView();

        bridge.renderFrame(leftLayer);
        this.imgData.data.set(wasmPixels);
        this.ctxLeft.putImageData(this.imgData, 0, 0);

        bridge.renderFrame(rightLayer);
        this.imgData.data.set(wasmPixels);
        this.ctxRight.putImageData(this.imgData, 0, 0);
    }
}
