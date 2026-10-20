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
void    planck3_set_curl(int, int);
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

/* default hexagon: cell coords + outgoing port, centered x+40,y+20 z=20 */
static int LOOP[64][3] = {
    {60, 20, 1}, {61, 20, 2}, {61, 21, 3}, {61, 22, 4}, {60, 22, 5}, {59, 21, 6}
};
static int NL = 6;

static int loop_z[64] = {20,20,20,20,20,20};

/* parse "dx,dy,dz,port;dx,dy,dz,port;..." relative to (60,20,20) */
static int parse_loop(const char *s) {
    int n = 0;
    while (*s && n < 64) {
        int dx, dy, dz, p;
        if (sscanf(s, "%d,%d,%d,%d", &dx, &dy, &dz, &p) != 4) break;
        LOOP[n][0] = 60 + dx; LOOP[n][1] = 20 + dy; LOOP[n][2] = p;
        loop_z[n] = 20 + dz;
        n++;
        while (*s && *s != ';') s++;
        if (*s == ';') s++;
    }
    return n;
}

int main(int argc, char **argv) {
    int ticks = argc > 1 ? atoi(argv[1]) : 48;
    int fill  = argc > 2 ? atoi(argv[2]) : 4;
    int bcount= argc > 3 ? atoi(argv[3]) : 1;
    int bcell = argc > 4 ? atoi(argv[4]) : 0;
    if (argc > 5 && argv[5][0] != '-') {      /* "-" keeps default hexagon */
        int n = parse_loop(argv[5]);
        if (n >= 3) NL = n;
    }

    if (planck3_init_dims(W, H, D)) { fprintf(stderr, "init fail\n"); return 1; }
    planck3_set_mode(0);
    planck3_set_sync(1);
    planck3_set_temit(300);
    /* curl transverse induction (exchange-field wake): argv[6] = div strength
     * (0 off, 3 ≈ 1/8 inflow momentum), vac=1 restrict to spinless cells */
    if (argc > 6) planck3_set_curl(atoi(argv[6]), argc > 7 ? atoi(argv[7]) : 1);

    for (int i = 0; i < NL; i++) {
        int q = fill == 1 ? 200 : (fill == 2 ? (i % 2 ? 200 : 0) : (i == 0 ? 200 : 0));
        int h = 0, b = 0;
        if (fill == 3) { q = 60; h = 500; }
        if (fill >= 4) q = 0;
        if (fill == 4 && i == bcell) b = bcount;
        if (fill == 5) { q = 60; h = 500; if (i == 0) b = 200; }
        planck3_set_node(idx(LOOP[i][0], LOOP[i][1], loop_z[i]),
                         q, LOOP[i][2], h, b, 0);
    }
    planck3_prepare();

    const Rec *st = (const Rec *)planck3_state_pointer();
    int64_t drained = 0;
    printf("# orbit fill=%d L=%d t=%d\n", fill, NL, ticks);
    for (int t = 0; t <= ticks; t++) {
        int ring = 0, lead = -1, leadq = 0;
        double rx = 0, ry = 0;
        for (int i = 0; i < NL; i++) {
            const Rec *c = &st[idx(LOOP[i][0], LOOP[i][1], loop_z[i])];
            int m = c->q + c->b;
            ring += m;
            if (m > leadq) { leadq = m; lead = i; }
            double a = i * 6.2831853071795865 / NL;
            rx += m * cos(a); ry += m * sin(a);
        }
        int spill = 0;
        for (int z = 15; z <= 25; z++)
            for (int y = 10; y <= 30; y++)
                for (int x = 50; x <= 72; x++) {
                    int on = 0;
                    for (int i = 0; i < NL; i++)
                        if (x == LOOP[i][0] && y == LOOP[i][1] &&
                            z == loop_z[i]) on = 1;
                    if (!on) spill += st[idx(x, y, z)].q + st[idx(x, y, z)].b;
                }
        double rot = ring ? atan2(ry, rx) * 57.29577951308232 : 0;
        printf("t=%3d | ring=%4d lead=c%d(q%d) rot=%6.1f spill=%d",
               t, ring, lead, leadq, rot, spill);
        /* packet trace: every occupied non-ring cell in the window */
        for (int z = 15; z <= 25; z++)
            for (int y = 10; y <= 30; y++)
                for (int x = 50; x <= 72; x++) {
                    int on = 0;
                    for (int i = 0; i < NL; i++)
                        if (x == LOOP[i][0] && y == LOOP[i][1] &&
                            z == loop_z[i]) on = 1;
                    const Rec *r = &st[idx(x, y, z)];
                    if (!on && r->q + r->b > 0)
                        printf(" esc@(%d,%d,%d)q%ds%d", x, y, z,
                               r->q + r->b, r->s & 15);
                }
        printf("\n");
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
