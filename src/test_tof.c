/*
 * test_tof.c — M4 time-of-flight / vacuum dispersion (Gemini brief).
 *
 *   test_tof <port> <ticks> [sync]
 *
 * 120x40x40 cold vacuum. A 3x3 emitter cluster at x=10 (q=200, spin=<port>)
 * fires a single burst; each tick we log the live mass, its centroid, and
 * the leading-edge displacement projected on the port's real-space unit
 * vector. Group velocity v_g = leading displacement / tick.
 *
 * Ports are the FCC <110>-family links: 1=(1,0,0)x256, 2=(.5,.87,0),
 * 7=(.58,0,.81), 10=(.29,.5,-.81) — ports 1/2/7/10 probe the planar axis,
 * in-plane diagonal, zenith, and 3-component body-ish directions.
 */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <inttypes.h>

int     planck3_init_dims(int, int, int);
int     planck3_set_mode(int);
void    planck3_set_sync(int);
void    planck3_set_node(int32_t, int, int, int, int, int);
void    planck3_prepare(void);
void    planck3_tick(void);
uint8_t *planck3_state_pointer(void);
int32_t planck3_node_count(void);

typedef struct { uint8_t q, s; uint16_t h; uint8_t b, tn; } Rec;

#define W 120
#define H 40
#define D 40

// V3 port vectors / 256 (fixed-point table mirrored for projection)
static const double UVEC[13][3] = {
    {0,0,0},
    {1,0,0}, {.5,.867,0}, {-.5,.867,0}, {-1,0,0}, {-.5,-.867,0}, {.5,-.867,0},
    {.578,0,.816}, {-.289,.5,.816}, {-.289,-.5,.816},
    {.289,.5,-.816}, {-.578,0,-.816}, {.289,-.5,-.816}
};

int main(int argc, char **argv) {
    int port  = argc > 1 ? atoi(argv[1]) : 1;
    int ticks = argc > 2 ? atoi(argv[2]) : 250;
    int sync  = argc > 3 ? atoi(argv[3]) : 1;
    const char *e = getenv("P3_SYNC");
    if (e) sync = atoi(e);
    if (port < 1 || port > 12) { fprintf(stderr, "port 1..12\n"); return 1; }

    if (planck3_init_dims(W, H, D)) { fprintf(stderr, "init_dims failed\n"); return 1; }
    planck3_set_mode(0);
    planck3_set_sync(sync);

    // Single-cell emitter at (10,20,20): q must stay under FLOW_CAP —
    // a denser/brighter source congestion-diverts its own spins toward
    // the pack and self-scatters (measured: dense clusters can't beam).
    int emit[1]; int ne = 1;
    emit[0] = (20 * H + 20) * W + 10;
    planck3_set_node(emit[0], 120, port, 0, 0, 0);
    planck3_prepare();

    uint8_t *st = planck3_state_pointer();
    int32_t n = planck3_node_count();
    const double *u = UVEC[port];
    printf("# port=%d u=(%.3f,%.3f,%.3f) sync=%d ticks=%d\n", port, u[0], u[1], u[2], sync, ticks);
    printf("# t  live  mass  cx  cy  cz  lead_x  lead_proj\n");

    for (int t = 0; t <= ticks; t++) {
        if (t) planck3_tick();
        int64_t mass = 0; int live = 0;
        double cx = 0, cy = 0, cz = 0, leadProj = -1e9; int leadX = -1;
        for (int32_t i = 0; i < n; i++) {
            Rec *r = (Rec *)(st + (size_t)i * sizeof(Rec));
            int m = r->q + r->b;
            if (!m) continue;
            int is_emit = 0;
            for (int k = 0; k < ne; k++) if (emit[k] == i) { is_emit = 1; break; }
            if (is_emit && t) continue; // exclude the source cells after t=0
            live++; mass += m;
            int x = i % W, y = (i % (H * W)) / W, z = i / (H * W);
            cx += x * m; cy += y * m; cz += z * m;
            double proj = x * u[0] + y * u[1] + z * u[2];
            if (proj > leadProj) leadProj = proj;
            if (x > leadX) leadX = x;
        }
        if (mass) { cx /= mass; cy /= mass; cz /= mass; }
        printf("%d %d %" PRId64 " %.3f %.3f %.3f %d %.3f\n",
               t, live, mass, cx, cy, cz, leadX, leadProj);
        fflush(stdout);
    }
    return 0;
}
