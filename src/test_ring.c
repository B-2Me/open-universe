/* test_ring — cross-axis breathers, corner bonds, and the closed
 * triangle ring. The 12 ports are 6 antipodal pairs = 6 oscillator
 * axes; planar axes are (1,4),(2,5),(3,6) at 60° on the triangular
 * lattice. A x-axis core at (58,20), a (2,5) core at (58,19), and a
 * (3,6) core at (57,19) pairwise share ALL lobes — the minimal
 * closed 3-cycle that cannot exist on a line.
 *
 * usage: tri <ticks> <mode> <phases>
 *   mode 0: corner pair — A(58,20) ax1/4 + B(58,19) ax2/5 share (59,20)
 *   mode 1: triangle    — A(58,20) ax14, B(58,19) ax25, C(57,19) ax36
 *   phases: digit per core (0-3), e.g. "010", "000"
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
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
#define K 12

typedef struct { uint8_t q, s, b, tn, hp, pad; } Rec;

static int idx(int x, int y, int z) { return (z * H + y) * W + x; }

/* odd-r offset hex rows — mirror of HOFF in planck3.c */
static const int8_t HOFF[2][7][2] = {
    {{0,0},{1,0},{0,1},{-1,1},{-1,0},{-1,-1},{0,-1}},
    {{0,0},{1,0},{1,1},{0,1},{-1,0},{0,-1},{1,-1}}
};
static const uint8_t BACK3[13] = {0,4,5,6,1,2,3,11,12,10,9,7,8};

/* port dz: planar ports 1-6 stay in-layer; 7-9 climb, 10-12 descend */
static int port_dz(int p) { return p >= 7 && p <= 9 ? 1 : (p >= 10 ? -1 : 0); }

/* breather on port axis a (antipode b=BACK3[a]) at (cx,cy,cz):
 * phase0 core q200 s=b  (fires toward b)
 * phase1 lobe_b q160 s=a + core 40 (return leg)
 * phase2 core q200 s=a
 * phase3 lobe_a q160 s=b + core 40 */
static void seed_axis_breather(int cx, int cy, int cz, int a, int phase) {
    int b = BACK3[a], par = cy & 1;
    int bx = cx + HOFF[par][b][0], by = cy + HOFF[par][b][1], bz = cz + port_dz(b);
    int ax_ = cx + HOFF[par][a][0], ay = cy + HOFF[par][a][1], az = cz + port_dz(a);
    switch (phase) {
    case 0: planck3_set_node(idx(cx, cy, cz), 200, b, 0, 0, 0); break;
    case 1: planck3_set_node(idx(bx, by, bz), 160, a, 0, 0, 0);
            planck3_set_node(idx(cx, cy, cz), 40, 0, 0, 0, 0); break;
    case 2: planck3_set_node(idx(cx, cy, cz), 200, a, 0, 0, 0); break;
    case 3: planck3_set_node(idx(ax_, ay, az), 160, b, 0, 0, 0);
            planck3_set_node(idx(cx, cy, cz), 40, 0, 0, 0, 0); break;
    }
}

/* end-phase of a breather on axis a at (cx,cy,cz) */
static int phase_of_axis(int a, const Rec *st, int cx, int cy, int cz) {
    int b = BACK3[a], par = cy & 1;
    const Rec *c = &st[idx(cx, cy, cz)];
    const Rec *lb = &st[idx(cx + HOFF[par][b][0], cy + HOFF[par][b][1], cz + port_dz(b))];
    const Rec *la = &st[idx(cx + HOFF[par][a][0], cy + HOFF[par][a][1], cz + port_dz(a))];
    if (c->q >= 150 && (c->s & 15) == b) return 0;
    if (c->q >= 150 && (c->s & 15) == a) return 2;
    if (c->q < 100 && lb->q >= 100 && (lb->s & 15) == a) return 1;
    if (c->q < 100 && la->q >= 100 && (la->s & 15) == b) return 3;
    return -1;
}

int main(int argc, char **argv) {
    int ticks = argc > 1 ? atoi(argv[1]) : 200;
    int mode  = argc > 2 ? atoi(argv[2]) : 1;
    const char *ps = argc > 3 ? argv[3] : "000";

    int n = (mode == 0 || mode == 3 || mode == 4) ? 2
          : (mode == 2 ? 1 : (mode >= 6 ? 4 + (mode >= 7) : 3));
    int cores[5][3], ax[5], ph[5];
    if (mode == 2) {          /* solo breather, axis = first phase digit */
        cores[0][0] = 58; cores[0][1] = 19; cores[0][2] = 20;
        ax[0] = ps[0] - '0';
        ps = "0";
    } else if (mode == 0) {   /* corner pair, planar */
        cores[0][0] = 58; cores[0][1] = 20; cores[0][2] = 20; ax[0] = 1;
        cores[1][0] = 58; cores[1][1] = 19; cores[1][2] = 20; ax[1] = 2;
    } else if (mode == 3) {   /* tilted-axis dimer along 7/11 (climbs z) */
        cores[0][0] = 58; cores[0][1] = 20; cores[0][2] = 18; ax[0] = 7;
        cores[1][0] = 60; cores[1][1] = 20; cores[1][2] = 20; ax[1] = 7;
    } else if (mode == 4) {   /* planar diagonal dimer along 2/5 */
        cores[0][0] = 58; cores[0][1] = 20; cores[0][2] = 20; ax[0] = 2;
        cores[1][0] = 59; cores[1][1] = 22; cores[1][2] = 20; ax[1] = 2;
    } else if (mode == 5) {   /* tilted 3-chain climbing z=18,20,22 */
        cores[0][0] = 58; cores[0][1] = 20; cores[0][2] = 18; ax[0] = 7;
        cores[1][0] = 60; cores[1][1] = 20; cores[1][2] = 20; ax[1] = 7;
        cores[2][0] = 62; cores[2][1] = 20; cores[2][2] = 22; ax[2] = 7;
    } else if (mode == 6) {   /* ax7 3-chain + ax9 crossfire breather:
                               * its port-10 lobe lands on the chain's
                               * shared cell (59,20,19) */
        cores[0][0] = 58; cores[0][1] = 20; cores[0][2] = 18; ax[0] = 7;
        cores[1][0] = 60; cores[1][1] = 20; cores[1][2] = 20; ax[1] = 7;
        cores[2][0] = 62; cores[2][1] = 20; cores[2][2] = 22; ax[2] = 7;
        cores[3][0] = 58; cores[3][1] = 19; cores[3][2] = 20; ax[3] = 9;
    } else if (mode == 7) {   /* schedule braid: ax7 3-chain + ax9 DIMER
                               * threading the shared cell (59,20,19);
                               * ax9 cores (58,19,20)+(58,17,22) bond along
                               * the -y,+z climb */
        cores[0][0] = 58; cores[0][1] = 20; cores[0][2] = 18; ax[0] = 7;
        cores[1][0] = 60; cores[1][1] = 20; cores[1][2] = 20; ax[1] = 7;
        cores[2][0] = 62; cores[2][1] = 20; cores[2][2] = 22; ax[2] = 7;
        cores[3][0] = 58; cores[3][1] = 19; cores[3][2] = 20; ax[3] = 9;
        cores[4][0] = 58; cores[4][1] = 17; cores[4][2] = 22; ax[4] = 9;
    } else if (mode == 8) {   /* mixed braid: ax7 tilted 3-chain + ax1
                               * PLANAR dimer at z=19 sharing (59,20,19);
                               * planar bonds can use ph3 = tilted dead slot */
        cores[0][0] = 58; cores[0][1] = 20; cores[0][2] = 18; ax[0] = 7;
        cores[1][0] = 60; cores[1][1] = 20; cores[1][2] = 20; ax[1] = 7;
        cores[2][0] = 62; cores[2][1] = 20; cores[2][2] = 22; ax[2] = 7;
        cores[3][0] = 58; cores[3][1] = 20; cores[3][2] = 19; ax[3] = 1;
        cores[4][0] = 60; cores[4][1] = 20; cores[4][2] = 19; ax[4] = 1;
    } else {                  /* closed triangle */
        cores[0][0] = 58; cores[0][1] = 20; cores[0][2] = 20; ax[0] = 1;
        cores[1][0] = 58; cores[1][1] = 19; cores[1][2] = 20; ax[1] = 2;
        cores[2][0] = 57; cores[2][1] = 19; cores[2][2] = 20; ax[2] = 3;
    }
    for (int i = 0; i < n; i++) ph[i] = ps[i] ? ps[i] - '0' : 0;

    if (planck3_init_dims(W, H, D)) { fprintf(stderr, "init fail\n"); return 1; }
    planck3_set_mode(0);
    planck3_set_sync(1);
    planck3_set_temit(300);

    for (int i = 0; i < n; i++)
        seed_axis_breather(cores[i][0], cores[i][1], cores[i][2], ax[i], ph[i]);
    planck3_prepare();

    const Rec *st = (const Rec *)planck3_state_pointer();
    int64_t drained = 0;
    for (int t = 0; t <= ticks; t++) {
        /* drain plane at x=0 keeps wrap-around traffic from re-entering */
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

    printf("# mode=%d phases=%s t=%d |", mode, ps, ticks);
    for (int c = 0; c < n; c++) {
        int p = phase_of_axis(ax[c], st, cores[c][0], cores[c][1], cores[c][2]);
        const Rec *r = &st[idx(cores[c][0], cores[c][1], cores[c][2])];
        const char *v = p >= 0 ? "ALIVE" : (r->q >= 100 ? "LUMP" : "GONE");
        printf(" c%d:(%d,%d,%d)ax%d=%s(ph%d q%d)", c, cores[c][0], cores[c][1],
               cores[c][2], ax[c], v, p, r->q);
    }
    printf(" drained=%lld\n", (long long)drained);
    return 0;
}
