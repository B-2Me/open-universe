// test_trimer.c — three-breather chain: the frustrated trimer test.
// Three x-axis breathers (ports 1<->4), cores at (58,60,62) — d=2
// pairwise, so the MIDDLE core multiplexes BOTH shared lobes (x59
// shared with A, x61 shared with C).  Even with both pairwise Dphi
// odd (the M16 bonding rule), can a single tau=4 cycle time-share
// two lobes?  Geometries:
//   geom 0: linear chain 58,60,62 (double-bonded middle)
//   geom 1: spaced 58,62,66 (d=4 control — all independent)
// Phases pA pB pC via argv (M16 seeds).  Classification per core:
// ALIVE (q varies + spins seen in last K ticks), LUMP, GONE.
// build: gcc -O2 -Wall planck3.c test_trimer.c -o /tmp/tri -lm
// run:   /tmp/tri <ticks> <geom> <pA> <pB> <pC>
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
#define CY 20
#define CZ 20
#define X0 52
#define X1 72
#define K 12

static int idx(int x, int y, int z) { return (z * H + y) * W + x; }

static void seed_breather(int cx, int phase) {
    switch (phase) {
    case 0: planck3_set_node(idx(cx, CY, CZ), 200, 4, 0, 0, 0); break;
    case 1: planck3_set_node(idx(cx - 1, CY, CZ), 160, 1, 0, 0, 0);
            planck3_set_node(idx(cx, CY, CZ), 40, 0, 0, 0, 0); break;
    case 2: planck3_set_node(idx(cx, CY, CZ), 200, 1, 0, 0, 0); break;
    case 3: planck3_set_node(idx(cx + 1, CY, CZ), 160, 4, 0, 0, 0);
            planck3_set_node(idx(cx, CY, CZ), 40, 0, 0, 0, 0); break;
    }
}

static int phase_of(int cq, int cs, int lq, int ls, int rq, int rs) {
    if (cq >= 150 && cs == 4) return 0;
    if (cq >= 150 && cs == 1) return 2;
    if (cq < 100 && lq >= 100 && ls == 1) return 1;
    if (cq < 100 && rq >= 100 && rs == 4) return 3;
    return -1;
}

int main(int argc, char **argv) {
    int ticks = argc > 1 ? atoi(argv[1]) : 200;
    int geom  = argc > 2 ? atoi(argv[2]) : 0;
    int pA    = argc > 3 ? atoi(argv[3]) : 0;
    int pB    = argc > 4 ? atoi(argv[4]) : 1;
    int pC    = argc > 5 ? atoi(argv[5]) : 0;

    int cores[3] = {58, 60, 62};
    int phs[3]   = {pA, pB, pC};
    if (geom == 1) { cores[0] = 58; cores[1] = 62; cores[2] = 66; }

    if (planck3_init_dims(W, H, D)) { fprintf(stderr, "init fail\n"); return 1; }
    planck3_set_mode(0);
    planck3_set_sync(1);
    planck3_set_temit(300);

    for (int i = 0; i < 3; i++) seed_breather(cores[i], phs[i]);
    planck3_prepare();
    printf("# test_trimer geom=%d cores=(%d,%d,%d) phases=(%d,%d,%d)\n",
           geom, cores[0], cores[1], cores[2], pA, pB, pC);

    static uint16_t hist[24][K];
    const Rec *st = (const Rec *)planck3_state_pointer();
    int64_t drained = 0;
    for (int t = 0; t <= ticks; t++) {
        if (t > ticks - K) {
            for (int x = X0; x <= X1; x++) {
                const Rec *r = &st[(size_t)CZ * H * W + CY * W + x];
                hist[x - X0][t - (ticks - K + 1)] =
                    (uint16_t)(r->q | (r->s << 8));
            }
        }
        if (t < 12 || t % 50 == 0 || t == ticks) {
            printf("t=%3d |", t);
            for (int x = X0; x <= X1; x++) {
                const Rec *r = &st[(size_t)CZ * H * W + CY * W + x];
                if (r->q || r->s) printf(" x%d:%d,%d", x, r->q, r->s);
            }
            printf("\n");
        }
        for (int z = 0; z < D; z++)
            for (int y = 0; y < H; y++) {
                const Rec *r = &st[(size_t)z * H * W + y * W];
                if (r->q + r->b > 0) {
                    drained += r->q + r->b;
                    planck3_set_node(idx(0, y, z), 0, 0, 0, 0, 0);
                }
            }
        if (t < ticks) planck3_tick();
        st = (const Rec *)planck3_state_pointer();
    }

    for (int c = 0; c < 3; c++) {
        int cx = cores[c] - X0;
        int qEnd = hist[cx][K - 1] & 0xFF;
        int sEnd = hist[cx][K - 1] >> 8;
        int lq = hist[cx - 1][K - 1] & 0xFF, ls = hist[cx - 1][K - 1] >> 8;
        int rq = hist[cx + 1][K - 1] & 0xFF, rs = hist[cx + 1][K - 1] >> 8;
        int ph = phase_of(qEnd, sEnd, lq, ls, rq, rs);
        int qVar = 0, everS = 0;
        for (int t = 1; t < K; t++) {
            if ((hist[cx][t] & 0xFF) != (hist[cx][t - 1] & 0xFF)) qVar = 1;
            if (hist[cx][t] >> 8) everS = 1;
        }
        const char *v = (qVar && everS) ? "ALIVE" : (qEnd > 0 ? "LUMP" : "GONE");
        printf("# core%d x=%d: verdict=%s endphase=%d q=%d s=%d\n",
               c, cores[c], v, ph, qEnd, sEnd);
    }
    printf("# drained=%lld\n", (long long)drained);
    return 0;
}
