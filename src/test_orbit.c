// test_orbit — minimum Phase-Locked loop: the 6-cell planar hexagon.
// minloop.mjs proves len=6 is the shortest closed cycle satisfying the
// ≤60° turn gate on the 12-port graph (no 3/4/5-cycles exist).
//
// Loop cells (y=20 layer, z=20):
//   (20,20) p1 → (21,20) p2 → (21,21) p3 → (21,22) p4 → (20,22) p5 → (19,21) p6 → close
//
// Metrics per tick: ring mass, rotation dipole angle (advancing angle =
// circulation), off-ring spill.
//
// usage: orbit <ticks> <fill>   fill: 0=one packet, 1=full ring, 2=half ring
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

int     planck3_init_dims(int, int, int);
int     planck3_set_mode(int);
void    planck3_set_sync(int);
void    planck3_set_temit(int);
void    planck3_set_node(int32_t, int, int, int, int, int);
void    planck3_prepare(void);
void    planck3_tick(void);
uint8_t *planck3_state_pointer(void);

#define W 120
#define H 40
#define D 40
#define ZL 20

typedef struct { uint8_t q, s; uint16_t h; uint8_t b, tn; } Rec;
static int idx(int x, int y, int z) { return (z * H + y) * W + x; }

/* hexagon: cell coords + outgoing port, centered at x+40,y+20 z=20 */
static const int LOOP[6][3] = {
    {60, 20, 1}, {61, 20, 2}, {61, 21, 3}, {61, 22, 4}, {60, 22, 5}, {59, 21, 6}
};

int main(int argc, char **argv) {
    int ticks = argc > 1 ? atoi(argv[1]) : 48;
    int fill  = argc > 2 ? atoi(argv[2]) : 0;

    if (planck3_init_dims(W, H, D)) { fprintf(stderr, "init fail\n"); return 1; }
    planck3_set_mode(0);
    planck3_set_sync(1);
    planck3_set_temit(300);

    /* paint ring spins on all cells; quanta by fill mode.
     * fill 3 = loom-style: q=60 + hp=500 heat on every cell */
    for (int i = 0; i < 6; i++) {
        int q = fill == 1 ? 200 : (fill == 2 ? (i % 2 ? 200 : 0) : (i == 0 ? 200 : 0));
        int h = 0, b = 0;
        if (fill == 3) { q = 60; h = 500; }   /* loom knot-seed density */
        if (fill >= 4) q = 0;                  /* pure momentum injection */
        if (fill == 4 && i == (argc > 4 ? atoi(argv[4]) : 0))
            b = argc > 3 ? atoi(argv[3]) : 200;
        if (fill == 5) { q = 60; h = 500; if (i == 0) b = 200; } /* hot ring + packet */
        planck3_set_node(idx(LOOP[i][0], LOOP[i][1], ZL), q, LOOP[i][2], h, b, 0);
    }
    planck3_prepare();

    const Rec *st = (const Rec *)planck3_state_pointer();
    int64_t drained = 0;
    printf("# orbit fill=%d t=%d\n", fill, ticks);
    printf("# t | ring_q cell_q[0..5] rot_deg spill\n");
    for (int t = 0; t <= ticks; t++) {
        int rq[6], ring = 0;
        double rx = 0, ry = 0;
        for (int i = 0; i < 6; i++) {
            const Rec *c = &st[idx(LOOP[i][0], LOOP[i][1], ZL)];
            rq[i] = c->q + c->b;              /* parked + in-flight */
            ring += rq[i];
            double a = i * 1.0471975511965977; /* 60° per vertex */
            rx += rq[i] * cos(a); ry += rq[i] * sin(a);
        }
        /* spill = quanta within r<=2 of ring centroid excluding ring cells */
        int spill = 0;
        for (int z = ZL - 1; z <= ZL + 1; z++)
            for (int y = 17; y <= 25; y++)
                for (int x = 56; x <= 65; x++) {
                    int on = 0;
                    for (int i = 0; i < 6; i++)
                        if (x == LOOP[i][0] && y == LOOP[i][1] && z == ZL) on = 1;
                    if (!on) spill += st[idx(x, y, z)].q + st[idx(x, y, z)].b;
                }
        double rot = ring ? atan2(ry, rx) * 57.29577951308232 : 0;
        if (t % 4 == 0 || t == ticks)
            printf("t=%3d | %4d | %3d %3d %3d %3d %3d %3d | %6.1f | %d\n",
                   t, ring, rq[0], rq[1], rq[2], rq[3], rq[4], rq[5], rot, spill);
        /* drain x=0 plane */
        for (int z = 0; z < D; z++)
            for (int y = 0; y < H; y++) {
                const Rec *r = &st[idx(0, y, z)];
                if (r->q + r->b > 0) {
                    drained += r->q + r->b;
                    planck3_set_node(idx(0, y, z), 0, 0, 0, 0, 0);
                }
            }
        if (t < ticks) planck3_tick();
        st = (const Rec *)planck3_state_pointer();
    }
    printf("# drained=%lld\n", (long long)drained);
    return 0;
}
