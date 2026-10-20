// test_orbit2 — circulation onset sweep: planar hexagons of side s
// (perimeter L=6s) built by walking s steps along planar ports 1..6.
// Question: at what L does a painted loop self-refresh guidance enough
// to sustain >1 orbit?  Variants: curl exchange-field, heat=500 drive,
// loom-density q floor.
//
// HOFF parity (y&1): each planar port always steps the same physical
// hex direction, so p1*s + p2*s + p3*s + p4*s + p5*s + p6*s closes.
//
// Telemetry: ring mass, off-ring mass, argmax vertex, mass-dipole
// angle theta (advancing theta = circulation), cumulative argmax
// advance (hops survived), orbit count (hops / L).
//
// usage: orbit2 <side> <ticks> <inject_b> <q_floor> <heat> <cdiv> <cvac>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <math.h>

int     planck3_init_dims(int, int, int);
int     planck3_set_mode(int);
void    planck3_set_sync(int);
void    planck3_set_temit(int);
void    planck3_set_curl(int, int);
void    planck3_set_node(int32_t, int, int, int, int, int);
void    planck3_prepare(void);
void    planck3_tick(void);
uint8_t *planck3_state_pointer(void);

#define MAXL 4096

typedef struct { uint8_t q, s; uint16_t h; uint8_t b, tn; } Rec;

/* per-parity planar offsets, mirror of HOFF in planck3.c */
static const int8_t HO[2][7][2] = {
    {{0,0},{1,0},{0,1},{-1,1},{-1,0},{-1,-1},{0,-1}},
    {{0,0},{1,0},{1,1},{0,1},{-1,0},{0,-1},{1,-1}}
};

static int LX[MAXL], LY[MAXL], LP[MAXL];

int main(int argc, char **argv) {
    int side   = argc > 1 ? atoi(argv[1]) : 8;
    int ticks  = argc > 2 ? atoi(argv[2]) : 0;
    int inject = argc > 3 ? atoi(argv[3]) : 1;
    int qfloor = argc > 4 ? atoi(argv[4]) : 0;
    int heat   = argc > 5 ? atoi(argv[5]) : 0;
    int cdiv   = argc > 6 ? atoi(argv[6]) : 0;
    int cvac   = argc > 7 ? atoi(argv[7]) : 1;
    int L = 6 * side;
    if (!ticks) ticks = 3 * L + 20;
    if (L > MAXL) { fprintf(stderr, "L=%d > MAXL\n", L); return 1; }

    int W = 3 * side + 30, H = 2 * side + 30, D = 40;
    int x0 = side + 15, y0 = 15, zl = 20;

    /* build the loop: start cell, then walk p1..p6, side steps each */
    int n = 0, x = x0, y = y0;
    for (int e = 0; e < 6; e++) {
        int p = e + 1;
        for (int s = 0; s < side; s++) {
            LX[n] = x; LY[n] = y; LP[n] = p; n++;
            x += HO[y & 1][p][0];
            y += HO[y & 1][p][1];
        }
    }
    if (x != x0 || y != y0) {
        fprintf(stderr, "loop does not close: end (%d,%d) start (%d,%d)\n",
                x, y, x0, y0);
        return 1;
    }

    if (planck3_init_dims(W, H, D)) { fprintf(stderr, "init fail\n"); return 1; }
    planck3_set_mode(0);
    planck3_set_sync(1);
    planck3_set_temit(300);
    if (cdiv) planck3_set_curl(cdiv, cvac);

    for (int i = 0; i < L; i++)
        planck3_set_node((zl * H + LY[i]) * W + LX[i],
                         qfloor, LP[i], heat, i == 0 ? inject : 0, 0);
    planck3_prepare();

    const Rec *st = (const Rec *)planck3_state_pointer();
    int prev_lead = 0, hops = 0;
    int64_t drained = 0;
    printf("# orbit2 side=%d L=%d inject=%d qfloor=%d heat=%d curl=%d,%d\n",
           side, L, inject, qfloor, heat, cdiv, cvac);
    printf("# t | ring | off | lead | theta | hops(orbits)\n");
    for (int t = 0; t <= ticks; t++) {
        int64_t ring = 0, tot = 0;
        int lead = -1, leadq = 0;
        double rx = 0, ry = 0;
        for (int i = 0; i < L; i++) {
            const Rec *c = &st[(zl * H + LY[i]) * W + LX[i]];
            int m = c->q + c->b;
            ring += m;
            if (m > leadq) { leadq = m; lead = i; }
            double a = i * 6.2831853071795865 / L;
            rx += m * cos(a); ry += m * sin(a);
        }
        for (int32_t i = 0; i < (int32_t)W * H * D; i++)
            tot += st[i].q + st[i].b;
        if (lead >= 0 && prev_lead >= 0) {
            int d = (lead - prev_lead + L) % L;
            if (d <= 2) hops += d;   /* forward progress only */
        }
        prev_lead = lead;
        double th = ring ? atan2(ry, rx) * 57.29577951308232 : 0;
        printf("t=%4d | %6lld | %6lld | c%d(q%d) | %7.1f | %d(%.2f)\n",
               t, (long long)ring, (long long)(tot - ring),
               lead, leadq, th, hops, (double)hops / L);
        /* drain x=0 wall to stop wrap flood */
        for (int z = 0; z < D; z++)
            for (int yy = 0; yy < H; yy++) {
                const Rec *r = &st[(z * H + yy) * W];
                if (r->q + r->b > 0) {
                    drained += r->q + r->b;
                    planck3_set_node((z * H + yy) * W, 0, 0, 0, 0, 0);
                }
            }
        if (t < ticks) planck3_tick();
        st = (const Rec *)planck3_state_pointer();
    }
    printf("# drained=%lld\n", (long long)drained);
    return 0;
}
