/*
 * The Planck Field Engine (Langevin's Wake)
 * Production-Hardened Bridge Simulator Edition
 * Copyright (c) 2026 Nathan / btwo.me
 */

#include <stdint.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <emscripten.h>

#define BUILD_VERSION 119
#define WIDTH 400
#define HEIGHT 400
#define PIXEL_COUNT (WIDTH * HEIGHT)

typedef struct {
    uint8_t quanta;  
    uint8_t spin;    
    uint16_t heat;   
} PlanckNode;

PlanckNode* grid_read = NULL;
PlanckNode* grid_write = NULL;
PlanckNode* grid_snapshot = NULL;
uint8_t pixel_buffer[PIXEL_COUNT * 4];

uint8_t KNOB_DISSIPATION = 15; 
uint16_t KNOB_THERMAL_LIMIT = 1200;
int IMPEDANCE_MODE_ACTIVE = 1;

const uint8_t DIR_MAP[3][3] = { {8, 1, 2}, {7, 0, 3}, {6, 5, 4} };
const uint8_t INV_DIR[9] = {0, 5, 6, 7, 8, 1, 2, 3, 4};
const int SPIN_DX[9] = {0, 0, 1, 1, 1, 0, -1, -1, -1};
const int SPIN_DY[9] = {0, -1, -1, 0, 1, 1, 1, 0, -1};

// Telemetry
double obs_total_quanta = 0;
double obs_total_heat = 0;
double obs_phase_alignment = 0; 
double obs_actualization_yield = 0;

EMSCRIPTEN_KEEPALIVE double get_total_quanta() { return obs_total_quanta; }
EMSCRIPTEN_KEEPALIVE double get_total_heat() { return obs_total_heat; }
EMSCRIPTEN_KEEPALIVE double get_phase_alignment() { return obs_phase_alignment; }
EMSCRIPTEN_KEEPALIVE double get_yield() { return obs_actualization_yield; }

EMSCRIPTEN_KEEPALIVE int get_engine_version() { return BUILD_VERSION; }
EMSCRIPTEN_KEEPALIVE int get_grid_width() { return WIDTH; }
EMSCRIPTEN_KEEPALIVE int get_grid_height() { return HEIGHT; }
EMSCRIPTEN_KEEPALIVE uint8_t* get_pixel_buffer_pointer() { return pixel_buffer; }

EMSCRIPTEN_KEEPALIVE void set_dissipation(int rate) { KNOB_DISSIPATION = (uint8_t)rate; }
EMSCRIPTEN_KEEPALIVE void set_thermal_limit(int limit) { KNOB_THERMAL_LIMIT = (uint16_t)limit; }
EMSCRIPTEN_KEEPALIVE void set_impedance_mode(int active) { IMPEDANCE_MODE_ACTIVE = active; }

EMSCRIPTEN_KEEPALIVE
void init_grid() {
    if (grid_read != NULL) { free(grid_read); grid_read = NULL; }
    if (grid_write != NULL) { free(grid_write); grid_write = NULL; }
    if (grid_snapshot != NULL) { free(grid_snapshot); grid_snapshot = NULL; }

    grid_read = calloc(PIXEL_COUNT, sizeof(PlanckNode));
    grid_write = calloc(PIXEL_COUNT, sizeof(PlanckNode));
    grid_snapshot = calloc(PIXEL_COUNT, sizeof(PlanckNode));
}

EMSCRIPTEN_KEEPALIVE
void free_grid() {
    if (grid_read != NULL) { free(grid_read); grid_read = NULL; }
    if (grid_write != NULL) { free(grid_write); grid_write = NULL; }
    if (grid_snapshot != NULL) { free(grid_snapshot); grid_snapshot = NULL; }
}

EMSCRIPTEN_KEEPALIVE
void save_grid_snapshot() {
    if (!grid_read || !grid_snapshot) return;
    memcpy(grid_snapshot, grid_read, PIXEL_COUNT * sizeof(PlanckNode));
}

EMSCRIPTEN_KEEPALIVE
void restore_grid_snapshot() {
    if (!grid_read || !grid_snapshot) return;
    memcpy(grid_read, grid_snapshot, PIXEL_COUNT * sizeof(PlanckNode));
}

EMSCRIPTEN_KEEPALIVE
void clear_grid() {
    if (!grid_read) return;
    for (int i = 0; i < PIXEL_COUNT; i++) {
        grid_read[i].quanta = 0; grid_read[i].spin = 0; grid_read[i].heat = 1;
    }
}

EMSCRIPTEN_KEEPALIVE
void randomize_grid() {
    if (!grid_read) return;
    for (int i = 0; i < PIXEL_COUNT; i++) {
        grid_read[i].quanta = (rand() % 100 < 5) ? 1 : 0;
        grid_read[i].spin = grid_read[i].quanta ? ((rand() % 8) + 1) : 0;
        grid_read[i].heat = grid_read[i].quanta * 100;
        if (grid_read[i].heat == 0) grid_read[i].heat = 1;
    }
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
    grid_read[idx].spin = (state >> 16) & 0xFF;
    grid_read[idx].heat = state & 0xFFFF;
}

EMSCRIPTEN_KEEPALIVE 
void add_quanta_impedance(int x, int y, int amount) {
    if (!grid_read || x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || amount <= 0) return;
    int idx = y * WIDTH + x;
    PlanckNode* target = &grid_read[idx];

    // Acoustic Backscatter
    if (IMPEDANCE_MODE_ACTIVE && target->quanta > 180) {
        int backscatter_heat = amount * (KNOB_THERMAL_LIMIT / 20);
        target->heat = (target->heat + backscatter_heat > 65535) ? 65535 : target->heat + backscatter_heat;
        return; 
    }

    int q = target->quanta + amount;
    target->quanta = (q > 255) ? 255 : q;

    // Environment-Normalized Thermal Scaling
    double thermal_scale = (double)KNOB_THERMAL_LIMIT / 1200.0;
    int dynamic_heat_add = (int)((amount * 25) / (KNOB_DISSIPATION * 0.1 + 1.0) * thermal_scale);
    int h = target->heat + dynamic_heat_add;
    target->heat = (h > 65535) ? 65535 : h;

    // Refractive Momentum Inheritance
    if (IMPEDANCE_MODE_ACTIVE) {
        int sum_dx = 0, sum_dy = 0;
        int neighbor_count = 0;
        
        for (int dy = -1; dy <= 1; dy++) {
            for (int dx = -1; dx <= 1; dx++) {
                if (dx == 0 && dy == 0) continue;
                int nx = (x + dx + WIDTH) % WIDTH;
                int ny = (y + dy + HEIGHT) % HEIGHT;
                PlanckNode n = grid_read[ny * WIDTH + nx];
                if (n.spin > 0 && n.spin <= 8) {
                    sum_dx += SPIN_DX[n.spin];
                    sum_dy += SPIN_DY[n.spin];
                    neighbor_count++;
                }
            }
        }
        
        if (neighbor_count > 0 && (sum_dx != 0 || sum_dy != 0)) {
            int sdx = (sum_dx > 0) - (sum_dx < 0);
            int sdy = (sum_dy > 0) - (sum_dy < 0);
            target->spin = DIR_MAP[sdy + 1][sdx + 1];
            if (target->spin == 0) target->spin = (rand() % 8) + 1;
        } else {
            target->spin = (rand() % 8) + 1;
        }
    } else {
        target->spin = (rand() % 8) + 1;
    }
}

EMSCRIPTEN_KEEPALIVE void add_quanta(int x, int y, int amount) {
    if (IMPEDANCE_MODE_ACTIVE) {
        add_quanta_impedance(x, y, amount);
    } else {
        if (!grid_read || x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || amount <= 0) return;
        int idx = y * WIDTH + x;
        int q = grid_read[idx].quanta + amount;
        grid_read[idx].quanta = (q > 255) ? 255 : q;
        grid_read[idx].heat += amount * 25;
        grid_read[idx].spin = (rand() % 8) + 1; 
    }
}

EMSCRIPTEN_KEEPALIVE void add_heat(int x, int y, int amount) {
    if (!grid_read || x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || amount <= 0) return;
    int idx = y * WIDTH + x;
    int h = grid_read[idx].heat + amount;
    grid_read[idx].heat = (h > 65535) ? 65535 : h;
}

EMSCRIPTEN_KEEPALIVE void set_spin(int x, int y, int dir) {
    if (!grid_read || x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || dir < 1 || dir > 8) return;
    grid_read[y * WIDTH + x].spin = dir;
}

EMSCRIPTEN_KEEPALIVE void set_node(int x, int y, int amount) { add_quanta(x, y, amount); }
EMSCRIPTEN_KEEPALIVE int get_node(int x, int y) { 
    if (!grid_read || x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return 0;
    return grid_read[y * WIDTH + x].quanta; 
}

// ---------------------------------------------------------
// PHYSICS ENGINE
// ---------------------------------------------------------
EMSCRIPTEN_KEEPALIVE
void tick() {
    if (!grid_read || !grid_write) return;

    double frame_quanta = 0;
    double frame_heat = 0;
    double frame_yield = 0;
    int active_nodes = 0;
    int aligned_nodes = 0;

    for (int y = 0; y < HEIGHT; y++) {
        for (int x = 0; x < WIDTH; x++) {
            int idx = y * WIDTH + x;
            PlanckNode current = grid_read[idx];
            
            int target_deadlocked = 0;
            if (current.spin != 0) {
                int target_x = (x + SPIN_DX[current.spin] + WIDTH) % WIDTH;
                int target_y = (y + SPIN_DY[current.spin] + HEIGHT) % HEIGHT;
                if (grid_read[target_y * WIDTH + target_x].quanta > 200) target_deadlocked = 1;
            }
            
            int heat_sum = 0;
            int kinetic_heat = 0;
            int max_heat = -1;
            uint8_t gravity_spin = current.spin;
            int incoming_quanta = 0;
            int mom_x = 0; 
            int mom_y = 0;
            
            int has_domain_match = 0; 

            for (int dy = -1; dy <= 1; dy++) {
                for (int dx = -1; dx <= 1; dx++) {
                    if (dx == 0 && dy == 0) continue;
                    
                    int nx = (x + dx + WIDTH) % WIDTH;
                    int ny = (y + dy + HEIGHT) % HEIGHT;
                    PlanckNode neighbor = grid_read[ny * WIDTH + nx];

                    uint8_t n_dir = DIR_MAP[dy+1][dx+1];
                    uint8_t req_spin = INV_DIR[n_dir];

                    heat_sum += neighbor.heat / 9;

                    if (neighbor.quanta > 0 && neighbor.spin == req_spin) {
                        kinetic_heat += (neighbor.quanta * 1);
                        
                        if (current.quanta > 0 && current.spin != 0) {
                            if (neighbor.spin == current.spin) {
                                kinetic_heat += neighbor.quanta * 5; 
                            } else if (neighbor.spin == INV_DIR[current.spin]) {
                                kinetic_heat += 0; 
                            } else {
                                kinetic_heat += neighbor.quanta * 2;
                            }
                        }

                        if (current.quanta <= 200) {
                            incoming_quanta += neighbor.quanta; 
                            mom_x -= (dx * neighbor.quanta);    
                            mom_y -= (dy * neighbor.quanta);
                        }
                    }

                    if (neighbor.heat > max_heat) {
                        max_heat = neighbor.heat;
                        gravity_spin = n_dir;
                    }
                    
                    if (current.quanta > 0 && neighbor.quanta > 0 && neighbor.spin == current.spin) {
                        has_domain_match = 1;
                    }
                }
            }

            int next_quanta = current.quanta;
            int shunting = 0;
            
            if (current.quanta > 0 && current.spin != 0) {
                if (!target_deadlocked) next_quanta = 0;
                else {
                    shunting = 1; 
                    kinetic_heat += (current.quanta * 5); 
                }
            }
            next_quanta += incoming_quanta; 
            if (next_quanta > 255) next_quanta = 255; 

            int x_dir = (mom_x > 0) - (mom_x < 0); 
            int y_dir = (mom_y > 0) - (mom_y < 0);
            uint8_t dominant_spin = DIR_MAP[y_dir + 1][x_dir + 1];
            
            if (incoming_quanta > 0 && dominant_spin == 0) kinetic_heat += incoming_quanta * 10; 

            int kept_heat = current.heat - 8 * (current.heat / 9);
            int next_heat = kept_heat + heat_sum + kinetic_heat;
            
            next_heat += (next_quanta * 15); 
            
            int temp_scalar = next_heat / 200; 
            int heat_loss = (1 + (temp_scalar * temp_scalar)) * KNOB_DISSIPATION;
            next_heat -= heat_loss;
            
            if (next_heat < 2) next_heat = 1 + (rand() % 3); 
            
            // Topological Unwinding
            if (next_heat > KNOB_THERMAL_LIMIT && next_quanta > 0) {
                next_heat = 65535; 
                next_quanta = 0;   
                dominant_spin = 0; 
                shunting = 1;      
                frame_yield += 1.0; 
            }

            uint8_t next_spin = dominant_spin; 
            if (shunting) {
                uint8_t left_spin = (current.spin - 1 < 1) ? 8 : current.spin - 1;
                uint8_t right_spin = (current.spin + 1 > 8) ? 1 : current.spin + 1;
                
                int lx = (x + SPIN_DX[left_spin] + WIDTH) % WIDTH;
                int ly = (y + SPIN_DY[left_spin] + HEIGHT) % HEIGHT;
                int rx = (x + SPIN_DX[right_spin] + WIDTH) % WIDTH;
                int ry = (y + SPIN_DY[right_spin] + HEIGHT) % HEIGHT;
                
                int heat_left = grid_read[ly * WIDTH + lx].heat;
                int heat_right = grid_read[ry * WIDTH + rx].heat;
                
                if (heat_left < heat_right) next_spin = left_spin;
                else if (heat_right < heat_left) next_spin = right_spin;
                else next_spin = ((x + y) % 2 == 0) ? left_spin : right_spin;
            } else if (max_heat > (KNOB_THERMAL_LIMIT / 4) && next_quanta > 0) {
                next_spin = gravity_spin;
            }
            
            grid_write[idx].quanta = next_quanta;
            grid_write[idx].heat = next_heat;
            grid_write[idx].spin = next_spin;
            
            frame_quanta += next_quanta;
            frame_heat += next_heat;
            
            if (next_quanta > 0) {
                active_nodes++;
                if (has_domain_match) aligned_nodes++;
            }
        }
    }

    obs_total_quanta = frame_quanta;
    obs_total_heat = frame_heat;
    obs_actualization_yield = frame_yield;
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
                uint8_t tension = (next_heat > 100) ? 100 : next_heat;
                pixel_buffer[px_idx + 0] = tension;
                pixel_buffer[px_idx + 1] = 0;
                pixel_buffer[px_idx + 2] = tension;
            }
        }
        pixel_buffer[px_idx + 3] = 255;
    }
}

// ---------------------------------------------------------
// PRO-GRADE DETERMINISTIC VTK PARAVIEW EXPORTER
// ---------------------------------------------------------
char* vtk_buffer = NULL;
size_t vtk_buffer_capacity = 0;

size_t get_required_vtk_buffer_size() {
    size_t header_size = 512;
    size_t quanta_size = (size_t)PIXEL_COUNT * 16; 
    size_t heat_size = (size_t)PIXEL_COUNT * 16;   
    size_t vector_size = (size_t)PIXEL_COUNT * 32; 
    return header_size + quanta_size + heat_size + vector_size;
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

    SAFE_PRINTF("\nSCALARS Heat float 1\n");
    SAFE_PRINTF("LOOKUP_TABLE default\n");
    for (int i = 0; i < PIXEL_COUNT; i++) {
        SAFE_PRINTF("%d\n", grid_read[i].heat);
    }

    SAFE_PRINTF("\nVECTORS Spin float\n");
    for (int i = 0; i < PIXEL_COUNT; i++) {
        uint8_t s = grid_read[i].spin;
        int dx = (s == 0) ? 0 : SPIN_DX[s];
        int dy = (s == 0) ? 0 : SPIN_DY[s];
        SAFE_PRINTF("%d %d 0.0\n", dx, dy);
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
