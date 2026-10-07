// App version — injected from package.json by vite define at build time.
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.9-dev';

// Per-deploy token — injected by vite define (GITHUB_SHA in CI, timestamp
// locally). Appended to the unversioned wasm URLs so a stale service
// worker or HTTP cache can never serve an older engine alongside a
// newer shell.
export const WAKE_BUILD_ID = typeof __WAKE_BUILD__ !== 'undefined' ? __WAKE_BUILD__ : 'dev';

// --- Engine & Interaction Defaults ---
export const SPEED_DEFAULT_TPS = 60;
export const SPEED_MAX_TPS = 120;
export const ZOOM_MIN = 1.0;
export const ZOOM_MAX = 10.0;

// --- Undo Buffer ---
export const UNDO_MAX_DEPTH = 4;       // Matches SNAPSHOT_DEPTH in planck.c
export const UNDO_WINDOW_TICKS = 120;  // Play ticks between auto-checkpoints (~2s @ 60 TPS)

// --- Touch Ergonomics ---
export const TOUCH_STAMP_OFFSET_PX = 56; // Lift touch paints/samples above the fingertip

// --- Persistence ---
export const AUTOSAVE_INTERVAL_MS = 10000; // Periodic grid autosave to IndexedDB

// --- Grid Dimensions ---
export const GRID_WIDTH = 400;
export const GRID_HEIGHT = 400;
export const TOTAL_NODES = GRID_WIDTH * GRID_HEIGHT;
export const RGBA_CHANNELS = 4;
export const PIXEL_BUFFER_SIZE = TOTAL_NODES * RGBA_CHANNELS;

// --- Node Layout ---
export const NODE_SIZE_BYTES = 6;      // sizeof(PlanckNode): u8 quanta + u8 spin + u16 heat + u8 buffer (+1 pad)
export const GRID_BYTE_SIZE = TOTAL_NODES * NODE_SIZE_BYTES;

// --- Bitfield Offsets and Masks ---
// Format: [Quanta: 8 bits][Spin: 8 bits][Heat: 16 bits]
export const QUANTA_SHIFT = 24;
export const SPIN_SHIFT = 16;
export const HEAT_SHIFT = 0;

export const QUANTA_MASK = 0xFF;
export const SPIN_MASK = 0xFF;
export const HEAT_MASK = 0xFFFF;

// --- Physics Defaults ---
// Engine/app defaults — these also define the slider initial values in
// the template, so they belong to the app, not to any one scenario.
export const THERMAL_LIMIT_DEFAULT = 50000;
export const DISSIPATION_DEFAULT = 15;

// --- Quanta Presets ---
export const QUANTA_ANCHOR_WALL = 255;

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

// Engine spin-direction tables — mirrors SPIN_DX/SPIN_DY/DIR_MAP in
// planck.c. Indexed by spin value 0-8 (0 = stationary, no vector).
export const SPIN_DX = [0, 0, 1, 1, 1, 0, -1, -1, -1];
export const SPIN_DY = [0, -1, -1, 0, 1, 1, 1, 0, -1];
// Maps signed (dy, dx) vector sums back to a spin id: DIR_MAP[dy+1][dx+1].
export const DIR_MAP = [[8, 1, 2], [7, 0, 3], [6, 5, 4]];

// Octant-ordered spin ids (0°=RIGHT through 315°=UP_RIGHT, y-down screen
// coords) — for mapping a continuous angle to the nearest discrete spin.
// NOTE: this is smoother than DIR_MAP sign-snapping, which the engine uses
// internally for dominant_spin — painted seeds use this; emergent flow
// re-quantizes through DIR_MAP on tick.
export const OCTANT_SPIN_MAP = [
    SPIN_RIGHT,       // 0: ~0° (East)
    SPIN_DOWN_RIGHT,  // 1: ~45° (SE)
    SPIN_DOWN,        // 2: ~90° (South)
    SPIN_DOWN_LEFT,   // 3: ~135° (SW)
    SPIN_LEFT,        // 4: ~180° (West)
    SPIN_UP_LEFT,     // 5: ~225° (NW)
    SPIN_UP,          // 6: ~270° (North)
    SPIN_UP_RIGHT     // 7: ~315° (NE)
];

// --- Hex Substrate (6-fold) ---
// Mirrors HEX_OFF/HEX_INV in planck.c and HOFF in engine-sim.mjs — the
// three must stay in sync. Spins 1-6 = E, SE, SW, W, NW, NE at screen
// angles (spin-1)*60°; diagonal offsets alternate by row parity (odd-r).
export const HEX_OFFSETS = [
    [[0,0],[1,0],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1]], // even rows
    [[0,0],[1,0],[1,1],[0,1],[-1,0],[0,-1],[1,-1]]    // odd rows
];

// Angle → hex spin (sextant quantization).
export const hexSextant = (angle) =>
    ((Math.floor((angle + Math.PI * 2 + Math.PI / 6) / (Math.PI / 3)) % 6) + 6) % 6 + 1;

// Odd-r offset → axial hex distance between two cells.
export const hexDistance = (x, y, cx, cy) => {
    const dq = (x - Math.floor(y / 2)) - (cx - Math.floor(cy / 2));
    const dr = y - cy;
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
};

// --- Substrate Selection ---
// Which engine module boots — 'square' (oct8, Moore adjacency) or 'hex'
// (hex6, 6-fold). Stored across sessions; switching reboots the sim.
export const TOPOLOGY_KEY = 'wake_topology';
export const getTopology = () =>
    (typeof localStorage !== 'undefined' && localStorage.getItem(TOPOLOGY_KEY) === 'hex') ? 'hex' : 'square';
export const spinMax = (topology) => topology === 'hex' ? 6 : 8;

// --- Heat Presets ---
// Shared field vocabulary used by both the brush palette and the
// scenario composers — palette-only and scenario-only presets live in
// their own files instead.
export const HEAT_COLD_WATER = 20;
export const HEAT_ROOM_AMBIENT = 500;

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
