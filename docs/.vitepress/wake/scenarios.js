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
    OCTANT_SPIN_MAP,
    HEX_OFFSETS,
    hexSextant,
    hexDistance,
    spinMax,
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

// Synthetic Electron — a bound octagon torus. Momentum in this substrate is
// ballistic, so closed circulation only survives on the lattice's native
// loop: an octagon whose flat edges carry exact spin tangents. Phase Lock
// (engine-side) keeps each cell's painted phase steering the flux, and the
// spin-only halo recaptures corner leakage back into circulation.
const ELECTRON_CORE_RADIUS = 8;
const ELECTRON_MOAT_OCT = 25;      // cleared vacuum between anchor and waveguide
const ELECTRON_RING_INNER = 45;    // mass band inner apothem
const ELECTRON_RING_OUTER = 55;    // mass band outer apothem
const ELECTRON_HALO_OCT = 90;      // spin-only waveguide extends past the ring
const ELECTRON_RING_QUANTA = 70;   // pairwise merges stay far under deadlock
// NOTE: no ambient foam here. Mass is conserved on the closed torus —
// painted projectiles can't decay or escape, so they inevitably clump
// into deadlock knots that tear the ring apart gravitationally. The
// harness shows every projectile density kills the orbit within ~300
// ticks; clean vacuum circulates indefinitely (1000+ ticks, zero loss).

// Octagonal radius: the lattice's native perimeter. Each flat edge is
// perpendicular to one of the 8 axes, so its tangent is an exact spin —
// mass flows laminar along edges and turns at vertices under Phase Lock.
const octRadius = (dx, dy) => Math.max(
    Math.abs(dx),
    Math.abs(dy),
    Math.abs(dx + dy) * Math.SQRT1_2,
    Math.abs(dx - dy) * Math.SQRT1_2
);

// Maps a center-relative offset to tangent momentum via 8-octant quantization (45° sectors).
// Restores cardinal directions (UP, DOWN, LEFT, RIGHT) alongside diagonals so circulating
// bodies (like the Synthetic Electron shell and Stellar convective bands) form continuous
// closed loops rather than shearing into four linear quadrant slabs.
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
        topologies: ['square', 'hex'],
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
        objective: "Architect stable matter: a bound torus where the phase lattice steers the flow that sustains it — hydrodynamic integrity, not painted stasis.",
        mechanisms: "Phase Lock keeps edge cells steering flux within the laminar regime; the octagon is the lattice's native closed streamline (flat edges carry exact spin tangents); the spin-only halo waveguide recaptures corner leakage.",
        recommendedBrushes: ["💧 Fluid", "🔥 Igniter", "⚙️ Rotor"],
        bestLayers: "🧲 Phase + 👁 Macro",
        tips: "In clean vacuum the torus circulates indefinitely — ambient projectiles inevitably clump into deadlock knots that tear it apart. Crush Thermal Limit under ~4k to unwind the core: the densest knots fail first."
    },
    ocean: {
        title: "🌊 Deep Ocean",
        objective: "Resting incompressible fluid dynamics, wave propagation, and thermohaline convection.",
        mechanisms: "Low-entropy hydrostatic basin, momentum shunting, and thermal vent buoyancy.",
        recommendedBrushes: ["💧 Fluid", "🔥 Igniter"],
        bestLayers: "👁 Macro + ♨ Metabolic",
        tips: "Drop Fluid from above to observe splash ripples, or place an Igniter on the seabed to create a hydrothermal plume."
    },
    // --- Hex-native scenarios (hex6 substrate) ---
    // The 6-fold universe is filament-world: bound states are discrete
    // graph cycles, and accretion needs angular momentum. These paints
    // are the harness-proven variants — see engine-sim.mjs.
    filament: {
        topologies: ['hex'],
        title: "⬡ Filament Electron",
        objective: "The 6-fold bound state: a braided one-cell filament loop — circulation as a graph cycle, not a volumetric shell.",
        mechanisms: "No tangent is an allowed spin on hex adjacency, so extended rings shear apart; the native closed streamline is a discrete hexagonal cycle where every cell's phase points exactly at the next. Phase Lock plus the spin-only halo waveguide recapture leakage.",
        recommendedBrushes: ["💧 Fluid", "🔥 Igniter", "⚙️ Rotor"],
        bestLayers: "🧲 Phase + 👁 Macro",
        tips: "Compare with ⚛ Synthetic Electron on the oct8 substrate (⚙ System → Substrate): same thermodynamics, different adjacency — shell-world vs filament-world."
    },
    filamentbomb: {
        topologies: ['hex'],
        title: "⬡ Filament Under Fire",
        objective: "Stress-test the bound state: ambient quantum foam plus an aimed dense projectile on a collision course with the filament.",
        mechanisms: "The harness shows the loop absorbs a single hit intact (Phase Lock + halo recapture the shockwave), then sheds severed cells into a persistent arc — quantized severing, not the octagon's volumetric erosion. Sustained foam kills it at roughly the same rate as the octagon electron.",
        recommendedBrushes: ["💧 Fluid", "🔥 Igniter"],
        bestLayers: "🧲 Phase + 👁 Macro",
        tips: "Watch the loop absorb the incoming clump whole, then look for the gap where it severs — the surviving arc keeps circulating. Stamp more projectiles to keep the pressure on."
    },
    accretion: {
        topologies: ['hex'],
        title: "⬡ Accretion Disk",
        objective: "Emergent accretion under the tension field: a bare anchor knot propagates a diffusing tension well — a grazing stream sheds its boundary layer into bound capture at the well's edge.",
        mechanisms: "Near-deadlock occupancy emits scalar tension that diffuses outward and decoheres with range; flux arriving inside the gradient shears up-field into a flowing neighbor's buffer. Grazing passes capture boundary mass into new deadlocked cells — the disk forms from the field, not from painted spiral spins. Direct hits erode instead (tidal stripping).",
        recommendedBrushes: ["💧 Fluid", "🧊 Cryo", "🔥 Igniter"],
        bestLayers: "♨ Metabolic + 👁 Macro",
        tips: "Watch the stream's lower edge bleed into knots orbiting the well — capture peaks at grazing incidence. Stamp Fluid above the stream to feed the disk, or an Igniter onto the anchor to evaporate the well's source."
    },
    jam: {
        topologies: ['hex'],
        title: "⬡ The Bottleneck",
        objective: "Congestion gravity under load: a wide SE-bound stream forced through a 60-cell gap whose wall radiates tension.",
        mechanisms: "The deadlocked wall emits a tension field that shears the upstream pile — the jam forms, detonates at the face, and the congestion itself becomes a field source. Routing impedance, bandwidth cycle-stealing, and shunt deflection remain visible at the throat.",
        recommendedBrushes: ["🔥 Igniter", "🧱 Wall"],
        bestLayers: "👁 Macro + ♨ Metabolic",
        tips: "Narrow the gap with the Wall brush to harden the jam; an Igniter on the jam face unwinds the knot and relieves the pressure."
    }
};

export function loadScenario(type, bridge, topology = 'square') {
    bridge.clearGrid();
    const composer = new GridComposer(bridge);

    let targetDissipation = DISSIPATION_DEFAULT;
    let targetThermal = THERMAL_LIMIT_DEFAULT;
    const smax = spinMax(topology);

    switch (type) {
        case "vacuum": {
            targetDissipation = DISSIPATION_DEFAULT;
            targetThermal = THERMAL_LIMIT_DEFAULT;

            // Central core knot: stationary deadlock anchor. A spin-0 node
            // never sends, so the knot holds mass permanently — the field's
            // fixed gravitational center.
            composer.apply((x, y, nx, ny, dist, dx, dy) => {
                const rOct = octRadius(dx, dy);
                if (rOct <= 8) return packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, 1);
                return null;
            });
            // Ambient dust (Random distribution, within the substrate's
            // spin vocabulary — hex has 6 directions, not 8)
            composer.sprinkle(200, () => packNode(VACUUM_DUST_QUANTA, Math.floor(Math.random() * smax) + 1, VACUUM_DUST_HEAT));
            break;
        }

        case "stellar": {
            targetDissipation = DISSIPATION_DENSE; // Keeps the star from achieving thermal runaway
            targetThermal = THERMAL_LIMIT_SATURATED;

            // Seamless Octagonal Lattice Layers
            composer.apply((x, y, nx, ny, dist, dx, dy) => {
                const rOct = octRadius(dx, dy);

                // Core: Dense, stationary deadlock — anchored in place so it
                // can hold the envelope's mass without leaking outward.
                if (rOct < 15) {
                    return packNode(STELLAR_CORE_QUANTA, SPIN_STATIONARY, STELLAR_CORE_HEAT);
                }
                // Radiative Zone: High heat, isotropic turbulent sub-spins
                else if (rOct < 50) {
                    const heat = 45000 - ((rOct - 15) / 35) * 30000;
                    const spin = Math.floor(Math.random() * 8) + 1;
                    return packNode(150, spin, Math.floor(heat));
                }
                // Convective Envelope: Rotational banding using tangent vortex flow
                else if (rOct < 120) {
                    const heat = 15000 - ((rOct - 50) / 70) * 14000;
                    const chirality = (Math.floor(rOct) % 20 < 10) ? 1 : -1;
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
                const rOct = octRadius(dx, dy);

                // Core anchor: permanent stationary deadlock, boots cold.
                // Spin-0 nodes never send, so the anchor can't bleed mass.
                if (rOct <= ELECTRON_CORE_RADIUS) return packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, 1);
                
                // Moat (cleared to vacuum so the halo acts purely as a spin-waveguide)
                if (rOct <= ELECTRON_MOAT_OCT) return packNode(0, SPIN_STATIONARY, 1);

                // Spin-only halo (Waveguide) & Octagon Mass Ring
                if (rOct <= ELECTRON_HALO_OCT) {
                    const spin = vortexSpin(dx, dy, 1);
                    
                    // Dense mass ring (Laminar edge flow, vertices turn under phase lock)
                    if (rOct >= ELECTRON_RING_INNER && rOct <= ELECTRON_RING_OUTER) {
                        return packNode(ELECTRON_RING_QUANTA, spin, HEAT_ROOM_AMBIENT);
                    }
                    
                    // The Waveguide: 0 quanta, but structurally painted phase.
                    // Escaping mass lands on these empty cells and the phase lock steers it back.
                    return packNode(0, spin, 1);
                }

                // Clean vacuum beyond the halo — the bound state needs an
                // intact waveguide; ambient mass would become shrapnel.
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

        // --- Hex-native scenarios (hex6 substrate) ---
        // Paints mirror the harness-proven variants in engine-sim.mjs.

        case "filament":
        case "filamentbomb": {
            // The hexcycle bound state: a 1-cell discrete hexagonal loop
            // where every cell's spin points at the counterclockwise-next
            // cell on the loop — exact on the cell graph. The octagon
            // electron's hex-native counterpart (filament, not shell).
            targetDissipation = DISSIPATION_DEFAULT;
            targetThermal = THERMAL_LIMIT_DEFAULT;

            composer.apply((x, y, nx, ny, dist, dx, dy) => {
                const dh = hexDistance(x, y, composer.cx, composer.cy);
                if (dh <= 8) return packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, 1);
                if (dh <= 25) return packNode(0, SPIN_STATIONARY, 1); // moat
                if (dh <= 90) {
                    let spin = hexSextant(Math.atan2(dy, dx) + Math.PI / 2); // tangent halo
                    if (dh === 50) {
                        // Exact circulation: spin = the CCW-next loop cell
                        // on the hex graph (never the quantized tangent).
                        const off = HEX_OFFSETS[y & 1];
                        const aCur = Math.atan2(dy, dx);
                        let best = 0, bestA = Infinity;
                        for (let d = 1; d <= 6; d++) {
                            const nx2 = (x + off[d][0] + GRID_WIDTH) % GRID_WIDTH;
                            const ny2 = (y + off[d][1] + GRID_HEIGHT) % GRID_HEIGHT;
                            if (hexDistance(nx2, ny2, composer.cx, composer.cy) !== 50) continue;
                            let da = Math.atan2(ny2 - composer.cy, nx2 - composer.cx) - aCur;
                            while (da <= 0) da += Math.PI * 2;
                            if (da < bestA) { bestA = da; best = d; }
                        }
                        if (best) spin = best;
                        return packNode(90, spin, HEAT_ROOM_AMBIENT); // v3.0: q=120 cooked off at ~t450 (collision heat at the anchor edge); 90 holds 300/300 to t2000 in harness
                    }
                    return packNode(0, spin, 1); // spin-only waveguide
                }
                // filamentbomb: the harness's hexcyclep — an aimed dense
                // projectile plus ambient foam, to stress-test the loop's
                // quantized severing live.
                if (type === 'filamentbomb') {
                    const pd = hexDistance(x, y, composer.cx - 120, composer.cy - 60);
                    if (pd <= 12) return packNode(150, hexSextant(Math.atan2(composer.cy - y, composer.cx - x)), HEAT_ROOM_AMBIENT);
                    if (Math.random() < 0.05) return packNode(5, Math.floor(Math.random() * smax) + 1, 100);
                }
                return null;
            });
            break;
        }

        case "accretion": {
            // Emergent accretion under the tension field (harness variant
            // hexaccretion): a bare anchor knot emits a diffusing tension
            // well, and a grazing stream at impact parameter ~28 sheds its
            // boundary layer into bound capture around the well's edge —
            // an accretion disk that forms from the field, not from
            // painted spiral spins. The old hexsnow spiral-infall relied
            // on scripted deposition the shear now deflects.
            targetDissipation = DISSIPATION_DEFAULT;
            targetThermal = THERMAL_LIMIT_DEFAULT;

            composer.apply((x, y) => {
                const dh = hexDistance(x, y, composer.cx, composer.cy);
                if (dh <= 8) return packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, 1);
                if (dh <= 25) return packNode(0, SPIN_STATIONARY, 1); // moat
                const sy = composer.cy - 28;
                if (y >= sy - 3 && y <= sy + 3 && x >= 30 && x <= 370) {
                    return packNode(80, 1, HEAT_ROOM_AMBIENT); // E-bound stream grazing the well
                }
                return null;
            });
            break;
        }

        case "jam": {
            // The hexjam bottleneck under the tension baseline: the q=255
            // wall emits a field that shears the upstream pile apart, so
            // the gap is narrowed to 60 cells (harness JAM_GAP=30) — the
            // jam reforms and congestion visibly emits its own tension.
            targetDissipation = DISSIPATION_DEFAULT;
            targetThermal = THERMAL_LIMIT_DEFAULT;

            composer.apply((x, y) => {
                if (y === 200 && (x < 170 || x > 230)) return packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, 1);
                if (y >= 60 && y <= 195) return packNode(60, 2, HEAT_ROOM_AMBIENT); // SE flow into the wall
                return null;
            });
            break;
        }
    }

    bridge.setDissipation(targetDissipation);
    bridge.setThermalLimit(targetThermal);
    return { targetDissipation, targetThermal };
}

export function randomizeScenarioSoup(type, bridge, topology = 'square') {
    bridge.clearGrid();
    const composer = new GridComposer(bridge);
    const flavor = Math.floor(Math.random() * 3);
    const smax = spinMax(topology);

    switch (type) {
        case "vacuum": {
            loadScenario("vacuum", bridge, topology); // Populates the persistent stabilized central knot
            if (flavor === 0) {
                // Nebula Clusters
                for (let c = 0; c < 3; c++) {
                    const nx = 50 + Math.random() * (GRID_WIDTH - 100);
                    const ny = 50 + Math.random() * (GRID_HEIGHT - 100);
                    composer.sprinkle(150, () => {
                        const rx = nx + (Math.random() * 40 - 20);
                        const ry = ny + (Math.random() * 40 - 20);
                        return packNode(80, Math.floor(Math.random() * smax) + 1, 15000);
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
                    const rOct = octRadius(dx, dy);
                    if (dy < 0 && dx > -10 && dx < 10 && rOct > 15 && rOct < 140) {
                        return packNode(180, SPIN_UP, HEAT_SATURATION);
                    }
                    return null;
                });
            } else if (flavor === 1) {
                // Core Asymmetry / Wobble
                composer.apply((x, y, nx, ny, dist, dx, dy) => {
                    const rOct = octRadius(dx - 15, dy + 15);
                    if (rOct < 12) return packNode(250, SPIN_STATIONARY, 55000);
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
                    const ddx = x - bx, ddy = y - by;
                    const rOct = octRadius(ddx, ddy);
                    if (rOct <= 6) return packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, 1);
                    if (rOct <= 18) return packNode(0, SPIN_STATIONARY, 1);
                    if (rOct <= 60) {
                        const spin = vortexSpin(ddx, ddy, -1);
                        if (rOct >= 32 && rOct <= 40) return packNode(ELECTRON_RING_QUANTA, spin, HEAT_ROOM_AMBIENT);
                        return packNode(0, spin, 1);
                    }
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
                    const rOct = octRadius(x - (composer.cx - 120), y - (composer.cy - 60));
                    if (rOct < 15) return packNode(150, SPIN_DOWN_RIGHT, 800);
                    return null;
                });
            }
            break;
        }

        default: {
            // Hex-native scenarios have no soup mutations yet — Random
            // simply repaints the base scenario rather than dead-ending
            // on an empty field.
            loadScenario(type, bridge, topology);
            break;
        }
    }
}
