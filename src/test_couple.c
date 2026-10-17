// test_couple.c — M16: breather-breather coupling (physics -> chemistry?)
// Two x-axis two-lobe breathers (ports 1<->4): core A at (60,20,20)
// seeded at attractor index 0 (q200 s4), core B at (60+d,20,20) seeded
// at index dphi. Attractor-state seeds:
//   idx0: (x):200 s4          idx1: (x-1):160 s1 + (x):40
//   idx2: (x):200 s1          idx3: (x+1):160 s4 + (x):40
// d=2 shares the lobe cell x=61 (max coupling). d>=4 isolates (control).
// After <ticks>, record (q,s) over last K ticks for the corridor
// x in [55,72]; classify each core: ALIVE (periodic, tau<=4), LUMP
// (static q>0), GONE — plus end-phase index of each core.
// Verdict per (d,dphi): BOTH-ALIVE (+ end phase offset vs seeded),
// MERGED/DEAD. Usage: test_couple <ticks> <d> <dphi>
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
#define XA 60
#define K 12
#define X0 55
#define X1 74

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

// phase index of a breather whose core state is (cq,cs), lobes (lq,ls)/(rq,rs)
static int phase_of(int cq, int cs, int lq, int ls, int rq, int rs) {
    if (cq >= 150 && cs == 4) return 0;
    if (cq >= 150 && cs == 1) return 2;
    if (cq < 100 && lq >= 100 && ls == 1) return 1;
    if (cq < 100 && rq >= 100 && rs == 4) return 3;
    return -1;
}

int main(int argc, char **argv) {
    int ticks = argc > 1 ? atoi(argv[1]) : 200;
    int d     = argc > 2 ? atoi(argv[2]) : 3;
    int dphi  = argc > 3 ? atoi(argv[3]) : 0;

    if (planck3_init_dims(W, H, D)) { fprintf(stderr, "init_dims failed\n"); return 1; }
    planck3_set_mode(0);
    planck3_set_sync(1);
    planck3_set_temit(300);

    seed_breather(XA, 0);
    seed_breather(XA + d, dphi);
    planck3_prepare();
    printf("# test_couple d=%d dphi=%d  A=(%d,idx0) B=(%d,idx%d)\n",
           d, dphi, XA, XA + d, dphi);

    static uint16_t hist[80][K];   // cells X0..X1 -> q|s<<8
    const Rec *st = (const Rec *)planck3_state_pointer();
    int64_t drained = 0;
    for (int t = 0; t <= ticks; t++) {
        if (t > ticks - K) {
            for (int x = X0; x <= X1; x++) {
                const Rec *r = &st[(size_t)CZ * H * W + CY * W + x];
                hist[x - X0][t - (ticks - K + 1)] = (uint16_t)(r->q | (r->s << 8));
            }
        }
        // corridor dump every 25 ticks; per-tick for the first 12
        if (t < 12 || t % 25 == 0 || t == ticks) {
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
                if (r->q + r->b > 0) { drained += r->q + r->b; planck3_set_node(idx(0, y, z), 0, 0, 0, 0, 0); }
            }
        if (t < ticks) planck3_tick();
        st = (const Rec *)planck3_state_pointer();
    }

    // per-core classification + end phase
    int cores[2] = {XA, XA + d};
    for (int c = 0; c < 2; c++) {
        int cx = cores[c] - X0;
        int qEnd = hist[cx][K - 1] & 0xFF;
        int sEnd = hist[cx][K - 1] >> 8;
        int lq = hist[cx - 1][K - 1] & 0xFF, ls = hist[cx - 1][K - 1] >> 8;
        int rq = hist[cx + 1][K - 1] & 0xFF, rs = hist[cx + 1][K - 1] >> 8;
        int ph = phase_of(qEnd, sEnd, lq, ls, rq, rs);
        // alive = core q varies over window (cycling) or spins seen
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
