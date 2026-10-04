import {
    GRID_WIDTH,
    GRID_HEIGHT,
    DISSIPATION_DEFAULT,
    THERMAL_LIMIT_DEFAULT,
    QUANTA_ANCHOR_WALL,
    SPIN_STATIONARY,
    SPIN_UP,
    SPIN_DOWN,
    SPIN_RIGHT,
    SPIN_LEFT,
    SPIN_UP_RIGHT,
    SPIN_DOWN_LEFT,
    SPIN_DOWN_RIGHT,
    SPIN_UP_LEFT,
    DIR_MAP,
    HEAT_COLD_WATER,
    HEAT_ROOM_AMBIENT,
    packNode
} from './constants.js';

// --- Scenario-Local Tuning ---
// These presets belong to the scenario composers, not the app — the
// shared constant pool only holds engine semantics (grid dims, node
// bitfield, spin directions) and vocabulary used across files.
const DISSIPATION_DENSE = 45;        // Stellar + ocean: resists thermal runaway
const DISSIPATION_NOZZLE = 45;
const THERMAL_LIMIT_SATURATED = 65000; // Stellar + ocean headroom above plasma
const THERMAL_LIMIT_ENGINE_BELL = 60000;

const HEAT_ABSOLUTE_ZERO = 0;
const HEAT_IGNITER_PLASMA = 60000;
const HEAT_SATURATION = 65000;       // Soup blasts: near-max unwinding heat

const QUANTA_GAS_MIN = 2;
const QUANTA_GAS_VARIANCE = 3;
const VACUUM_DUST_QUANTA = 60;
const VACUUM_DUST_HEAT = 800;
const STELLAR_CORE_QUANTA = 250;
const STELLAR_CORE_HEAT = 45000;
const STELLAR_CORONA_HEAT = 1000;
const OCEAN_WATER_QUANTA = 40;
const BOUNDARY_FLOW_QUANTA = 25;
const BOUNDARY_FLOW_HEAT_MIN = 5000;
const BOUNDARY_FLOW_HEAT_SPAN = 8000;
const ATMOS_BEDROCK_HEAT = 800;

// Synthetic Electron — the dissipative torus. Stability comes from the
// physics, not painted heat: the shell's mass is capped at half the
// deadlock ceiling so any pairwise merge lands at exactly 200 (deadlock
// is strictly >200) and flow can never stall.
const ELECTRON_CORE_RADIUS = 8;
const ELECTRON_MOAT_RADIUS = 20;
const ELECTRON_SHELL_RADIUS = 80;
const ELECTRON_SHELL_QUANTA = 100;
const ELECTRON_MOAT_QUANTA = 4;
const ELECTRON_FOAM_QUANTA = 5;
const ELECTRON_FOAM_PROBABILITY = 0.05;

// Maps a center-relative offset to tangent momentum via 8-octant quantization (45° sectors).
// Restores cardinal directions (UP, DOWN, LEFT, RIGHT) alongside diagonals so circulating
// bodies (like the Synthetic Electron shell and Stellar convective bands) form continuous
// closed loops rather than shearing into four linear quadrant slabs.
const OCTANT_SPIN_MAP = [
    SPIN_RIGHT,       // 0: ~0° (East)
    SPIN_DOWN_RIGHT,  // 1: ~45° (SE)
    SPIN_DOWN,        // 2: ~90° (South)
    SPIN_DOWN_LEFT,   // 3: ~135° (SW)
    SPIN_LEFT,        // 4: ~180° (West)
    SPIN_UP_LEFT,     // 5: ~225° (NW)
    SPIN_UP,          // 6: ~270° (North)
    SPIN_UP_RIGHT     // 7: ~315° (NE)
];

const vortexSpin = (dx, dy, chirality = 1) => {
    if (dx === 0 && dy === 0) return SPIN_STATIONARY;
    const tx = -dy * chirality;
    const ty = dx * chirality;
    let angle = Math.atan2(ty, tx); // -PI to +PI
    if (angle < 0) angle += Math.PI * 2; // Normalize to [0, 2*PI)
    const octant = Math.floor((angle + Math.PI / 8) / (Math.PI / 4)) % 8;
    return OCTANT_SPIN_MAP[octant];
};

// --- Grid Composer Utility ---
// Eliminates magic-number loops by applying declarative, math-based gradients 
// and noise distributions across the entire physical field.
class GridComposer {
    constructor(bridge) {
        this.bridge = bridge;
        this.cx = Math.floor(GRID_WIDTH / 2);
        this.cy = Math.floor(GRID_HEIGHT / 2);
    }

    // Maps a function across the entire field. 
    // Passes coordinates (x,y), normalized coordinates 0-1 (nx,ny), and radial distance from center.
    apply(callback) {
        for (let y = 0; y < GRID_HEIGHT; y++) {
            const ny = y / GRID_HEIGHT;
            const dy = y - this.cy;
            for (let x = 0; x < GRID_WIDTH; x++) {
                const nx = x / GRID_WIDTH;
                const dx = x - this.cx;
                const dist = Math.hypot(dx, dy);
                
                const state = callback(x, y, nx, ny, dist, dx, dy);
                if (state !== null && state !== undefined) {
                    this.bridge.setNodeState(x, y, state);
                }
            }
        }
    }
    
    // Distributes a specific number of nodes randomly across the field
    sprinkle(count, callback) {
        for(let i = 0; i < count; i++) {
            const x = Math.floor(Math.random() * GRID_WIDTH);
            const y = Math.floor(Math.random() * GRID_HEIGHT);
            const state = callback(x, y);
            if (state !== null && state !== undefined) {
                this.bridge.setNodeState(x, y, state);
            }
        }
    }
}

export const SCENARIO_DOSSIERS = {
    vacuum: {
        title: "🌌 Vacuum Core",
        objective: "Study cold cosmic baseline entropy and high-energy topological mass deadlocks.",
        mechanisms: "CMB floor dissipation, zero-friction dispersion, and topological unwinding.",
        recommendedBrushes: ["🔥 Igniter", "⚙️ Rotor"],
        bestLayers: "👁 Macro + 🕳 Entropic",
        tips: "Hold an Igniter against the central knot — or drag Thermal Limit under ~4k — to unwind the deadlock and spike the Yield counter."
    },
    stellar: {
        title: "☀️ Stellar Core",
        objective: "Radial hydrostatic equilibrium, thermonuclear containment, and convective envelopes.",
        mechanisms: "Isotropic gravitational pressure, radial heat gradients, and rotational banding.",
        recommendedBrushes: ["🧊 Cryo", "🕳 Erase"],
        bestLayers: "♨ Metabolic + 🧲 Phase",
        tips: "Pierce the outer convective envelope with Cryo to trigger a localized pressure collapse and solar flare."
    },
    atmosphere: {
        title: "🪐 Atmosphere",
        objective: "Barometric hydrostatic equilibrium and convective updrafts.",
        mechanisms: "Exponential density gradient, thermal buoyancy, and soft kinetic collisions.",
        recommendedBrushes: ["💨 Gas", "🔥 Igniter"],
        bestLayers: "👁 Macro + ♨ Metabolic",
        tips: "Stamp hot Gas or Igniters at the bedrock boundary to trigger buoyant atmospheric convection columns."
    },
    nozzle: {
        title: "🚀 Engine Bell (Global)",
        objective: "Macro fluid expansion through a converging-diverging de Laval rocket nozzle.",
        mechanisms: "Choked throat flow, oblique shock boundaries, and separation eddies.",
        recommendedBrushes: ["🔥 Igniter", "🧱 Wall"],
        bestLayers: "👁 Macro + 🧲 Phase",
        tips: "Inject high-heat plasma at the nozzle throat to see expansion shocks form along the bell contour."
    },
    boundary: {
        title: "🔬 Nozzle Wall (Micro-Patch)",
        objective: "Sub-millimeter boundary layer shear and acoustic wall quenching.",
        mechanisms: "1-node acoustic backscatter, viscous boundary layer deceleration, and turbulence peeling.",
        recommendedBrushes: ["🔥 Igniter", "💧 Fluid", "🧊 Cryo"],
        bestLayers: "♨ Metabolic + 🧲 Phase",
        tips: "Watch supersonic flow scrape along the vertical solid wall on the left. Cryo coolants reveal thermal quenching."
    },
    electron: {
        title: "⚛️ Synthetic Electron",
        objective: "Architect stable matter: a dissipative torus held together by coherent circulation, thermal equilibrium, and deadlock avoidance.",
        mechanisms: "Aligned tangent flow avoids head-on cancellation; uniform ~100-quanta shell keeps pairwise merges under the 200 deadlock threshold; the cold anchor core sits safely below the gravity override.",
        recommendedBrushes: ["💧 Fluid", "🔥 Igniter", "⚙️ Rotor"],
        bestLayers: "🧲 Phase + ♨ Metabolic",
        tips: "Watch the relaxation phase as the shell condenses and locks. Then crush Thermal Limit under ~4k to unwind the core — the densest knots fail first."
    },
    ocean: {
        title: "🌊 Deep Ocean",
        objective: "Resting incompressible fluid dynamics, wave propagation, and thermohaline convection.",
        mechanisms: "Low-entropy hydrostatic basin, momentum shunting, and thermal vent buoyancy.",
        recommendedBrushes: ["💧 Fluid", "🔥 Igniter"],
        bestLayers: "👁 Macro + ♨ Metabolic",
        tips: "Drop Fluid from above to observe splash ripples, or place an Igniter on the seabed to create a hydrothermal plume."
    }
};

export function loadScenario(type, bridge) {
    bridge.clearGrid();
    const composer = new GridComposer(bridge);

    let targetDissipation = DISSIPATION_DEFAULT;
    let targetThermal = THERMAL_LIMIT_DEFAULT;

    switch (type) {
        case "vacuum": {
            targetDissipation = DISSIPATION_DEFAULT;
            targetThermal = THERMAL_LIMIT_DEFAULT;
            
            // Central core knot (Radial mapping) — a cold deadlock anchor.
            // Painted heat would only be transient initialization noise; the
            // knot earns its own metabolic temperature from quanta flux. Its
            // pre-dissipation tension (~3.9k) is the highest organic tension
            // in the field — crush the thermal limit under it to unwind it.
            composer.apply((x, y, nx, ny, dist) => {
                if (dist <= 8) return packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, 1);
                return null;
            });
            // Ambient dust (Random distribution)
            composer.sprinkle(200, () => packNode(VACUUM_DUST_QUANTA, Math.floor(Math.random() * 8) + 1, VACUUM_DUST_HEAT));
            break;
        }

        case "stellar": {
            targetDissipation = DISSIPATION_DENSE; // Keeps the star from achieving thermal runaway
            targetThermal = THERMAL_LIMIT_SATURATED;

            // Seamless Radial Layers
            composer.apply((x, y, nx, ny, dist, dx, dy) => {
                // Core: Extreme heat, dense, stationary deadlock
                if (dist < 15) {
                    return packNode(STELLAR_CORE_QUANTA, SPIN_STATIONARY, STELLAR_CORE_HEAT); // Safely below the plasma threshold
                }
                // Radiative Zone: High heat, isotropic turbulent sub-spins
                else if (dist < 50) {
                    const heat = 45000 - ((dist - 15) / 35) * 30000;
                    const spin = Math.floor(Math.random() * 8) + 1;
                    return packNode(150, spin, Math.floor(heat));
                }
                // Convective Envelope: Cooling thermal gradient, rotational banding (tangential circulation)
                else if (dist < 120) {
                    const heat = 15000 - ((dist - 50) / 70) * 14000;
                    const chirality = (Math.floor(dist) % 20 < 10) ? 1 : -1;
                    const spin = vortexSpin(dx, dy, chirality);
                    return packNode(80 + Math.floor(Math.random() * 40), spin, Math.floor(heat));
                }
                // Corona / Vacuum
                else {
                    if (Math.random() < 0.02) return packNode(QUANTA_GAS_MIN, SPIN_UP, STELLAR_CORONA_HEAT);
                }
                return null;
            });
            break;
        }

        case "atmosphere": {
            targetDissipation = DISSIPATION_DEFAULT;
            targetThermal = THERMAL_LIMIT_DEFAULT;
            
            // Vertical Depth Layers
            composer.apply((x, y, nx, ny) => {
                if (y < 3) return packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, HEAT_ABSOLUTE_ZERO);
                if (y >= GRID_HEIGHT - 3) return packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, ATMOS_BEDROCK_HEAT);
                
                const densityProb = Math.pow(ny, 1.8) * 65;
                if (Math.random() * 100 < densityProb) {
                    const airQuanta = QUANTA_GAS_MIN + Math.floor(ny * QUANTA_GAS_VARIANCE);
                    const localHeat = Math.floor(30 + Math.pow(ny, 2) * 1200);
                    const spin = Math.floor(Math.random() * 8) + 1;
                    return packNode(airQuanta, spin, localHeat);
                }
                return null;
            });
            break;
        }

        case "electron": {
            targetDissipation = DISSIPATION_DEFAULT;
            targetThermal = THERMAL_LIMIT_DEFAULT;

            composer.apply((x, y, nx, ny, dist, dx, dy) => {
                // Core anchor: permanent deadlock, boots cold and earns its
                // own metabolic temperature — the densest matter is the coldest.
                if (dist <= ELECTRON_CORE_RADIUS) return packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, 1);
                // Accretion moat: low-density gap isolating the anchor from
                // the shell's circulation. Transient by design — leaked mass
                // self-organizes into a grinding boundary layer at the core edge.
                if (dist <= ELECTRON_MOAT_RADIUS) return packNode(ELECTRON_MOAT_QUANTA, SPIN_STATIONARY, 1);
                // Vortex shell: uniform mass at exactly half the deadlock
                // ceiling — a worst-case two-into-one merge sums to 200,
                // not past it, so circulation can never stall into beads.
                if (dist <= ELECTRON_SHELL_RADIUS) return packNode(ELECTRON_SHELL_QUANTA, vortexSpin(dx, dy), HEAT_ROOM_AMBIENT);
                // Quantum foam: the active vacuum scraping the outer boundary.
                if (Math.random() < ELECTRON_FOAM_PROBABILITY) {
                    return packNode(ELECTRON_FOAM_QUANTA, Math.floor(Math.random() * 8) + 1, HEAT_ROOM_AMBIENT);
                }
                return null;
            });
            break;
        }

        case "ocean": {
            targetDissipation = DISSIPATION_DENSE;
            targetThermal = THERMAL_LIMIT_SATURATED;

            // Stratified fluid basin
            composer.apply((x, y) => {
                if (y >= GRID_HEIGHT - 4) return packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, HEAT_ROOM_AMBIENT);
                if (y > GRID_HEIGHT - 160) return packNode(OCEAN_WATER_QUANTA, SPIN_STATIONARY, HEAT_COLD_WATER);
                return null;
            });
            break;
        }

        case "nozzle": {
            targetDissipation = DISSIPATION_NOZZLE;
            targetThermal = THERMAL_LIMIT_ENGINE_BELL;
            
            // Geometric Math Constraint
            composer.apply((x, y, nx, ny, dist, dx, dy) => {
                if (y >= 50) {
                    const depth = y - 50;
                    const spread = 15 + Math.floor((depth * depth) / 250);
                    if (x < composer.cx - spread || x > composer.cx + spread) {
                        return packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, HEAT_ROOM_AMBIENT);
                    }
                }
                return null;
            });
            break;
        }

        case "boundary": {
            targetDissipation = DISSIPATION_NOZZLE;
            targetThermal = THERMAL_LIMIT_ENGINE_BELL;
            
            // Linear Left-to-Right Gradients
            composer.apply((x, y) => {
                if (x < 60) return packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, HEAT_ROOM_AMBIENT);
                if (Math.random() < 0.6) {
                    const distFromWall = x - 60;
                    const spin = (distFromWall < 8 && Math.random() < 0.4) ? SPIN_STATIONARY : SPIN_DOWN;
                    const heat = BOUNDARY_FLOW_HEAT_MIN + Math.floor(Math.random() * BOUNDARY_FLOW_HEAT_SPAN);
                    return packNode(BOUNDARY_FLOW_QUANTA, spin, heat);
                }
                return null;
            });
            break;
        }
    }

    bridge.setDissipation(targetDissipation);
    bridge.setThermalLimit(targetThermal);
    return { targetDissipation, targetThermal };
}

export function randomizeScenarioSoup(type, bridge) {
    bridge.clearGrid();
    const composer = new GridComposer(bridge);
    const flavor = Math.floor(Math.random() * 3);

    switch (type) {
        case "vacuum": {
            if (flavor === 0) {
                // Nebula Clusters
                for (let c = 0; c < 3; c++) {
                    const nx = 50 + Math.random() * (GRID_WIDTH - 100);
                    const ny = 50 + Math.random() * (GRID_HEIGHT - 100);
                    composer.sprinkle(150, () => {
                        const rx = nx + (Math.random() * 40 - 20);
                        const ry = ny + (Math.random() * 40 - 20);
                        return packNode(80, Math.floor(Math.random() * 8) + 1, 15000);
                    });
                }
            } else if (flavor === 1) {
                // Asteroid Field
                for (let c = 0; c < 15; c++) {
                    const nx = Math.floor(Math.random() * GRID_WIDTH);
                    const ny = Math.floor(Math.random() * GRID_HEIGHT);
                    bridge.setNodeState(nx, ny, packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, 10));
                    bridge.setNodeState(nx + 1, ny, packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, 10));
                    bridge.setNodeState(nx, ny + 1, packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, 10));
                }
            } else {
                // Cosmic Dust Drift
                composer.sprinkle(500, () => packNode(50, SPIN_RIGHT, 3000));
            }
            break;
        }
        
        case "stellar": {
            loadScenario("stellar", bridge);
            if (flavor === 0) {
                // Massive Core Flare (Punctures Envelope)
                composer.apply((x, y, nx, ny, dist, dx, dy) => {
                    if (dy < 0 && dx > -10 && dx < 10 && dist > 15 && dist < 140) {
                        return packNode(180, SPIN_UP, HEAT_SATURATION);
                    }
                    return null;
                });
            } else if (flavor === 1) {
                // Core Asymmetry / Wobble
                composer.apply((x, y, nx, ny, dist, dx, dy) => {
                    const offsetDist = Math.hypot(dx - 15, dy + 15);
                    if (offsetDist < 12) return packNode(250, SPIN_STATIONARY, 55000);
                    return null;
                });
            } else {
                // Heavy Meteor Strike
                composer.apply((x, y, nx, ny, dist, dx, dy) => {
                    if (x > composer.cx + 90 && x < composer.cx + 105 && y > 20 && y < 80) {
                        return packNode(QUANTA_ANCHOR_WALL, SPIN_DOWN_LEFT, 500);
                    }
                    return null;
                });
            }
            break;
        }

        case "atmosphere": {
            loadScenario("atmosphere", bridge);
            if (flavor === 0) {
                // Thermal Updraft Column
                composer.apply((x, y) => {
                    if (y > 30 && y < GRID_HEIGHT - 6 && x > composer.cx - 8 && x < composer.cx + 8) {
                        return Math.random() > 0.3 ? packNode(6, SPIN_UP, 35000) : null;
                    }
                    return null;
                });
            } else if (flavor === 1) {
                // Wind Shear Bands
                composer.apply((x, y) => {
                    if (y > 20 && y < GRID_HEIGHT - 10) {
                        const inBand = Math.floor(y / 40) % 2 === 0;
                        if (inBand && Math.random() < 0.6) {
                            return packNode(8, (y % 80 < 40) ? SPIN_RIGHT : SPIN_LEFT, 1500);
                        }
                    }
                    return null;
                });
            } else {
                // Warm Thermal Pockets
                for (let i = 0; i < 16; i++) {
                    const rx = Math.floor(Math.random() * (GRID_WIDTH - 20));
                    const ry = Math.floor(100 + Math.random() * (GRID_HEIGHT - 150));
                    for (let dy = 0; dy < 6; dy++) {
                        for (let dx = 0; dx < 6; dx++) {
                            bridge.setNodeState(rx + dx, ry + dy, packNode(8, SPIN_UP, 22000));
                        }
                    }
                }
            }
            break;
        }

        case "nozzle": {
            loadScenario("nozzle", bridge);
            if (flavor === 0) {
                // Continuous Core Ignition
                composer.apply((x, y) => {
                    if (y >= 50 && y < GRID_HEIGHT - 10 && x >= composer.cx - 4 && x <= composer.cx + 4) {
                        return packNode(140, SPIN_DOWN, HEAT_IGNITER_PLASMA);
                    }
                    return null;
                });
            } else if (flavor === 1) {
                // Pre-Ignition Sparks
                composer.sprinkle(40, () => {
                    const rx = composer.cx + (Math.random() * 24 - 12);
                    const ry = 60 + Math.random() * 60;
                    return packNode(180, Math.floor(Math.random() * 8) + 1, HEAT_SATURATION);
                });
            } else {
                // Asymmetric Wall Flare
                const side = Math.random() > 0.5 ? composer.cx - 12 : composer.cx + 12;
                composer.apply((x, y) => {
                    if (x === side && y >= 60 && y < 110) return packNode(180, SPIN_DOWN, HEAT_SATURATION);
                    return null;
                });
            }
            break;
        }

        case "boundary": {
            loadScenario("boundary", bridge);
            if (flavor === 0) {
                // Violent Wall Hotspot / Ablation
                composer.apply((x, y) => {
                    if (x >= 40 && x < 70 && y >= 100 && y < 140) return packNode(120, SPIN_DOWN, HEAT_IGNITER_PLASMA);
                    return null;
                });
            } else if (flavor === 1) {
                // Severe Acoustic Boundary Backscatter
                composer.apply((x, y) => {
                    if (x >= 60 && x < 68 && y >= 50 && y < GRID_HEIGHT - 50 && y % 15 === 0) {
                        return packNode(140, SPIN_UP, 45000);
                    }
                    return null;
                });
            } else {
                // Boundary Layer Separation Vortex
                composer.apply((x, y) => {
                    if (x >= 65 && x < 100 && y >= 180 && y < 220) return packNode(35, SPIN_UP, 12000);
                    return null;
                });
            }
            break;
        }

        case "ocean": {
            loadScenario("ocean", bridge);
            if (flavor === 0) {
                // Deep Vent Plumes
                const v1 = composer.cx - 50;
                const v2 = composer.cx + 50;
                composer.apply((x, y) => {
                    if (y <= GRID_HEIGHT - 6 && y > GRID_HEIGHT - 70) {
                        if (Math.abs(x - v1) <= 2 && Math.random() > 0.25) return packNode(50, SPIN_UP, 40000);
                        if (Math.abs(x - v2) <= 2 && Math.random() > 0.25) return packNode(50, SPIN_UP, 40000);
                    }
                    return null;
                });
            } else if (flavor === 1) {
                // Deep Steady Current
                composer.apply((x, y) => {
                    if (y >= GRID_HEIGHT - 90 && y < GRID_HEIGHT - 50 && Math.random() < 0.35) {
                        return packNode(45, SPIN_RIGHT, HEAT_COLD_WATER);
                    }
                    return null;
                });
            } else {
                // Surface Swell Waves
                composer.apply((x, y) => {
                    if (y >= GRID_HEIGHT - 160 && y < GRID_HEIGHT - 145 && Math.random() < 0.3) {
                        return packNode(45, (x % 4 < 2) ? SPIN_RIGHT : SPIN_LEFT, 800);
                    }
                    return null;
                });
            }
            break;
        }

        case "electron": {
            loadScenario("electron", bridge);
            if (flavor === 0) {
                // Counter-rotating binary pair — the positron analogue.
                // Where the two shells meet, contra-rotating tangents run
                // parallel, so the seam meshes instead of clashing.
                const bx = composer.cx + 130;
                const by = composer.cy;
                composer.apply((x, y, nx, ny, dist, dx, dy) => {
                    const d2 = Math.hypot(x - bx, y - by);
                    if (d2 <= 6) return packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, 1);
                    if (d2 <= 14) return packNode(ELECTRON_MOAT_QUANTA, SPIN_STATIONARY, 1);
                    if (d2 <= 60) return packNode(ELECTRON_SHELL_QUANTA, vortexSpin(x - bx, y - by, -1), HEAT_ROOM_AMBIENT);
                    return null;
                });
            } else if (flavor === 1) {
                // Transverse shear wall — a "magnetic sweep" bisecting the
                // torus. One hemisphere entrains, the other clashes.
                composer.apply((x, y, nx, ny, dist, dx, dy) => {
                    if (Math.abs(dy) < 3 && dist > 15 && dist < 130) {
                        return packNode(30, SPIN_RIGHT, HEAT_ROOM_AMBIENT);
                    }
                    return null;
                });
            } else {
                // Incoming projectile — a dense clump aimed at the shell to
                // watch the vortex catch and shred foreign mass.
                composer.apply((x, y, nx, ny, dist, dx, dy) => {
                    const d2 = Math.hypot(x - (composer.cx - 120), y - (composer.cy - 60));
                    if (d2 < 15) return packNode(150, SPIN_DOWN_RIGHT, 800);
                    return null;
                });
            }
            break;
        }
    }
}
