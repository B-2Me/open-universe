// test_drift.c — can any bound structure net-translate at v=1/N?
// All known structures are v=0 (lumps, breathers, dimers) or v=1
// (packets). An asymmetric limit cycle might ratchet: if ejecta is
// recaptured by a different cell than fired it, the footprint shifts.
// Seeds several asymmetric variants around (60,20,20), tracks the
// q-weighted x-centroid of corridor cells every tick.
//
// Modes (argv[2]):
//   0 symmetric breather control          (x60:200 s4)
//   1 asymmetric lobes                    (x59:190 s1, x60:40, x61:160 s4)
//   2 rephased 2-state variant            (x59:190 s1, x60:40)
//   3 breather + near lump (x64:150 s0)   external congestion asymmetry
//   4 two-state shuttle                   (x59:160 s1, x60:40)
// Usage: test_drift <ticks> <mode>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

int     planck3_init_dims(int, int, int);
int     planck3_set_mode(int);
void    planck3_set_sync(int);
void    planck3_set_temit(int);
void    planck3_set_node(int32_t, int, int, int, int, int);
void    planck3_prepare(void);
void    planck3_tick(void);
uint8_t *planck3_state_pointer(void);

typedef struct { uint8_t q, s; uint16_t h; uint8_t b, tn; } Rec;

#define W 120
#define H 40
#define D 40
#define CY 20
#define CZ 20

static int idx(int x, int y, int z) { return (z * H + y) * W + x; }

int main(int argc, char **argv) {
    int ticks = argc > 1 ? atoi(argv[1]) : 400;
    int mode  = argc > 2 ? atoi(argv[2]) : 0;

    if (planck3_init_dims(W, H, D)) { fprintf(stderr, "init_dims failed\n"); return 1; }
    planck3_set_mode(0);
    planck3_set_sync(1);
    planck3_set_temit(300);

    switch (mode) {
    case 0: planck3_set_node(idx(60, CY, CZ), 200, 4, 0, 0, 0); break;
    case 1: planck3_set_node(idx(59, CY, CZ), 190, 1, 0, 0, 0);
            planck3_set_node(idx(60, CY, CZ), 40, 0, 0, 0, 0);
            planck3_set_node(idx(61, CY, CZ), 160, 4, 0, 0, 0); break;
    case 2: planck3_set_node(idx(59, CY, CZ), 190, 1, 0, 0, 0);
            planck3_set_node(idx(60, CY, CZ), 40, 0, 0, 0, 0); break;
    case 3: planck3_set_node(idx(60, CY, CZ), 200, 4, 0, 0, 0);
            planck3_set_node(idx(64, CY, CZ), 150, 0, 0, 0, 0); break;
    case 4: planck3_set_node(idx(59, CY, CZ), 160, 1, 0, 0, 0);
            planck3_set_node(idx(60, CY, CZ), 40, 0, 0, 0, 0); break;
    }
    planck3_prepare();
    printf("# test_drift mode=%d ticks=%d\n", mode, ticks);

    const Rec *st = (const Rec *)planck3_state_pointer();
    int64_t drained = 0;
    double com0 = -1;
    for (int t = 0; t <= ticks; t++) {
        // centroid over corridor x in [45,80] (all occupied cells)
        double num = 0; int64_t den = 0; int ncell = 0;
        for (int x = 45; x <= 80; x++) {
            const Rec *r = &st[(size_t)CZ * H * W + CY * W + x];
            if (r->q > 0) { num += x * r->q; den += r->q; ncell++; }
        }
        if (den && (t % 20 == 0 || t == ticks)) {
            double com = num / den;
            if (com0 < 0) com0 = com;
            printf("t=%4d  com=%.3f (drift %+.3f)  cells=%d mass=%lld |",
                   t, com, com - com0, ncell, (long long)den);
            for (int x = 54; x <= 68; x++) {
                const Rec *r = &st[(size_t)CZ * H * W + CY * W + x];
                if (r->q || r->s) printf(" x%d:%d,%d", x, r->q, r->s);
            }
            printf("\n");
        }
        for (int z = 0; z < D; z++)
            for (int y = 0; y < H; y++) {
                const Rec *r = &st[(size_t)z * H * W + y * W];
                if (r->q + r->b > 0) { drained += r->q + r->b; planck3_set_node(idx(0, y, z), 0, 0, 0, 0, 0); }
            }
        if (t < ticks) planck3_tick();
        st = (const Rec *)planck3_state_pointer();
    }
    printf("# drained=%lld\n", (long long)drained);
    return 0;
}
