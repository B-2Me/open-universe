// --- Grid Dimensions ---
export const GRID_WIDTH = 400;
export const GRID_HEIGHT = 400;
export const TOTAL_NODES = GRID_WIDTH * GRID_HEIGHT;
export const RGBA_CHANNELS = 4;
export const PIXEL_BUFFER_SIZE = TOTAL_NODES * RGBA_CHANNELS;

// --- Bitfield Offsets and Masks ---
// Format: [Quanta: 8 bits][Spin: 8 bits][Heat: 16 bits]
export const QUANTA_SHIFT = 24;
export const SPIN_SHIFT = 16;
export const HEAT_SHIFT = 0;

export const QUANTA_MASK = 0xFF;
export const SPIN_MASK = 0xFF;
export const HEAT_MASK = 0xFFFF;

// --- Physics Defaults ---
export const THERMAL_LIMIT_DEFAULT = 50000;
export const THERMAL_LIMIT_ENGINE_BELL = 60000;
export const DISSIPATION_DEFAULT = 15;
export const DISSIPATION_NOZZLE = 45;

// --- Quanta Presets ---
export const QUANTA_ANCHOR_WALL = 255;
export const QUANTA_OCEAN_WATER = 200;
export const QUANTA_COSMIC_DUST = 80;
export const QUANTA_GAS_MIN = 2;
export const QUANTA_GAS_VARIANCE = 3;

// --- Directional Spin Presets ---
export const SPIN_STATIONARY = 0;
export const SPIN_UP = 1;
export const SPIN_UP_RIGHT = 2;
export const SPIN_RIGHT = 3;
export const SPIN_DOWN_RIGHT = 4;
export const SPIN_DOWN = 5;
export const SPIN_DOWN_LEFT = 6;
export const SPIN_LEFT = 7;
export const SPIN_UP_LEFT = 8;

export const SPIN_FLUID_A = SPIN_RIGHT; // 3
export const SPIN_FLUID_B = SPIN_LEFT;  // 7

// --- Heat Presets ---
export const HEAT_ABSOLUTE_ZERO = 0;
export const HEAT_CRYO = 1;
export const HEAT_COLD_WATER = 20;
export const HEAT_ROOM_AMBIENT = 500;
export const HEAT_ATMOSPHERE_GAS = 10000;
export const HEAT_GEOTHERMAL_CRUST = 15000;
export const HEAT_VACUUM_CORE = 48000;
export const HEAT_IGNITER_PLASMA = 60000;

// --- Layers ---
export const LAYER_MACRO = 0;
export const LAYER_METABOLIC = 1;
export const LAYER_PHASE = 2;
export const LAYER_ENTROPIC = 3;

export const LAYER_METADATA = [
    { id: LAYER_MACRO, label: "👁 Macro" },
    { id: LAYER_METABOLIC, label: "♨ Metabolic" },
    { id: LAYER_PHASE, label: "🧲 Phase" },
    { id: LAYER_ENTROPIC, label: "🕳 Entropic" }
];
export const LAYER_LABELS = LAYER_METADATA.map(l => l.label);

// --- Bitfield Utilities ---
export const packNode = (quanta, spin, heat) =>
    (((quanta & QUANTA_MASK) << QUANTA_SHIFT) |
     ((spin & SPIN_MASK) << SPIN_SHIFT) |
     (heat & HEAT_MASK)) >>> 0;

export const unpackNode = (val) => ({
    quanta: (val >>> QUANTA_SHIFT) & QUANTA_MASK,
    spin: (val >>> SPIN_SHIFT) & SPIN_MASK,
    heat: val & HEAT_MASK
});
