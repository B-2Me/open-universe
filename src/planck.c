#include <stdint.h>
#include <stdlib.h>
#include <emscripten.h>

#define BUILD_VERSION 107 
#define WIDTH 400
#define HEIGHT 400
#define PIXEL_COUNT (WIDTH * HEIGHT)

// The Quantum Lattice Node
typedef struct {
    uint8_t quanta;  // Discrete energy packets (0-255)
    uint8_t spin;    // Trajectory: 0=Idle, 1=N, 2=NE, 3=E, 4=SE, 5=S, 6=SW, 7=W, 8=NW
    uint16_t heat;   // Local relational friction / energy
} PlanckNode;

PlanckNode* grid_read;
PlanckNode* grid_write;
uint8_t pixel_buffer[PIXEL_COUNT * 4];

// Physical Constants 
uint8_t KNOB_DISSIPATION = 15; // >0 acts as Z-axis vacuum bleed. 0 = perfectly closed universe.
uint16_t KNOB_THERMAL_LIMIT = 1200;
uint8_t RENDER_LAYER = 0; 

// Vector Mapping for Absolute Causality and Collision Math
const uint8_t DIR_MAP[3][3] = {
    {8, 1, 2},
    {7, 0, 3},
    {6, 5, 4}
};
const uint8_t INV_DIR[9] = {0, 5, 6, 7, 8, 1, 2, 3, 4};

// ---------------------------------------------------------
// Engine Diagnostics & Environment Setters
// ---------------------------------------------------------

EMSCRIPTEN_KEEPALIVE int get_engine_version() { return BUILD_VERSION; }
EMSCRIPTEN_KEEPALIVE int get_grid_width() { return WIDTH; }
EMSCRIPTEN_KEEPALIVE int get_grid_height() { return HEIGHT; }
EMSCRIPTEN_KEEPALIVE uint8_t* get_pixel_buffer_pointer() { return pixel_buffer; }

EMSCRIPTEN_KEEPALIVE void set_dissipation(int rate) { KNOB_DISSIPATION = (uint8_t)rate; }
EMSCRIPTEN_KEEPALIVE void set_thermal_limit(int limit) { KNOB_THERMAL_LIMIT = (uint16_t)limit; }
EMSCRIPTEN_KEEPALIVE void set_render_layer(int layer) { RENDER_LAYER = (uint8_t)layer; }

// ---------------------------------------------------------
// Grid Initialization & Global Interventions
// ---------------------------------------------------------

EMSCRIPTEN_KEEPALIVE
void init_grid() {
    grid_read = calloc(PIXEL_COUNT, sizeof(PlanckNode));
    grid_write = calloc(PIXEL_COUNT, sizeof(PlanckNode));
}

EMSCRIPTEN_KEEPALIVE
void clear_grid() {
    for (int i = 0; i < PIXEL_COUNT; i++) {
        grid_read[i].quanta = 0; grid_read[i].spin = 0; grid_read[i].heat = 0;
        pixel_buffer[i*4+0] = 0; pixel_buffer[i*4+1] = 0; pixel_buffer[i*4+2] = 0; pixel_buffer[i*4+3] = 255;
    }
}

EMSCRIPTEN_KEEPALIVE
void randomize_grid() {
    for (int i = 0; i < PIXEL_COUNT; i++) {
        grid_read[i].quanta = (rand() % 100 < 5) ? 1 : 0;
        grid_read[i].spin = grid_read[i].quanta ? ((rand() % 8) + 1) : 0;
        grid_read[i].heat = grid_read[i].quanta * 100;
    }
}

// ---------------------------------------------------------
// Surgical API: The JS/Wasm Dimensional Injection
// ---------------------------------------------------------

// Resolves the UI paste by safely adding to the closed energy budget
EMSCRIPTEN_KEEPALIVE
void set_node(int x, int y, int injected_quanta) {
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || injected_quanta <= 0) return;
    int idx = y * WIDTH + x;
    
    int new_quanta = grid_read[idx].quanta + injected_quanta;
    grid_read[idx].quanta = (new_quanta > 255) ? 255 : new_quanta; 
    
    // Injecting mass requires injecting the baseline thermodynamic energy to support it
    grid_read[idx].heat += injected_quanta * 25; 
    grid_read[idx].spin = (rand() % 8) + 1;
}

EMSCRIPTEN_KEEPALIVE
int get_node(int x, int y) {
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return 0;
    return grid_read[y * WIDTH + x].quanta;
}

// ---------------------------------------------------------
// The Planck Field Physics Engine
// ---------------------------------------------------------

EMSCRIPTEN_KEEPALIVE
void tick() {
    for (int y = 0; y < HEIGHT; y++) {
        for (int x = 0; x < WIDTH; x++) {
            int idx = y * WIDTH + x;
            PlanckNode current = grid_read[idx];
            
            // 1. Setup Local Trackers
            int heat_sum = 0;
            int max_heat = -1;
            uint8_t gravity_spin = current.spin;
            uint8_t nuclear_spin = 0;
            
            int incoming_quanta = 0;
            int mom_x = 0; // Momentum vectors
            int mom_y = 0;

            // 2. Scan Local Neighborhood
            for (int dy = -1; dy <= 1; dy++) {
                for (int dx = -1; dx <= 1; dx++) {
                    if (dx == 0 && dy == 0) continue;
                    
                    int nx = (x + dx + WIDTH) % WIDTH;
                    int ny = (y + dy + HEIGHT) % HEIGHT;
                    PlanckNode neighbor = grid_read[ny * WIDTH + nx];

                    uint8_t n_dir = DIR_MAP[dy+1][dx+1];
                    uint8_t req_spin = INV_DIR[n_dir];

                    // Perfect Integer Diffusion: Receive exactly 1/9th of neighbor's heat
                    heat_sum += neighbor.heat / 9;

                    // Relational Mass Transfer
                    if (neighbor.quanta > 0 && neighbor.spin == req_spin) {
                        incoming_quanta++;
                        // If moving from (dx, dy) to (0,0), its vector is -dx, -dy
                        mom_x -= dx; 
                        mom_y -= dy;
                    }

                    // Gravity: Find densest local distortion
                    if (neighbor.heat > max_heat) {
                        max_heat = neighbor.heat;
                        gravity_spin = n_dir;
                    }
                    
                    // Strong Nuclear Force: Close-range confinement
                    if (neighbor.quanta > 150) {
                        nuclear_spin = (n_dir + 2 > 8) ? (n_dir + 2 - 8) : (n_dir + 2);
                    }
                }
            }

            // 3. Process Mass (Quanta)
            int next_quanta = current.quanta;
            if (current.quanta > 0 && current.spin != 0) {
                next_quanta--; // Exiting quantum
            }
            next_quanta += incoming_quanta; 
            if (next_quanta > 255) next_quanta = 255; 

            // 4. Resolve Momentum & Collisions
            int x_dir = (mom_x > 0) - (mom_x < 0); 
            int y_dir = (mom_y > 0) - (mom_y < 0);
            uint8_t dominant_spin = DIR_MAP[y_dir + 1][x_dir + 1];
            
            int kinetic_heat = 0;
            if (incoming_quanta > 0 && dominant_spin == 0) {
                // Symmetrical collision: Momentum cancels, releasing kinetic heat
                kinetic_heat = incoming_quanta * 50;
            }

            // 5. Process Thermodynamics (Perfect Conservation)
            // Keep exactly what we didn't give away to the 8 neighbors
            int kept_heat = current.heat - 8 * (current.heat / 9);
            int next_heat = kept_heat + heat_sum + kinetic_heat;
            
            // Subtract environmental vacuum bleed
            next_heat -= KNOB_DISSIPATION;
            if (next_heat < 0) next_heat = 0;
            
            // E = mc^2 (Bandwidth collapse converts mass back to energy)
            if (next_heat > KNOB_THERMAL_LIMIT && next_quanta > 0) {
                next_heat += (next_quanta * 80); // Supernova Detonation
                next_quanta = 0;
                dominant_spin = 0;
            }

            // 6. Hierarchy of Vector Forces
            uint8_t next_spin = dominant_spin; // Base: Inertia
            
            if (max_heat > (KNOB_THERMAL_LIMIT / 4)) {
                next_spin = gravity_spin; // Gravity overrides inertia
            }
            if (nuclear_spin > 0 && next_quanta > 0) {
                next_spin = nuclear_spin; // Strong force overrides gravity
            }
            if (max_heat < 10 && next_quanta > 0 && (rand() % 100 < 2)) {
                next_spin = (rand() % 8) + 1; // Brownian vacuum fluctuation
            }
            
            // 7. Write to Grid
            grid_write[idx].quanta = next_quanta;
            grid_write[idx].heat = next_heat;
            grid_write[idx].spin = next_spin;

            // 8. Optical Rendering
            int px_idx = idx * 4;
            if (RENDER_LAYER == 0) { 
                if (next_quanta > 150) { 
                    pixel_buffer[px_idx + 0] = 0; pixel_buffer[px_idx + 1] = 255; pixel_buffer[px_idx + 2] = 255;
                } else {
                    uint8_t color = (next_quanta > 0) ? 255 : 0;
                    pixel_buffer[px_idx + 0] = color; pixel_buffer[px_idx + 1] = color; pixel_buffer[px_idx + 2] = color;
                }
                pixel_buffer[px_idx + 3] = 255;
            } else { 
                uint8_t r = (next_heat > 255) ? 255 : next_heat;
                uint8_t g = (next_heat > 512) ? 255 : (next_heat / 2);
                pixel_buffer[px_idx + 0] = r; pixel_buffer[px_idx + 1] = g; pixel_buffer[px_idx + 2] = 0;
                pixel_buffer[px_idx + 3] = 255;
            }
        }
    }

    PlanckNode* temp = grid_read;
    grid_read = grid_write;
    grid_write = temp;
}
