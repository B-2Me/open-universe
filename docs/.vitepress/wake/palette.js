import {
    QUANTA_ANCHOR_WALL,
    QUANTA_OCEAN_WATER,
    SPIN_STATIONARY,
    SPIN_UP,
    SPIN_UP_RIGHT,
    SPIN_RIGHT,
    SPIN_DOWN_RIGHT,
    SPIN_DOWN,
    SPIN_DOWN_LEFT,
    SPIN_LEFT,
    SPIN_UP_LEFT,
    SPIN_FLUID_A,
    SPIN_FLUID_B,
    HEAT_CRYO,
    HEAT_COLD_WATER,
    HEAT_ROOM_AMBIENT,
    HEAT_ATMOSPHERE_GAS,
    HEAT_IGNITER_PLASMA,
    packNode
} from './constants.js';

export const DEFAULT_PALETTE = {
    "A": {
        icon: "🧱", label: "Wall",
        data: [[packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, HEAT_ROOM_AMBIENT), packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, HEAT_ROOM_AMBIENT), packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, HEAT_ROOM_AMBIENT)]]
    },
    "B": {
        icon: "💧", label: "Fluid",
        data: [
            [packNode(QUANTA_OCEAN_WATER, SPIN_FLUID_A, HEAT_COLD_WATER), packNode(QUANTA_OCEAN_WATER, SPIN_FLUID_B, HEAT_COLD_WATER), packNode(QUANTA_OCEAN_WATER, SPIN_FLUID_A, HEAT_COLD_WATER)],
            [packNode(QUANTA_OCEAN_WATER, SPIN_FLUID_B, HEAT_COLD_WATER), packNode(QUANTA_OCEAN_WATER, SPIN_FLUID_A, HEAT_COLD_WATER), packNode(QUANTA_OCEAN_WATER, SPIN_FLUID_B, HEAT_COLD_WATER)]
        ]
    },
    "C": {
        icon: "💨", label: "Gas",
        data: [
            [packNode(5, SPIN_UP_LEFT, HEAT_ATMOSPHERE_GAS), 0, packNode(5, SPIN_UP_RIGHT, HEAT_ATMOSPHERE_GAS)],
            [0, packNode(5, SPIN_UP, HEAT_ATMOSPHERE_GAS), 0]
        ]
    },
    "D": {
        icon: "🔥", label: "Igniter",
        data: [
            [packNode(QUANTA_ANCHOR_WALL, SPIN_UP_LEFT, HEAT_IGNITER_PLASMA), packNode(QUANTA_ANCHOR_WALL, SPIN_UP, HEAT_IGNITER_PLASMA), packNode(QUANTA_ANCHOR_WALL, SPIN_UP_RIGHT, HEAT_IGNITER_PLASMA)],
            [packNode(QUANTA_ANCHOR_WALL, SPIN_LEFT, HEAT_IGNITER_PLASMA), packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, HEAT_IGNITER_PLASMA), packNode(QUANTA_ANCHOR_WALL, SPIN_RIGHT, HEAT_IGNITER_PLASMA)],
            [packNode(QUANTA_ANCHOR_WALL, SPIN_DOWN_LEFT, HEAT_IGNITER_PLASMA), packNode(QUANTA_ANCHOR_WALL, SPIN_DOWN, HEAT_IGNITER_PLASMA), packNode(QUANTA_ANCHOR_WALL, SPIN_DOWN_RIGHT, HEAT_IGNITER_PLASMA)]
        ]
    },
    "E": {
        icon: "🧊", label: "Cryo",
        data: [[packNode(QUANTA_ANCHOR_WALL, SPIN_DOWN, HEAT_CRYO), packNode(QUANTA_ANCHOR_WALL, SPIN_DOWN, HEAT_CRYO)], [packNode(QUANTA_ANCHOR_WALL, SPIN_DOWN, HEAT_CRYO), packNode(QUANTA_ANCHOR_WALL, SPIN_DOWN, HEAT_CRYO)]]
    },
    "F": {
        icon: "⚙️", label: "Rotor",
        data: [
            [packNode(QUANTA_ANCHOR_WALL, SPIN_RIGHT, HEAT_ROOM_AMBIENT), packNode(QUANTA_ANCHOR_WALL, SPIN_RIGHT, HEAT_ROOM_AMBIENT), packNode(QUANTA_ANCHOR_WALL, SPIN_DOWN, HEAT_ROOM_AMBIENT)],
            [packNode(QUANTA_ANCHOR_WALL, SPIN_UP, HEAT_ROOM_AMBIENT), packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, HEAT_ROOM_AMBIENT), packNode(QUANTA_ANCHOR_WALL, SPIN_DOWN, HEAT_ROOM_AMBIENT)],
            [packNode(QUANTA_ANCHOR_WALL, SPIN_UP, HEAT_ROOM_AMBIENT), packNode(QUANTA_ANCHOR_WALL, SPIN_LEFT, HEAT_ROOM_AMBIENT), packNode(QUANTA_ANCHOR_WALL, SPIN_LEFT, HEAT_ROOM_AMBIENT)]
        ]
    },
    "G": {
        icon: "🕳", label: "Erase",
        data: [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
    }
};

const STORAGE_KEY = 'planck_palette';

export class PaletteManager {
    constructor() {
        this.userPalette = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        this.fullPalette = { ...DEFAULT_PALETTE, ...this.userPalette };
        this.currentBrush = "A";
        this.customStamp = [];
    }

    getPattern() {
        return this.currentBrush === 'custom' ? this.customStamp : this.fullPalette[this.currentBrush]?.data;
    }

    setCopy(stamp) {
        this.customStamp = stamp;
        this.currentBrush = 'custom';
    }

    saveCurrentCopy() {
        if (!this.customStamp || !this.customStamp.length) return null;
        const count = Object.keys(this.userPalette).length + 1;
        const id = 'U' + Date.now().toString().slice(-6);
        this.userPalette[id] = { icon: "⚙", label: `Cstm ${count}`, data: this.customStamp };
        this.fullPalette = { ...DEFAULT_PALETTE, ...this.userPalette };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.userPalette));
        this.currentBrush = id;
        return id;
    }

    resetPalette() {
        this.userPalette = {};
        this.fullPalette = { ...DEFAULT_PALETTE };
        localStorage.removeItem(STORAGE_KEY);
        this.currentBrush = "A";
        this.customStamp = [];
    }
}
