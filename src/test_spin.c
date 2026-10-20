/* test_spin.c — structured lump probe (M38)
 * Can congestion trap MOVING mass into persistent internal circulation?
 * Seed a rest-mass blob (the M35 lump), then inject tangentially-aligned
 * moving quanta on a shell inside it. Track rest mass, trapped moving
 * mass, and net z-angular momentum of the moving population over time.
 *
 * usage: spin <ticks> <mpn> <spinpop> <fric> <fricm>
 *   mpn     = rest quanta seeded per node within r2<=8 of C
 *   spinpop = moving quanta seeded per node on the best tangent channel
 *   fric/fricm = transit drag cap / rest-inertia mode (0 = colliding rest)
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>

int      meso3i_init(int w, int h, int d, int axial);
void     meso3i_clear(void);
int      meso3i_nch(void);
void     meso3i_tick(void);
uint8_t  meso3i_get(int x, int y, int z, int c);
void     meso3i_set(int x, int y, int z, int c, uint8_t v);
void     meso3i_collmode(int);
void     meso3i_friction(int);
void     meso3i_fricmode(int);

#define W 44
#define H 44
#define D 44
#define EDGE 3
#define CX 22
#define CY 22
#define CZ 22

static int NMOV, NCH;
static const int8_t IDIR12[12][3] = {
    { 1, 1,0},{-1,-1,0},{ 1,-1,0},{-1, 1,0},
    { 1,0, 1},{-1,0,-1},{ 1,0,-1},{-1,0, 1},
    {0, 1, 1},{0,-1,-1},{0, 1,-1},{0,-1, 1}
};
static const int8_t IDIR6[6][3] = {
    {2,0,0},{-2,0,0},{0,2,0},{0,-2,0},{0,0,2},{0,0,-2}
};
static int cv(int c, int k) {
    if (c < 12) return IDIR12[c][k];
    if (c < 18) return IDIR6[c - 12][k];
    return 0;
}
static int isite(int x, int y, int z) { return ((x + y + z) & 1) == 0; }

static uint32_t node_mass(int x, int y, int z) {
    if (!isite(x, y, z)) return 0;
    uint32_t m = 0;
    for (int c = 0; c < NCH; c++) m += meso3i_get(x, y, z, c);
    return m;
}

static void drain_edge(void) {
    for (int z = 0; z < D; z++)
    for (int y = 0; y < H; y++)
    for (int x = 0; x < W; x++) {
        if (!isite(x, y, z)) continue;
        if (z >= EDGE && z < D - EDGE && x >= EDGE && x < W - EDGE &&
            y >= EDGE && y < H - EDGE) continue;
        for (int c = 0; c < NCH; c++) meso3i_set(x, y, z, c, 0);
    }
}

int main(int argc, char **argv) {
    int ticks  = argc > 1 ? atoi(argv[1]) : 600;
    int mpn    = argc > 2 ? atoi(argv[2]) : 60;
    int spinpop= argc > 3 ? atoi(argv[3]) : 4;
    int fric   = argc > 4 ? atoi(argv[4]) : 8;
    int fricm  = argc > 5 ? atoi(argv[5]) : -4;

    if (meso3i_init(W, H, D, 1)) { fprintf(stderr, "init fail\n"); return 1; }
    NCH = meso3i_nch(); NMOV = NCH - 1;
    meso3i_collmode(0);
    if (fric) meso3i_friction(fric);
    meso3i_fricmode(fricm);

    /* rest blob + tangential moving injection inside it */
    uint64_t seed_rest = 0, seed_mov = 0;
    for (int z = 0; z < D; z++)
    for (int y = 0; y < H; y++)
    for (int x = 0; x < W; x++) {
        if (!isite(x, y, z)) continue;
        int dx = x - CX, dy = y - CY, dz = z - CZ;
        int r2 = dx * dx + dy * dy + dz * dz;
        if (r2 <= 8) { meso3i_set(x, y, z, NCH - 1, (uint8_t)mpn); seed_rest += mpn; }
        /* tangential ring: shell inside blob, CCW around +z axis */
        if (r2 >= 4 && r2 <= 14 && dz == 0 && (dx || dy)) {
            int best = -1, bs = -1000;
            for (int c = 0; c < NMOV; c++) {
                int s = cv(c, 0) * (-dy) + cv(c, 1) * dx;  /* CCW alignment */
                if (s > bs) { bs = s; best = c; }
            }
            if (best >= 0 && bs > 0) {
                meso3i_set(x, y, z, best, (uint8_t)spinpop);
                seed_mov += spinpop;
            }
        }
    }

    printf("# spin mpn=%d spinpop=%d fric=%d fricm=%d rest=%llu mov=%llu t=%d\n",
           mpn, spinpop, fric, fricm,
           (unsigned long long)seed_rest, (unsigned long long)seed_mov, ticks);
    printf("# t | rest_lump | mov_lump | Lz | mov_far\n");
    for (int t = 0; t <= ticks; t++) {
        uint64_t rl = 0, ml = 0, mf = 0; long lz = 0;
        for (int z = 0; z < D; z++)
        for (int y = 0; y < H; y++)
        for (int x = 0; x < W; x++) {
            if (!isite(x, y, z)) continue;
            int dx = x - CX, dy = y - CY, dz = z - CZ;
            int r2 = dx * dx + dy * dy + dz * dz;
            uint32_t rest = meso3i_get(x, y, z, NCH - 1);
            uint32_t mov = node_mass(x, y, z) - rest;
            if (r2 <= 64) { rl += rest; ml += mov; }
            else mf += mov;
            for (int c = 0; c < NMOV; c++) {
                uint32_t v = meso3i_get(x, y, z, c);
                if (v) lz += (long)v * ((long)dx * cv(c, 1) - (long)dy * cv(c, 0));
            }
        }
        if (t % 25 == 0 || t == ticks)
            printf("t=%4d | rest=%5llu | movL=%5llu | Lz=%6ld | movF=%5llu\n",
                   t, (unsigned long long)rl, (unsigned long long)ml, lz,
                   (unsigned long long)mf);
        drain_edge();
        if (t < ticks) meso3i_tick();
    }
    return 0;
}
