// test_oscarray.c — M13: phase-graded breather array as a detector wall.
// Eight two-lobe breather oscillators at x=60, y=4+4k (k=0..7), each
// seeded directly into attractor state index k mod 4:
//   idx0: (60):q200 s4          idx1: (59):q160 s1 + (60):q40
//   idx2: (60):q200 s1          idx3: (61):q160 s4 + (60):q40
// A uniform row of q=20 probes (port 1) fires at t=0 and reaches the
// left-lobe corridor x=59 at t~49, where osc k sits in attractor index
// (k+49) mod 4 — i.e. the array is graded through all four phases.
// Predicted M12 map: idx1=integrate(dark), idx2=swap-transmit(bright),
// idx3=absorb-kill(dark), idx0=forward-scatter(bright) -> alternating
// D,B,D,B on the APD wall = a transmission fringe, period 4 in k.
// Readout: APD primes at x=90 same rows (transmission = click).
// Usage: test_oscarray <ticks> <q2>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

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
#define CZ 20
#define NOSC 8
#define PRIME 199

static int idx(int x, int y, int z) { return (z * H + y) * W + x; }

int main(int argc, char **argv) {
    int ticks = argc > 1 ? atoi(argv[1]) : 180;
    int q2    = argc > 2 ? atoi(argv[2]) : 20;

    if (planck3_init_dims(W, H, D)) { fprintf(stderr, "init_dims failed\n"); return 1; }
    planck3_set_mode(0);
    planck3_set_sync(1);
    planck3_set_temit(300);

    int oy[NOSC], seed[NOSC];
    for (int k = 0; k < NOSC; k++) { oy[k] = 4 + 4 * k; seed[k] = k % 4; }

    // seed phase-graded breather array
    for (int k = 0; k < NOSC; k++) {
        int y = oy[k];
        switch (seed[k]) {
        case 0: planck3_set_node(idx(60, y, CZ), 200, 4, 0, 0, 0); break;
        case 1: planck3_set_node(idx(59, y, CZ), 160, 1, 0, 0, 0);
                planck3_set_node(idx(60, y, CZ), 40, 0, 0, 0, 0); break;
        case 2: planck3_set_node(idx(60, y, CZ), 200, 1, 0, 0, 0); break;
        case 3: planck3_set_node(idx(61, y, CZ), 160, 4, 0, 0, 0);
                planck3_set_node(idx(60, y, CZ), 40, 0, 0, 0, 0); break;
        }
    }
    // APD wall at x=90 on the same rows
    for (int k = 0; k < NOSC; k++)
        planck3_set_node(idx(90, oy[k], CZ), PRIME, 0, 0, 0, 0);
    planck3_prepare();

    printf("# test_oscarray q2=%d — probes t=0, lobe arrival ~t49\n", q2);
    printf("# k | y | seed | arr_idx | wall_click | drained | verdict\n");

    const Rec *st = (const Rec *)planck3_state_pointer();
    static int64_t drained[NOSC], click[NOSC];
    int probesDone = 0;
    for (int t = 0; t <= ticks; t++) {
        if (!probesDone) {
            for (int k = 0; k < NOSC; k++)
                planck3_set_node(idx(10, oy[k], CZ), q2, 1, 0, 0, 0);
            probesDone = 1;
        }

        // dump osc rows around arrival (t=46..60), compact per k
        if (t >= 46 && t <= 60) {
            printf("t=%3d |", t);
            for (int k = 0; k < NOSC; k++) {
                int y = oy[k];
                printf(" [k%d]", k);
                for (int x = 58; x <= 62; x++) {
                    const Rec *nd = &st[(size_t)CZ * H * W + y * W + x];
                    if (nd->q || nd->s) printf(" x%d:%d,%d", x, nd->q, nd->s);
                }
            }
            printf("\n");
        }

        // APD click scan on the 8 primed rows
        for (int k = 0; k < NOSC; k++) {
            const Rec *nd = &st[(size_t)CZ * H * W + oy[k] * W + 90];
            if (!click[k] && (nd->s != 0 || (nd->q < 197 && nd->q > 0))) {
                click[k] = 1;
                printf("CLICK t=%d k=%d y=%d resid=%d\n", t, k, oy[k], nd->q);
            }
        }
        // drain x=0, attributed by row
        for (int k = 0; k < NOSC; k++) {
            const Rec *r = &st[(size_t)CZ * H * W + oy[k] * W];
            if (r->q + r->b > 0) { drained[k] += r->q + r->b; planck3_set_node(idx(0, oy[k], CZ), 0, 0, 0, 0, 0); }
        }
        if (t < ticks) planck3_tick();
        st = (const Rec *)planck3_state_pointer();
    }

    printf("\n# verdict table:\n");
    for (int k = 0; k < NOSC; k++) {
        // residual state in corridor x=58..62 at end
        int liveQ = 0, liveS = 0;
        for (int x = 58; x <= 62; x++) {
            const Rec *nd = &st[(size_t)CZ * H * W + oy[k] * W + x];
            liveQ += nd->q; liveS |= nd->s;
        }
        const char *v = !liveQ ? "GONE(empty)"
                      : liveS  ? "CYCLE-ALIVE" : "DEAD-LUMP";
        printf("# k=%d y=%2d seed=%d arr_idx=%d click=%lld drained=%3lld residQ=%d -> %s\n",
               k, oy[k], seed[k], (seed[k] + 49) % 4,
               (long long)click[k], (long long)drained[k], liveQ, v);
    }
    return 0;
}
