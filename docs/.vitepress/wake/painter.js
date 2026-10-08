// Scenario Painter — declarative scenario composition.
// A scenario spec is data, not code: a list of named primitive layers
// applied in order, plus environment knobs. The composer maps each
// layer across the field through the bridge's write surface; the C
// engine needs nothing new — every primitive is paint on the same
// four-node lattice the built-in scenarios use.
//
// Spec v1:
// {
//   v: 1,
//   name: "My Scenario",
//   topologies: ['square'|'hex'],        // substrate(s) the paint targets
//   knobs: { dissipation, thermal },     // environment — applied after paint
//   layers: [ { prim: 'anchor', p: {...} }, ... ]  // evaluated in order, last write wins
// }

import {
    GRID_WIDTH,
    GRID_HEIGHT,
    TOTAL_NODES,
    QUANTA_ANCHOR_WALL,
    SPIN_STATIONARY,
    OCTANT_SPIN_MAP,
    HEX_OFFSETS,
    hexSextant,
    hexDistance,
    octRadius,
    packNode
} from './constants.js';

export const PAINTER_VERSION = 1;
export const EXPORT_FORMAT = 'wake-scenario';

const CX = GRID_WIDTH / 2;
const CY = GRID_HEIGHT / 2;

// --- Substrate-aware geometry ---
// Radial primitives measure distance in the lattice's native metric:
// hex6 uses axial hex distance, oct8 uses the octagonal Chebyshev blend.
const nativeRadius = (x, y, topology) =>
    topology === 'hex' ? hexDistance(x, y, CX, CY) : octRadius(x - CX, y - CY);

// Quantizes a tangent angle (radians, 0 = +x, CCW-positive like atan2's
// convention on the image plane) into the substrate's spin vocabulary.
const aimSpin = (angle, topology) => {
    if (topology === 'hex') return hexSextant(angle) + 1;
    if (angle < 0) angle += Math.PI * 2;
    return OCTANT_SPIN_MAP[Math.floor((angle + Math.PI / 8) / (Math.PI / 4)) % 8];
};

const tangentSpin = (dx, dy, chirality, topology) => {
    if (dx === 0 && dy === 0) return SPIN_STATIONARY;
    return aimSpin(Math.atan2(dx * chirality, -dy * chirality), topology);
};

// Linear ramp between two intensities across a radial band.
const ramp = (r, rLo, rHi, a, b) => {
    const t = Math.min(1, Math.max(0, (r - rLo) / Math.max(1, rHi - rLo)));
    return Math.round(a + (b - a) * t);
};

// Perpendicular distance from (dx,dy) to the line through (ox,oy) at angle.
const lineDist = (dx, dy, ox, oy, angle) =>
    Math.abs(-Math.sin(angle) * (dx - ox) + Math.cos(angle) * (dy - oy));

// Signed distance along the line — bounds stream/wall segment length.
const lineAlong = (dx, dy, ox, oy, angle) =>
    Math.cos(angle) * (dx - ox) + Math.sin(angle) * (dy - oy);

// --- Primitive registry ---
// Each primitive: param schema (drives the auto-generated composer form)
// + an eval returning a packed node state or null (leave cell untouched).
// ctx: { x, y, dx, dy, dist, rNat, topology, rand }
export const PRIMITIVES = {
    anchor: {
        label: '⚓ Anchor Core',
        hint: 'Spin-0 deadlock mass — a wall core or dead knot',
        params: {
            r:    { label: 'Radius', min: 1, max: 60, step: 1, def: 8 },
            q:    { label: 'Density', min: 1, max: 255, step: 1, def: 255 },
            heat: { label: 'Heat', min: 0, max: 65535, step: 100, def: 500 }
        },
        eval(c, p) {
            if (c.rNat > p.r) return null;
            return packNode(p.q, SPIN_STATIONARY, p.heat);
        }
    },

    moat: {
        label: '🕳 Vacuum Moat',
        hint: 'Cleared band — isolates a structure from ambient pressure',
        params: {
            rIn:  { label: 'Inner r', min: 0, max: 250, step: 1, def: 9 },
            rOut: { label: 'Outer r', min: 1, max: 250, step: 1, def: 25 }
        },
        eval(c, p) {
            if (c.rNat <= p.rIn || c.rNat > p.rOut) return null;
            return packNode(0, SPIN_STATIONARY, 1);
        }
    },

    ring: {
        label: '◎ Ring / Filament',
        hint: 'Closed band — cycle flow makes a bound-state streamline',
        params: {
            r:      { label: 'Radius', min: 5, max: 250, step: 1, def: 50 },
            width:  { label: 'Width', min: 1, max: 20, step: 1, def: 1 },
            q:      { label: 'Density', min: 1, max: 255, step: 1, def: 90 },
            flow:   { label: 'Flow', type: 'select', def: 'cycle',
                      opts: { cycle: 'Circulating', tangent: 'Tangential', infall: 'Inward', outfall: 'Outward', none: 'Static' } },
            heat:   { label: 'Heat', min: 0, max: 65535, step: 100, def: 500 },
            chiral: { label: 'Chirality', type: 'select', def: 'ccw', opts: { ccw: '↺ CCW', cw: '↻ CW' } }
        },
        eval(c, p) {
            if (Math.abs(c.rNat - p.r) > p.width - 1) return null;
            const ch = p.chiral === 'ccw' ? 1 : -1;
            let spin = SPIN_STATIONARY;
            if (p.flow === 'cycle' || p.flow === 'tangent') spin = tangentSpin(c.dx, c.dy, ch, c.topology);
            else if (p.flow === 'infall') spin = aimSpin(Math.atan2(-c.dy, -c.dx), c.topology);
            else if (p.flow === 'outfall') spin = aimSpin(Math.atan2(c.dy, c.dx), c.topology);
            return packNode(p.q, spin, p.heat);
        }
    },

    halo: {
        label: '〰 Spin Halo',
        hint: 'Steering-only waveguide — fills unpainted cells without disturbing mass',
        fill: true,
        params: {
            rIn:    { label: 'Inner r', min: 0, max: 250, step: 1, def: 25 },
            rOut:   { label: 'Outer r', min: 1, max: 250, step: 1, def: 90 },
            flow:   { label: 'Flow', type: 'select', def: 'tangent',
                      opts: { tangent: 'Tangential', infall: 'Inward', outfall: 'Outward' } },
            chiral: { label: 'Chirality', type: 'select', def: 'ccw', opts: { ccw: '↺ CCW', cw: '↻ CW' } }
        },
        eval(c, p) {
            if (c.rNat <= p.rIn || c.rNat > p.rOut) return null;
            const ch = p.chiral === 'ccw' ? 1 : -1;
            let spin = tangentSpin(c.dx, c.dy, ch, c.topology);
            if (p.flow === 'infall') spin = aimSpin(Math.atan2(-c.dy, -c.dx), c.topology);
            else if (p.flow === 'outfall') spin = aimSpin(Math.atan2(c.dy, c.dx), c.topology);
            return packNode(0, spin, 1);
        }
    },

    disk: {
        label: '● Disk / Projectile',
        hint: 'Filled blob — aim it to make a projectile',
        params: {
            ox:   { label: 'Offset X', min: -300, max: 300, step: 5, def: -60 },
            oy:   { label: 'Offset Y', min: -200, max: 200, step: 5, def: 0 },
            r:    { label: 'Radius', min: 2, max: 60, step: 1, def: 12 },
            q:    { label: 'Density', min: 1, max: 255, step: 1, def: 80 },
            aim:  { label: 'Aim°', min: 0, max: 359, step: 15, def: 0 },
            spin: { label: 'Spin', type: 'select', def: 'aim',
                    opts: { aim: 'Aimed', radial: 'Radial-out', static: 'Static' } },
            heat: { label: 'Heat', min: 0, max: 65535, step: 100, def: 500 }
        },
        eval(c, p) {
            const r = Math.hypot(c.dx - p.ox, c.dy - p.oy);
            if (r > p.r) return null;
            let spin = SPIN_STATIONARY;
            if (p.spin === 'aim') spin = aimSpin((p.aim * Math.PI / 180), c.topology);
            else if (p.spin === 'radial') spin = aimSpin(Math.atan2(c.dy - p.oy, c.dx - p.ox), c.topology);
            return packNode(p.q, spin, p.heat);
        }
    },

    stream: {
        label: '➤ Stream',
        hint: 'Directed beam along a line — jet, braid, or jam feed',
        params: {
            ox:     { label: 'Origin X', min: -300, max: 300, step: 5, def: 0 },
            oy:     { label: 'Origin Y', min: -300, max: 300, step: 5, def: -60 },
            angle:  { label: 'Angle°', min: 0, max: 359, step: 15, def: 90 },
            width:  { label: 'Width', min: 2, max: 80, step: 1, def: 8 },
            length: { label: 'Length', min: 10, max: 600, step: 10, def: 400 },
            q:      { label: 'Density', min: 1, max: 255, step: 1, def: 40 },
            heat:   { label: 'Heat', min: 0, max: 65535, step: 100, def: 500 }
        },
        eval(c, p) {
            const a = p.angle * Math.PI / 180;
            if (lineDist(c.dx, c.dy, p.ox, p.oy, a) > p.width / 2) return null;
            if (Math.abs(lineAlong(c.dx, c.dy, p.ox, p.oy, a)) > p.length / 2) return null;
            return packNode(p.q, aimSpin(a, c.topology), p.heat);
        }
    },

    band: {
        label: '◌ Convective Band',
        hint: 'Radial gradient shell — stellar envelopes, accretion skirts',
        params: {
            rIn:    { label: 'Inner r', min: 0, max: 250, step: 1, def: 30 },
            rOut:   { label: 'Outer r', min: 1, max: 250, step: 1, def: 60 },
            qIn:    { label: 'Density in', min: 0, max: 255, step: 1, def: 150 },
            qOut:   { label: 'Density out', min: 0, max: 255, step: 1, def: 40 },
            heatIn: { label: 'Heat in', min: 0, max: 65535, step: 100, def: 45000 },
            heatOut:{ label: 'Heat out', min: 0, max: 65535, step: 100, def: 15000 },
            flow:   { label: 'Flow', type: 'select', def: 'vortex',
                      opts: { vortex: 'Vortex', radial: 'Radial-out', none: 'Static' } },
            chiral: { label: 'Chirality', type: 'select', def: 'ccw', opts: { ccw: '↺ CCW', cw: '↻ CW' } }
        },
        eval(c, p) {
            if (c.rNat <= p.rIn || c.rNat > p.rOut) return null;
            let spin = SPIN_STATIONARY;
            if (p.flow === 'vortex') spin = tangentSpin(c.dx, c.dy, p.chiral === 'ccw' ? 1 : -1, c.topology);
            else if (p.flow === 'radial') spin = aimSpin(Math.atan2(c.dy, c.dx), c.topology);
            return packNode(
                ramp(c.rNat, p.rIn, p.rOut, p.qIn, p.qOut),
                spin,
                ramp(c.rNat, p.rIn, p.rOut, p.heatIn, p.heatOut)
            );
        }
    },

    wall: {
        label: '▮ Wall Segment',
        hint: 'Spin-0 barrier — forces redirection, congestion, or slits',
        params: {
            ox:        { label: 'Offset X', min: -300, max: 300, step: 5, def: 0 },
            oy:        { label: 'Offset Y', min: -300, max: 300, step: 5, def: 0 },
            angle:     { label: 'Angle°', min: 0, max: 179, step: 15, def: 90 },
            length:    { label: 'Length', min: 10, max: 400, step: 10, def: 160 },
            thickness: { label: 'Thickness', min: 1, max: 20, step: 1, def: 4 },
            gapW:      { label: 'Gap width (0=none)', min: 0, max: 60, step: 1, def: 0 }
        },
        eval(c, p) {
            if (lineDist(c.dx, c.dy, p.ox, p.oy, p.angle * Math.PI / 180) > p.thickness / 2) return null;
            const along = lineAlong(c.dx, c.dy, p.ox, p.oy, p.angle * Math.PI / 180);
            if (Math.abs(along) > p.length / 2) return null;
            if (p.gapW > 0 && Math.abs(along) < p.gapW / 2) return null;
            return packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, 500);
        }
    },

    foam: {
        label: '❄ Ambient Foam',
        hint: 'Stochastic dust — settles into unpainted cells only',
        fill: true,
        params: {
            density: { label: 'Coverage %', min: 1, max: 100, step: 1, def: 4 },
            qMin:    { label: 'Density min', min: 1, max: 100, step: 1, def: 2 },
            qVar:    { label: 'Density var', min: 0, max: 50, step: 1, def: 3 },
            heat:    { label: 'Heat', min: 0, max: 65535, step: 100, def: 500 },
            spin:    { label: 'Spin', type: 'select', def: 'random',
                       opts: { random: 'Random', static: 'Static' } },
            seed:    { label: 'Seed (0=random)', min: 0, max: 99999, step: 1, def: 0 }
        },
        eval(c, p) {
            if (c.rand() * 100 >= p.density) return null;
            const spin = p.spin === 'random' ? c.randSpin() : SPIN_STATIONARY;
            return packNode(p.qMin + Math.floor(c.rand() * p.qVar), spin, p.heat);
        }
    }
};

// --- Spec validation & migration ---
// Export/import boundary: anything malformed or from the future is
// rejected loudly here rather than silently mis-painting the field.
export function validateSpec(spec) {
    if (!spec || typeof spec !== 'object') throw new Error('Not a scenario object');
    if (spec.v !== PAINTER_VERSION) {
        if (typeof spec.v === 'number' && spec.v < PAINTER_VERSION) {
            // Forward path for future schema migrations.
            return migrateSpec(spec);
        }
        throw new Error(`Unsupported spec version ${spec.v}`);
    }
    if (typeof spec.name !== 'string' || !spec.name.trim()) throw new Error('Scenario needs a name');
    if (!Array.isArray(spec.layers)) throw new Error('Scenario has no layers');
    for (const l of spec.layers) {
        if (!PRIMITIVES[l.prim]) throw new Error(`Unknown primitive '${l.prim}'`);
    }
    return spec;
}

function migrateSpec(spec) {
    // v-current is the only version in the wild; future migrations
    // transform older payloads up to PAINTER_VERSION here.
    throw new Error(`Cannot migrate spec version ${spec.v}`);
}

export function exportSpec(spec) {
    return JSON.stringify({ format: EXPORT_FORMAT, version: PAINTER_VERSION, spec }, null, 2);
}

export function importSpec(json) {
    const payload = JSON.parse(json);
    if (payload.format !== EXPORT_FORMAT) throw new Error('Not a wake-scenario export');
    return validateSpec(payload.spec);
}

export function defaultSpec() {
    return {
        v: PAINTER_VERSION,
        name: 'Custom Scenario',
        topologies: ['square', 'hex'],
        knobs: { dissipation: 15, thermal: 50000 },
        layers: []
    };
}

// --- Compositor ---
// One pass over the field per layer; later layers overwrite earlier
// paint where they claim the cell (last write wins, like coat order).
// Seeded RNG per foam layer keeps a spec deterministic when seed > 0.
export function composeScenario(spec, bridge, topology = 'square') {
    validateSpec(spec);
    bridge.clearGrid();

    // 'fill' primitives (foam, halo) only claim cells no earlier layer
    // painted — ambient dust shouldn't dissolve an anchor, and a steering
    // halo shouldn't erase the ring it shepherds. Paint primitives
    // overwrite unconditionally; layer order is the z-order.
    const painted = new Uint8Array(TOTAL_NODES);
    const ctx = { topology };

    for (let li = 0; li < spec.layers.length; li++) {
        const layer = spec.layers[li];
        const prim = PRIMITIVES[layer.prim];
        if (!prim) continue;

        // Deterministic stream per layer so seeded foam reproduces
        // exactly; seed 0 uses Math.random for variation.
        let s = (layer.p.seed || 0) + li * 0x9E3779B9;
        const rand = layer.p.seed
            ? () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
            : Math.random;
        const randSpin = () => 1 + Math.floor(rand() * (topology === 'hex' ? 6 : 8));

        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                const idx = y * GRID_WIDTH + x;
                if (prim.fill && painted[idx]) continue;
                ctx.x = x; ctx.y = y;
                ctx.dx = x - CX; ctx.dy = y - CY;
                ctx.dist = Math.hypot(ctx.dx, ctx.dy);
                ctx.rNat = nativeRadius(x, y, topology);
                ctx.rand = rand;
                ctx.randSpin = randSpin;
                const state = prim.eval(ctx, layer.p);
                if (state !== null && state !== undefined) {
                    bridge.setNodeState(x, y, state);
                    painted[idx] = 1;
                }
            }
        }
    }

    if (spec.knobs.dissipation != null) bridge.setDissipation(spec.knobs.dissipation);
    if (spec.knobs.thermal != null) bridge.setThermalLimit(spec.knobs.thermal);
    return { targetDissipation: spec.knobs.dissipation, targetThermal: spec.knobs.thermal };
}
