/*
 * The Planck Field Engine (Langevin's Wake)
 * Copyright (c) 2026 Nathan / btwo.me
 * v3.0: Pure discrete mathematics — integer momentum, argmax spin
 * resolution, LUT quadrature budget. No floats in the routing tick.
 */

#include <stdint.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <emscripten.h>

#define WIDTH (400)
#define HEIGHT (400)
#define PIXEL_COUNT (WIDTH * HEIGHT)

// --- Physics Constants ---
#define DEADLOCK_QUANTA (200)    // Density at which a target blocks incoming traffic
#define HEAT_MAX (65535)         // 16-bit thermal saturation ceiling
#define HEAT_DIFFUSION_DIV (9)   // Per-channel heat sharing rate — invariant across substrates
#define KINETIC_BASE (1)         // Base heat from a valid collision
#define KINETIC_SHUNT (5)        // Heat cost when a saturated port repels the flux
#define KINETIC_BACKPRESSURE (10) // Heat blowoff when an input buffer overflows (backscatter)
#define QUANTA_HEAT_GEN (15)     // Ambient heat emitted per unit of settled quanta
#define QUANTA_INJECT_HEAT (25)  // Heat added per injected quanta unit
#define TEMP_SCALAR_DIV (200)    // Divisor for thermal runaway acceleration
#define HEAT_FLOOR (2)           // Heat below this hits the stochastic floor
#define FLOW_CAP (160)           // Max quanta relayed per node per tick; residual accumulates
#define BACKSCATTER_DIV (20)     // Impedance backscatter = LIMIT/20
#define IMPEDANCE_DENSITY (180)  // Density that triggers acoustic backscatter
#define THERMAL_NORM (1200.0)    // Baseline for environment-normalized scaling
#define DISSIPATION_SCALE (0.1)  // Dissipation dampening factor in impedance injector
#define NODE_BANDWIDTH_MAX (220) // C_max vector budget ceiling for time dilation cycle-stealing
#define SEEP_SHIFT (6)          // Porous barrier: saturated ports leak sendable>>6 (~1.6%)
#define SEEP_ABS_SHIFT (1)      // Mid-hop absorption: half the leaked flux thermalizes
#define SEEP_BURN_SHIFT (2)     // Deadlocked nodes burn staged flux/tick — dwell attenuation
#define BUFDECAY_SHIFT (4)      // Radiation decoherence: unresolved buffer flux thermalizes ~6%/tick

// --- Tension Field (causal mechanics, harness-validated) ---
// Occupancy above TENSION_EMIT_MIN sources a scalar field that diffuses
// per-channel at >>TENSION_SHARE, decoheres at >>TENSION_DECAY, and
// shears arriving flux toward the up-gradient flowing neighbor by
// >>TENSION_DIVERT. Flag-gated: default off. NOT a gravity module —
// the measured phenomenology is local accretion/stripping/dispersal
// (see docs/interference.md, Causal Mechanics Probes).
#define TENSION_EMIT_MIN (200)   // only near-deadlock occupancy emits — knots source the field
#define TENSION_EMIT_SHIFT (4)   // occupancy >> 4 → source strength
#define TENSION_SHARE (3)        // per-channel diffusion share tn>>3 (~12%/hop)
#define TENSION_DECAY (5)        // field decoherence tn>>5 (~3%/tick) — sets reach ℓ
#define TENSION_DIVERT (4)       // arrivals >> 4 shear up-gradient (~6%)

// --- Undo Snapshot Ring ---
#define SNAPSHOT_DEPTH (4)       // Checkpoints retained for undo

// Git revision injected by build.sh; falls back when built outside a repo.
#ifndef GIT_REV
#define GIT_REV "nogit"
#endif

typedef struct {
    uint8_t quanta;
    uint8_t spin;
    uint16_t heat;
    uint8_t buffer;   // staged in-flight flux — part of node occupancy
    uint8_t tension;  // propagating tension field — claims the alignment pad
} PlanckNode;      // sizeof = 6 (tension fills the byte alignment left free)

PlanckNode* grid_read = NULL;
PlanckNode* grid_write = NULL;
PlanckNode* grid_snapshots[SNAPSHOT_DEPTH] = {NULL};
int snap_head = -1;  // Ring index of the newest checkpoint; -1 when empty
int snap_count = 0;  // Valid checkpoints in the ring
uint8_t pixel_buffer[PIXEL_COUNT * 4];

uint8_t KNOB_DISSIPATION = 15; 
uint16_t KNOB_THERMAL_LIMIT = 1200;
int UNDO_ENABLED = 0;  // Snapshot ring only allocates when the UI opts in
int SEEPAGE_MODE_ACTIVE = 0; // Porous-barrier prototype — off until the UI exposes it
int SPRAY_MODE_ACTIVE = 1;   // Unwind radiation-spray conservation — canonical since v3.0
int TENSION_MODE_ACTIVE = 0; // Tension-field prototype — off; harness-measured accretion/shear

// --- Lattice Topology ---
// Adjacency is a build parameter — the same thermodynamic accounting runs
// on either substrate; what changes is which structures can persist.
// Default is Moore 8-fold (square). -DTOPOLOGY_HEX builds the 6-fold
// odd-r offset variant: 6 edge neighbors, row-parity-dependent diagonals,
// spins 1-6 = E, SE, SW, W, NW, NE at screen angles (spin-1)*60°.
// Triangular-cell 3-fold is the dual description of the same symmetry.
// Mirrors tickHex()/HOFF in engine-sim.mjs — keep the two in sync.
#ifdef TOPOLOGY_HEX
#define SPIN_MAX 6
#define TOPOLOGY_NAME "hex6"
#else
#define SPIN_MAX 8
#define TOPOLOGY_NAME "oct8"
#endif

const uint8_t DIR_MAP[3][3] = { {8, 1, 2}, {7, 0, 3}, {6, 5, 4} };
const uint8_t INV_DIR[9] = {0, 5, 6, 7, 8, 1, 2, 3, 4};
const int SPIN_DX[9] = {0, 0, 1, 1, 1, 0, -1, -1, -1};
const int SPIN_DY[9] = {0, -1, -1, 0, 1, 1, 1, 0, -1};

#ifdef TOPOLOGY_HEX
static const int8_t HEX_OFF[2][7][2] = {
    {{0,0},{1,0},{0,1},{-1,1},{-1,0},{-1,-1},{0,-1}},  // even rows
    {{0,0},{1,0},{1,1},{0,1},{-1,0},{0,-1},{1,-1}}    // odd rows
};
static const uint8_t HEX_INV[7] = {0, 4, 5, 6, 1, 2, 3}; // E↔W, SE↔NW, SW↔NE
// Geometric direction vectors at ×256 fixed point — sin60°=0.8660→222
// (+0.13% error, and momentum is a per-tick local so it cannot drift).
static const int16_t HEX_VX[7] = {0, 256, 128, -128, -256, -128, 128};
static const int16_t HEX_VY[7] = {0, 0, 222, 222, 0, -222, -222};
// Foreign square-vocabulary spins that can still stray in (cross-
// substrate autosaves, stamps sampled on oct8) fold by angle:
// N→NE, NE→NE, E→E, SE→SE, S→SW, SW→SW, W→W, NW→NW.
static const uint8_t SQUARE_TO_HEX[9] = {0, 6, 6, 1, 2, 3, 3, 4, 5};
#endif

// Neighbor visitation order — the 8-fold order reproduces the original
// row-major (dy,dx) sweep; hex is the natural sextant cycle.
static const uint8_t NB_ORDER[8] = {
#ifdef TOPOLOGY_HEX
    1, 2, 3, 4, 5, 6, 0, 0
#else
    8, 1, 2, 7, 3, 6, 5, 4
#endif
};

static inline int nb_dx(int y, int d) {
#ifdef TOPOLOGY_HEX
    return HEX_OFF[y & 1][d][0];
#else
    (void)y; return SPIN_DX[d];
#endif
}
static inline int nb_dy(int y, int d) {
#ifdef TOPOLOGY_HEX
    return HEX_OFF[y & 1][d][1];
#else
    (void)y; return SPIN_DY[d];
#endif
}
static inline uint8_t inv_dir(int d) {
#ifdef TOPOLOGY_HEX
    return HEX_INV[d];
#else
    return INV_DIR[d];
#endif
}
// Turn-friction kernel τ(1−cosΔθ), τ=4, tabulated per substrate —
// math.md §4's least-friction traversal made per-arrival. Index is the
// wrapped spin separation: straight-through is free, reversal costs 2τ.
static const uint8_t KINETIC_TURN[] = {
#ifdef TOPOLOGY_HEX
    0, 2, 6, 8          // 0° 60° 120° 180°
#else
    0, 1, 4, 7, 8       // 0° 45° 90° 135° 180°
#endif
};
static inline int turn_delta(uint8_t a, uint8_t b) {
    int dd = abs((int)a - (int)b);
    return dd > SPIN_MAX / 2 ? SPIN_MAX - dd : dd;
}
// Quadrature bandwidth budget, baked: BWF_LUT[r] = 256·sqrt(1−(r/C_max)²)
// for r = 0..C_max. The ×256 fraction applies via >>8 — the discrete
// substrate has no sqrt; it has a table.
static const uint8_t BWF_LUT[NODE_BANDWIDTH_MAX + 1] = {
    256, 256, 256, 256, 256, 256, 256, 256, 256, 256, 256, 256, 256, 256, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 254, 254, 254, 254, 254, 254, 254, 253, 253, 253, 253, 253, 253, 252, 252, 252,
    252, 252, 251, 251, 251, 251, 250, 250, 250, 250, 249, 249, 249, 248, 248, 248, 248, 247, 247, 247,
    246, 246, 246, 245, 245, 245, 244, 244, 243, 243, 243, 242, 242, 241, 241, 241, 240, 240, 239, 239,
    238, 238, 238, 237, 237, 236, 236, 235, 235, 234, 234, 233, 233, 232, 231, 231, 230, 230, 229, 229,
    228, 227, 227, 226, 226, 225, 224, 224, 223, 222, 222, 221, 220, 220, 219, 218, 218, 217, 216, 215,
    215, 214, 213, 212, 211, 211, 210, 209, 208, 207, 207, 206, 205, 204, 203, 202, 201, 200, 199, 198,
    197, 197, 196, 195, 194, 193, 192, 190, 189, 188, 187, 186, 185, 184, 183, 182, 181, 179, 178, 177,
    176, 174, 173, 172, 171, 169, 168, 167, 165, 164, 162, 161, 160, 158, 157, 155, 154, 152, 150, 149,
    147, 146, 144, 142, 140, 139, 137, 135, 133, 131, 129, 127, 125, 123, 121, 119, 116, 114, 112, 109,
    107, 104, 101, 99, 96, 93, 90, 87, 83, 80, 76, 72, 68, 64, 59, 54, 49, 42, 34, 24,
    0
};
// Integer momentum weights: hex6 at ×256 fixed point, oct8 at unit
// scale (sign-snapped momentum made it exact already). MOM_SHIFT reads
// accumulated momentum back to unit scale; MOM_FUNIT maps weights to
// real scale for float consumers (VTK export).
static inline int dir_vx(int d) {
#ifdef TOPOLOGY_HEX
    return HEX_VX[d];
#else
    return SPIN_DX[d];
#endif
}
static inline int dir_vy(int d) {
#ifdef TOPOLOGY_HEX
    return HEX_VY[d];
#else
    return SPIN_DY[d];
#endif
}
#ifdef TOPOLOGY_HEX
#define MOM_SHIFT (8)
#define MOM_FUNIT (1.0 / 256.0)
#else
#define MOM_SHIFT (0)
#define MOM_FUNIT (1.0)
#endif
// Dominant momentum → spin id. Hex resolves by argmax dot-product — the
// nearest direction vector to the momentum, no angle quantization. Oct8
// sign-snaps through DIR_MAP. Mirrors engine-sim.mjs.
static inline uint8_t dir_from_momentum(int32_t mx, int32_t my) {
#ifdef TOPOLOGY_HEX
    if (mx == 0 && my == 0) return 0;
    int best_d = 1;
    int32_t best_dot = INT32_MIN;
    for (int d = 1; d <= SPIN_MAX; d++) {
        int32_t dot = mx * dir_vx(d) + my * dir_vy(d);
        if (dot > best_dot) { best_dot = dot; best_d = d; }
    }
    return (uint8_t)best_d;
#else
    int xd = (mx > 0) - (mx < 0);
    int yd = (my > 0) - (my < 0);
    return DIR_MAP[yd + 1][xd + 1];
#endif
}
// Writes arrive in the ACTIVE vocabulary — scenario paints, palette
// stamps, autosave restores are all native to the running substrate.
// Folding hex spins 1-6 through the square map scrambles them (E→NE,
// W→SE, NE→SW), which severed the filament at paint time. Only spins
// outside the vocabulary (cross-substrate strays: 7=W→4, 8=NW→5) fold.
static inline uint8_t norm_spin(uint8_t s) {
#ifdef TOPOLOGY_HEX
    if (s <= SPIN_MAX) return s;
    return (s <= 8) ? SQUARE_TO_HEX[s] : 0;
#else
    return (s <= 8) ? s : 0;
#endif
}
static inline int valid_spin(uint8_t s) { return s >= 1 && s <= SPIN_MAX; }

// Telemetry
double obs_total_quanta = 0;     // resident quanta only
double obs_total_buffer = 0;     // staged in-flight flux
double obs_total_heat = 0;
double obs_phase_alignment = 0;
double obs_actualization_yield = 0;

EMSCRIPTEN_KEEPALIVE double get_total_quanta() { return obs_total_quanta; }
// Occupancy is the conserved mass reading: resident + staged in-flight.
EMSCRIPTEN_KEEPALIVE double get_total_occupancy() { return obs_total_quanta + obs_total_buffer; }
EMSCRIPTEN_KEEPALIVE double get_total_heat() { return obs_total_heat; }
EMSCRIPTEN_KEEPALIVE double get_phase_alignment() { return obs_phase_alignment; }
EMSCRIPTEN_KEEPALIVE double get_yield() { return obs_actualization_yield; }

// Build provenance: compile date + the git revision build.sh injected.
EMSCRIPTEN_KEEPALIVE
const char* get_engine_build() {
    static char build_str[80];
    snprintf(build_str, sizeof(build_str), "%s · %s · %s", __DATE__, GIT_REV, TOPOLOGY_NAME);
    return build_str;
}
EMSCRIPTEN_KEEPALIVE int get_grid_width() { return WIDTH; }
EMSCRIPTEN_KEEPALIVE int get_grid_height() { return HEIGHT; }
EMSCRIPTEN_KEEPALIVE uint8_t* get_pixel_buffer_pointer() { return pixel_buffer; }

EMSCRIPTEN_KEEPALIVE void set_dissipation(int rate) { KNOB_DISSIPATION = (uint8_t)rate; }
EMSCRIPTEN_KEEPALIVE void set_thermal_limit(int limit) { KNOB_THERMAL_LIMIT = (uint16_t)limit; }
EMSCRIPTEN_KEEPALIVE void set_seepage_mode(int active) { SEEPAGE_MODE_ACTIVE = active ? 1 : 0; }
EMSCRIPTEN_KEEPALIVE void set_spray_mode(int active) { SPRAY_MODE_ACTIVE = active ? 1 : 0; }
EMSCRIPTEN_KEEPALIVE void set_tension_mode(int active) { TENSION_MODE_ACTIVE = active ? 1 : 0; }

EMSCRIPTEN_KEEPALIVE
void init_grid() {
    if (grid_read != NULL) { free(grid_read); grid_read = NULL; }
    if (grid_write != NULL) { free(grid_write); grid_write = NULL; }
    for (int i = 0; i < SNAPSHOT_DEPTH; i++) {
        if (grid_snapshots[i] != NULL) { free(grid_snapshots[i]); grid_snapshots[i] = NULL; }
    }
    snap_head = -1;
    snap_count = 0;

    grid_read = calloc(PIXEL_COUNT, sizeof(PlanckNode));
    grid_write = calloc(PIXEL_COUNT, sizeof(PlanckNode));
    if (UNDO_ENABLED) {
        for (int i = 0; i < SNAPSHOT_DEPTH; i++) {
            grid_snapshots[i] = calloc(PIXEL_COUNT, sizeof(PlanckNode));
        }
    }
    obs_actualization_yield = 0;
}

EMSCRIPTEN_KEEPALIVE
void free_grid() {
    if (grid_read != NULL) { free(grid_read); grid_read = NULL; }
    if (grid_write != NULL) { free(grid_write); grid_write = NULL; }
    for (int i = 0; i < SNAPSHOT_DEPTH; i++) {
        if (grid_snapshots[i] != NULL) { free(grid_snapshots[i]); grid_snapshots[i] = NULL; }
    }
    snap_head = -1;
    snap_count = 0;
}

// Undo ring: save pushes the current state as the newest checkpoint,
// restore pops it so the next undo reaches deeper. The engine tracks
// snap_count itself so a JS-side counter bug can never restore garbage.
EMSCRIPTEN_KEEPALIVE
void save_grid_snapshot() {
    if (!grid_read || !grid_snapshots[0]) return;
    snap_head = (snap_head + 1) % SNAPSHOT_DEPTH;
    memcpy(grid_snapshots[snap_head], grid_read, PIXEL_COUNT * sizeof(PlanckNode));
    if (snap_count < SNAPSHOT_DEPTH) snap_count++;
}

EMSCRIPTEN_KEEPALIVE
void restore_grid_snapshot() {
    if (!grid_read || snap_count <= 0 || snap_head < 0) return;
    memcpy(grid_read, grid_snapshots[snap_head], PIXEL_COUNT * sizeof(PlanckNode));
    snap_head = (snap_head - 1 + SNAPSHOT_DEPTH) % SNAPSHOT_DEPTH;
    snap_count--;
    // Node state includes staged flux, so a rewind restores the
    // radiation field with the matter — physically complete.
}

EMSCRIPTEN_KEEPALIVE int get_snapshot_count() { return snap_count; }

// The undo ring costs SNAPSHOT_DEPTH × 640KB and a memcpy per checkpoint —
// too expensive to carry unconditionally on mobile. The buffers only exist
// while the UI opts in; save/restore safely no-op when they don't.
EMSCRIPTEN_KEEPALIVE
void set_undo_enabled(int enabled) {
    UNDO_ENABLED = enabled ? 1 : 0;
    if (UNDO_ENABLED) {
        for (int i = 0; i < SNAPSHOT_DEPTH; i++) {
            if (!grid_snapshots[i]) grid_snapshots[i] = calloc(PIXEL_COUNT, sizeof(PlanckNode));
        }
    } else {
        snap_head = -1;
        snap_count = 0;
        for (int i = 0; i < SNAPSHOT_DEPTH; i++) {
            if (grid_snapshots[i]) { free(grid_snapshots[i]); grid_snapshots[i] = NULL; }
        }
    }
}
EMSCRIPTEN_KEEPALIVE uint8_t* get_grid_pointer() { return (uint8_t*)grid_read; }

EMSCRIPTEN_KEEPALIVE
void clear_grid() {
    if (!grid_read) return;
    for (int i = 0; i < PIXEL_COUNT; i++) {
        grid_read[i].quanta = 0; grid_read[i].spin = 0; grid_read[i].heat = 1; grid_read[i].buffer = 0; grid_read[i].tension = 0;
    }
    obs_actualization_yield = 0;
}


// ---------------------------------------------------------
// INJECTION & REFRACTIVE IMPEDANCE
// ---------------------------------------------------------
EMSCRIPTEN_KEEPALIVE
int get_node_state(int x, int y) {
    if (!grid_read || x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return 0;
    PlanckNode n = grid_read[y * WIDTH + x];
    return (n.quanta << 24) | (n.spin << 16) | n.heat;
}

EMSCRIPTEN_KEEPALIVE
void set_node_state(int x, int y, int state) {
    if (!grid_read || x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
    int idx = y * WIDTH + x;
    grid_read[idx].quanta = (state >> 24) & 0xFF;
    grid_read[idx].spin = norm_spin((state >> 16) & 0xFF);
    grid_read[idx].heat = state & 0xFFFF;
    // Paints overwrite node state outright; staged flux at the node goes too.
    grid_read[idx].buffer = 0;
}

// Injection is biological interference obeying the field's own rules:
// dense matter thermalizes the dose (acoustic backscatter), overflow
// stages into the input buffer rather than clipping, and injected mass
// entrains to the ambient phase instead of landing with random spin.
EMSCRIPTEN_KEEPALIVE void add_quanta(int x, int y, int amount) {
    if (!grid_read || x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || amount <= 0) return;
    int idx = y * WIDTH + x;
    PlanckNode* target = &grid_read[idx];

    // Acoustic Backscatter: a dense node converts the injection to heat.
    if (target->quanta > IMPEDANCE_DENSITY) {
        int backscatter_heat = amount * (KNOB_THERMAL_LIMIT / BACKSCATTER_DIV);
        target->heat = (target->heat + backscatter_heat > HEAT_MAX) ? HEAT_MAX : target->heat + backscatter_heat;
        return;
    }

    int q = target->quanta + amount;
    if (q > 255) {
        // No silent clip: excess stages in the input buffer, and buffer
        // overflow thermalizes — same accounting as in-flight arrivals.
        int excess_buffer = target->buffer + (q - 255);
        if (excess_buffer > 255) {
            int blowoff = (excess_buffer - 255) * KINETIC_BACKPRESSURE;
            target->heat = (target->heat + blowoff > HEAT_MAX) ? HEAT_MAX : target->heat + blowoff;
            excess_buffer = 255;
        }
        target->buffer = (uint8_t)excess_buffer;
        target->quanta = 255;
    } else {
        target->quanta = (uint8_t)q;
    }

    // Environment-Normalized Thermal Scaling
    double thermal_scale = (double)KNOB_THERMAL_LIMIT / THERMAL_NORM;
    int dynamic_heat_add = (int)((amount * QUANTA_INJECT_HEAT) / (KNOB_DISSIPATION * DISSIPATION_SCALE + 1.0) * thermal_scale);
    int h = target->heat + dynamic_heat_add;
    target->heat = (h > HEAT_MAX) ? HEAT_MAX : h;

    // Refractive Momentum Inheritance
    int32_t sum_dx = 0, sum_dy = 0;
    int neighbor_count = 0;

    for (int k = 0; k < SPIN_MAX; k++) {
        int d = NB_ORDER[k];
        int nx = (x + nb_dx(y, d) + WIDTH) % WIDTH;
        int ny = (y + nb_dy(y, d) + HEIGHT) % HEIGHT;
        PlanckNode n = grid_read[ny * WIDTH + nx];
        if (valid_spin(n.spin)) {
            sum_dx += dir_vx(n.spin);
            sum_dy += dir_vy(n.spin);
            neighbor_count++;
        }
    }

    if (neighbor_count > 0 && (sum_dx != 0 || sum_dy != 0)) {
        target->spin = dir_from_momentum(sum_dx, sum_dy);
        if (target->spin == 0) target->spin = (rand() % SPIN_MAX) + 1;
    } else {
        target->spin = (rand() % SPIN_MAX) + 1;
    }
}

EMSCRIPTEN_KEEPALIVE void add_heat(int x, int y, int amount) {
    if (!grid_read || x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || amount <= 0) return;
    int idx = y * WIDTH + x;
    int h = grid_read[idx].heat + amount;
    grid_read[idx].heat = (h > HEAT_MAX) ? HEAT_MAX : h;
}

EMSCRIPTEN_KEEPALIVE void set_spin(int x, int y, int dir) {
    if (!grid_read || x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || dir < 1 || dir > SPIN_MAX) return;
    grid_read[y * WIDTH + x].spin = dir;
}


// ---------------------------------------------------------
// PHYSICS ENGINE (v2.3: Occupancy Gravity, Port Repulsion & Quadrature Budget)
// ---------------------------------------------------------
EMSCRIPTEN_KEEPALIVE
void tick() {
    if (!grid_read || !grid_write) return;

    double frame_quanta = 0;
    double frame_buffer = 0;
    double frame_heat = 0;
    double frame_yield = 0;
    int active_nodes = 0;
    int aligned_nodes = 0;

    for (int y = 0; y < HEIGHT; y++) {
        for (int x = 0; x < WIDTH; x++) {
            int idx = y * WIDTH + x;
            PlanckNode current = grid_read[idx];
            // Foreign spins (cross-topology state, oversized stamps) fold
            // into the active vocabulary before they index a table.
            if (current.spin > SPIN_MAX) current.spin = norm_spin(current.spin);

            int target_deadlocked = 0;
            if (current.spin != 0) {
                int target_x = (x + nb_dx(y, current.spin) + WIDTH) % WIDTH;
                int target_y = (y + nb_dy(y, current.spin) + HEIGHT) % HEIGHT;
                int t_idx = target_y * WIDTH + target_x;
                // The port refuses on occupancy (resident + in-flight),
                // not resident mass alone — a pressurized buffer is a wall.
                int t_occ = grid_read[t_idx].quanta + grid_read[t_idx].buffer;
                if (t_occ > DEADLOCK_QUANTA) target_deadlocked = 1;
            }

            int heat_sum = 0;
            int kinetic_heat = 0;
            int max_congestion = 0;
            uint8_t gravity_spin = current.spin;
            int incoming_quanta = 0;
            int32_t mom_x = 0;   // fixed-point momentum — a per-tick local,
            int32_t mom_y = 0;   // discrete state, not a real coordinate

            int has_domain_match = 0;
            int tension_sum = 0;   // neighbors' diffusion shares
            int g_grad_max = 0;    // steepest up-gradient step
            int g_grad_idx = -1;   // ...into this neighbor (must carry flux)

            for (int k = 0; k < SPIN_MAX; k++) {
                int d = NB_ORDER[k];
                int nx = (x + nb_dx(y, d) + WIDTH) % WIDTH;
                int ny = (y + nb_dy(y, d) + HEIGHT) % HEIGHT;
                PlanckNode neighbor = grid_read[ny * WIDTH + nx];
                uint8_t req_spin = inv_dir(d);

                heat_sum += neighbor.heat / HEAT_DIFFUSION_DIV;

                if (TENSION_MODE_ACTIVE) {
                    tension_sum += neighbor.tension >> TENSION_SHARE;
                    // Shear target: up-gradient and flowing — pushed mass
                    // must have somewhere to go, spinless cells stall it.
                    int gd = (int)neighbor.tension - (int)current.tension;
                    if (gd > g_grad_max && neighbor.spin != 0) {
                        g_grad_max = gd; g_grad_idx = ny * WIDTH + nx;
                    }
                }

                if (neighbor.quanta > 0 && neighbor.spin == req_spin) {
                    // The sender only relays up to FLOW_CAP; the rest stays put.
                    int sent = (neighbor.quanta > FLOW_CAP) ? FLOW_CAP : neighbor.quanta;
                    kinetic_heat += (sent * KINETIC_BASE);

                    if (current.quanta > 0 && current.spin != 0) {
                        // Phase friction is continuous in the turn angle —
                        // aligned inflow is free, reversal is priced at 2τ.
                        kinetic_heat += sent * KINETIC_TURN[turn_delta(neighbor.spin, current.spin)];
                    }

                    int my_occ = current.quanta + current.buffer;
                    if (my_occ <= DEADLOCK_QUANTA) {
                        incoming_quanta += sent;
                        mom_x -= dir_vx(d) * sent;
                        mom_y -= dir_vy(d) * sent;
                    } else if (SEEPAGE_MODE_ACTIVE) {
                        // Porous barrier: a fixed fraction bleeds through
                        // the saturated port; part thermalizes mid-hop —
                        // attenuation requires loss, not just delay.
                        int leak = sent >> SEEP_SHIFT;
                        if (leak < 1) leak = 1;
                        int absorbed = leak >> SEEP_ABS_SHIFT;
                        incoming_quanta += leak - absorbed;
                        kinetic_heat += absorbed;
                        mom_x -= dir_vx(d) * (leak - absorbed);
                        mom_y -= dir_vy(d) * (leak - absorbed);
                    }
                }

                // Congestion gravity sink: flux deflects toward the densest
                // neighbor that can still absorb (occupancy > 200 is a hard
                // wall — bending into deadlock means hitting it, not accreting).
                int n_occ = neighbor.quanta + neighbor.buffer;
                if (n_occ > max_congestion && n_occ <= DEADLOCK_QUANTA) {
                    max_congestion = n_occ;
                    gravity_spin = d;
                }

                if (current.quanta > 0 && neighbor.quanta > 0 && neighbor.spin == current.spin) {
                    has_domain_match = 1;
                }
            }

            int next_quanta = current.quanta;
            int shunting = 0;
            
            if (current.quanta > 0 && current.spin != 0) {
                if (!target_deadlocked) {
                    int sent = (current.quanta > FLOW_CAP) ? FLOW_CAP : current.quanta;
                    next_quanta = current.quanta - sent;  // transport lag: residual accumulates
                } else {
                    if (SEEPAGE_MODE_ACTIVE) {
                        // Release the seeped fraction — the receiver
                        // accepts it, so the sender must deduct it or
                        // mass duplicates across the port.
                        int sent = (current.quanta > FLOW_CAP) ? FLOW_CAP : current.quanta;
                        int leak = sent >> SEEP_SHIFT;
                        if (leak < 1) leak = 1;
                        next_quanta = current.quanta - leak;
                    }
                    shunting = 1;
                    kinetic_heat += (current.quanta * KINETIC_SHUNT);
                }
            }
            // Tension shear: a share of arriving flux is deflected mid-hop
            // into the up-gradient flowing neighbor's buffer. Mass conserves;
            // headings are untouched — this is refraction/accretion, not
            // spin-capture. (grid_read mutation mid-sweep mirrors spray.)
            if (TENSION_MODE_ACTIVE && g_grad_idx >= 0 && incoming_quanta > 0) {
                int room = 255 - grid_read[g_grad_idx].buffer;
                int push = incoming_quanta >> TENSION_DIVERT;
                if (push > room) push = room;
                incoming_quanta -= push;
                grid_read[g_grad_idx].buffer += push;
            }
            // I/O buffer: arrivals stage in the buffer field and integrate
            // only up to free capacity — overflow is backscatter heat, not
            // silent mass loss. Buffered backlog also occupies the node's
            // routing bandwidth (congestion literally dilates dissipation).
            int next_buffer = current.buffer + incoming_quanta;
            if (next_buffer > 255) {
                kinetic_heat += (next_buffer - 255) * KINETIC_BACKPRESSURE;
                next_buffer = 255;
            }
            if (SEEPAGE_MODE_ACTIVE && current.quanta + current.buffer > DEADLOCK_QUANTA) {
                // Absorptive barrier medium: a deadlocked node thermalizes
                // a fraction of its staged flux per tick — in-transit mass
                // decays with dwell time, so attenuation compounds with
                // wall thickness (the measured tunneling constraint).
                int burn = next_buffer >> SEEP_BURN_SHIFT;
                next_buffer -= burn;
                kinetic_heat += burn;
            }
            int buffered_take = (255 - next_quanta < next_buffer) ? 255 - next_quanta : next_buffer;
            next_quanta += buffered_take;
            next_buffer -= buffered_take;
            if (SPRAY_MODE_ACTIVE && next_buffer > 0) {
                // Radiation has a finite lifetime: only potential that
                // failed to resolve decoheres into ambient heat. In-transit
                // flux actualizes and pays nothing; a standing bath drains.
                int bleed = next_buffer >> BUFDECAY_SHIFT;
                next_buffer -= bleed;
                kinetic_heat += bleed;
            }

            uint8_t dominant_spin = dir_from_momentum(mom_x, mom_y);

            // --- Bandwidth Limit & Cycle-Stealing (Time Dilation) ---
            // Spatial I/O routing load takes absolute priority over internal
            // maintenance. The budget is quadrature (math.md §3):
            // C_max² = C_s² + C_i² → available fraction is sqrt(1 - load²).
            int routing_load = incoming_quanta
                                + ((abs(mom_x) + abs(mom_y)) >> MOM_SHIFT)
                                + (shunting ? current.quanta : 0)
                                + current.buffer;
            if (routing_load > NODE_BANDWIDTH_MAX) routing_load = NODE_BANDWIDTH_MAX;

            // Each adjacency channel carries h/9 — a substrate-invariant
            // rate. The node retains whatever its coordination number
            // cannot send: 1/9 on oct8, 3/9 on hex6 (sparser channels,
            // less dissipation — a true topological consequence).
            int kept_heat = current.heat - SPIN_MAX * (current.heat / HEAT_DIFFUSION_DIV);
            int next_heat = kept_heat + heat_sum + kinetic_heat;

            next_heat += (next_quanta * QUANTA_HEAT_GEN);

            // Topological Unwinding
            if (next_heat > KNOB_THERMAL_LIMIT && next_quanta > 0) {
                if (SPRAY_MODE_ACTIVE) {
                    // Unwinding = E=mc²: the knot's mass unspools as
                    // un-actualized radiation — sprayed into neighbor
                    // buffers, not deleted. Conservation makes a thermal
                    // detonation contagious, which is the honest physics.
                    int share = (next_quanta + next_buffer) / SPIN_MAX;
                    for (int k = 0; k < SPIN_MAX; k++) {
                        int d = NB_ORDER[k];
                        int nx = (x + nb_dx(y, d) + WIDTH) % WIDTH;
                        int ny = (y + nb_dy(y, d) + HEIGHT) % HEIGHT;
                        PlanckNode* n = &grid_read[ny * WIDTH + nx];
                        int room = 255 - n->buffer;
                        int add = (share < room) ? share : room;
                        n->buffer = (uint8_t)(n->buffer + add);
                    }
                }
                next_heat = HEAT_MAX;
                next_quanta = 0;
                next_buffer = 0;   // staged flux unspools with the knot
                dominant_spin = 0;
                shunting = 1;
                frame_yield += 1.0;
            } else {
                int temp_scalar = next_heat / TEMP_SCALAR_DIV;
                // High routing load starves internal dissipation (time dilation lag)
                int heat_loss = (int)(((int64_t)(1 + temp_scalar * temp_scalar) * KNOB_DISSIPATION * BWF_LUT[routing_load]) >> 8);
                next_heat -= heat_loss;

                if (next_heat < HEAT_FLOOR) next_heat = 1 + (rand() % 3);
            }

            // Tension field bookkeeping: keep what the channels don't
            // send, gain neighbors' shares, source from own occupancy,
            // decohere. The field lives in the pad byte — no layout cost.
            int next_tension = current.tension;
            if (TENSION_MODE_ACTIVE) {
                int occ = current.quanta + current.buffer;
                next_tension = current.tension
                    - SPIN_MAX * (current.tension >> TENSION_SHARE)
                    + tension_sum
                    - (current.tension >> TENSION_DECAY)
                    + (occ > TENSION_EMIT_MIN ? occ >> TENSION_EMIT_SHIFT : 0);
                if (next_tension < 0) next_tension = 0;
                if (next_tension > 255) next_tension = 255;
            }

            // Phase is structural state: with no incoming momentum the
            // lattice holds its established spin rather than erasing to 0.
            // Flux rewrites phase; silence never does.
            uint8_t next_spin = (dominant_spin != 0) ? dominant_spin : current.spin; 
            if (shunting) {
                // Relational repulsion: a saturated port bounces the flux
                // straight back — deadlock walls are mirrors, not dead
                // ends (Pauli exclusion as a routing consequence).
                next_spin = inv_dir(current.spin);
            } else if (max_congestion > FLOW_CAP && next_quanta > 0) {
                // Routing-impedance gravity: a neighbor jammed above the flow
                // cap refracts flux toward the densest node that can still
                // absorb — accretion emerges from congestion, not heat-chasing.
                next_spin = gravity_spin;
            } else if (current.spin != 0) {
                // Phase Lock (Topological Waveguide)
                if (dominant_spin == 0) {
                    if (current.quanta == 0) {
                        next_spin = current.spin;
                    } else {
                        next_spin = 0;
                    }
                } else {
                    int diff = abs((int)current.spin - (int)dominant_spin);
                    if (diff <= 1 || diff == SPIN_MAX - 1) {
                        next_spin = current.spin;
                    } else {
                        next_spin = dominant_spin;
                    }
                }
            } else {
                next_spin = dominant_spin;
            }
            
            grid_write[idx].quanta = next_quanta;
            grid_write[idx].heat = next_heat;
            grid_write[idx].spin = next_spin;
            grid_write[idx].buffer = (uint8_t)next_buffer;
            grid_write[idx].tension = (uint8_t)next_tension;
            
            frame_quanta += next_quanta;
            frame_buffer += next_buffer;
            frame_heat += next_heat;
            
            if (next_quanta > 0) {
                active_nodes++;
                if (has_domain_match) aligned_nodes++;
            }
        }
    }

    obs_total_quanta = frame_quanta;
    obs_total_buffer = frame_buffer;
    obs_total_heat = frame_heat;
    obs_actualization_yield += frame_yield;
    obs_phase_alignment = (active_nodes > 0) ? ((double)aligned_nodes / active_nodes) * 100.0 : 0.0;

    PlanckNode* temp = grid_read;
    grid_read = grid_write;
    grid_write = temp;
}

EMSCRIPTEN_KEEPALIVE
void render_frame(int layer) {
    if (!grid_read) return;

    for (int i = 0; i < PIXEL_COUNT; i++) {
        int px_idx = i * 4;
        int next_quanta = grid_read[i].quanta;
        int next_heat = grid_read[i].heat;
        uint8_t s = grid_read[i].spin;

        if (layer == 0) { 
            // Macro
            if (next_quanta > 150) { 
                pixel_buffer[px_idx + 0] = 0; pixel_buffer[px_idx + 1] = 255; pixel_buffer[px_idx + 2] = 255;
            } else {
                uint8_t c = (next_quanta > 0) ? 255 : 0;
                pixel_buffer[px_idx + 0] = c; pixel_buffer[px_idx + 1] = c; pixel_buffer[px_idx + 2] = c;
            }
        } else if (layer == 1) { 
            // Metabolic
            uint8_t r = 0, g = 0, b = 0;
            if (next_heat < 100) { r = next_heat; b = (next_heat * 2 > 255) ? 255 : next_heat * 2; }
            else if (next_heat < 400) { r = (next_heat > 255) ? 255 : next_heat; g = (next_heat - 100) / 2; }
            else { r = 255; g = 150 + (next_heat - 400) / 4; if (g > 255) g = 255; b = (next_heat - 400) / 2; if (b > 255) b = 255; }
            pixel_buffer[px_idx + 0] = r; pixel_buffer[px_idx + 1] = g; pixel_buffer[px_idx + 2] = b;
        } else if (layer == 2) {
            // Phase / Ising
            if (s == 0 || next_quanta == 0) {
                pixel_buffer[px_idx + 0] = 10; pixel_buffer[px_idx + 1] = 10; pixel_buffer[px_idx + 2] = 10;
            } else {
                pixel_buffer[px_idx + 0] = (s & 1) ? 255 : 50; 
                pixel_buffer[px_idx + 1] = (s & 2) ? 255 : 50; 
                pixel_buffer[px_idx + 2] = (s & 4) ? 255 : 50;
            }
        } else if (layer == 3) {
            // Entropic
            if (next_quanta > 0) {
                pixel_buffer[px_idx + 0] = (next_heat > 255) ? 255 : next_heat; 
                pixel_buffer[px_idx + 1] = 0; 
                pixel_buffer[px_idx + 2] = (next_quanta > 200) ? 255 : 100; 
            } else {
                // Entropic tension on empty nodes — staged in-flight flux
                // glows faintly (radiation is visible).
                int tension_v = next_heat + grid_read[i].buffer / 2;
                uint8_t tension = (tension_v > 100) ? 100 : tension_v;
                pixel_buffer[px_idx + 0] = tension;
                pixel_buffer[px_idx + 1] = 0;
                pixel_buffer[px_idx + 2] = tension;
            }
        }
        pixel_buffer[px_idx + 3] = 255;
    }
}

// ---------------------------------------------------------
// VTK PARAVIEW EXPORTER
// ---------------------------------------------------------
char* vtk_buffer = NULL;
size_t vtk_buffer_capacity = 0;

size_t get_required_vtk_buffer_size() {
    size_t header_size = 512;
    size_t quanta_size = (size_t)PIXEL_COUNT * 16;
    size_t buffer_size = (size_t)PIXEL_COUNT * 16;
    size_t heat_size = (size_t)PIXEL_COUNT * 16;
    size_t vector_size = (size_t)PIXEL_COUNT * 32;
    return header_size + quanta_size + buffer_size + heat_size + vector_size;
}

EMSCRIPTEN_KEEPALIVE
char* generate_vtk() {
    if (!grid_read) return NULL;

    size_t required_size = get_required_vtk_buffer_size();

    if (vtk_buffer == NULL || vtk_buffer_capacity < required_size) {
        char* new_buffer = (char*)realloc(vtk_buffer, required_size);
        if (new_buffer == NULL) {
            return NULL; 
        }
        vtk_buffer = new_buffer;
        vtk_buffer_capacity = required_size;
    }

    char* ptr = vtk_buffer;
    size_t remaining = vtk_buffer_capacity;
    int written = 0;

    #define SAFE_PRINTF(...) \
        written = snprintf(ptr, remaining, __VA_ARGS__); \
        if (written < 0 || (size_t)written >= remaining) { \
            return NULL; \
        } \
        ptr += written; \
        remaining -= written;

    SAFE_PRINTF("# vtk DataFile Version 3.0\n");
    SAFE_PRINTF("Planck Field Engine Frame\n");
    SAFE_PRINTF("ASCII\n");
    SAFE_PRINTF("DATASET STRUCTURED_POINTS\n");
    SAFE_PRINTF("DIMENSIONS %d %d 1\n", WIDTH, HEIGHT);
    SAFE_PRINTF("ORIGIN 0 0 0\n");
    SAFE_PRINTF("SPACING 1 1 1\n");
    SAFE_PRINTF("POINT_DATA %d\n", PIXEL_COUNT);

    SAFE_PRINTF("\nSCALARS Quanta float 1\n");
    SAFE_PRINTF("LOOKUP_TABLE default\n");
    for (int i = 0; i < PIXEL_COUNT; i++) {
        SAFE_PRINTF("%d\n", grid_read[i].quanta);
    }

    SAFE_PRINTF("\nSCALARS Buffer float 1\n");
    SAFE_PRINTF("LOOKUP_TABLE default\n");
    for (int i = 0; i < PIXEL_COUNT; i++) {
        SAFE_PRINTF("%d\n", grid_read[i].buffer);
    }

    SAFE_PRINTF("\nSCALARS Heat float 1\n");
    SAFE_PRINTF("LOOKUP_TABLE default\n");
    for (int i = 0; i < PIXEL_COUNT; i++) {
        SAFE_PRINTF("%d\n", grid_read[i].heat);
    }

    SAFE_PRINTF("\nVECTORS Spin float\n");
    for (int i = 0; i < PIXEL_COUNT; i++) {
        uint8_t s = grid_read[i].spin;
        double dx = valid_spin(s) ? dir_vx(s) * MOM_FUNIT : 0.0;
        double dy = valid_spin(s) ? dir_vy(s) * MOM_FUNIT : 0.0;
        SAFE_PRINTF("%.3f %.3f 0.0\n", dx, dy);
    }

    #undef SAFE_PRINTF
    return vtk_buffer;
}

EMSCRIPTEN_KEEPALIVE
void free_vtk() {
    if (vtk_buffer != NULL) {
        free(vtk_buffer);
        vtk_buffer = NULL;
        vtk_buffer_capacity = 0;
    }
}
