/* test_two.c — two-body interaction probe (M37)
 * Seeds two rest-channel lumps at separation d on the True-FCC lattice.
 * Unconditional slow radiation (fricm>0): each lump's boil-off acts as
 * the other's carrier beam — mutual ablation / attraction / merge test.
 *
 * usage: two <ticks> <sep> <mass/node> <fric> <fricm>
 *   sep    = x-separation between lump centers (must be even, >=4)
 *   mpn    = rest quanta seeded per node within r2<=8 of each center
 *   fric   = IFRIC transit-drag density cap
 *   fricm  = IFRICM boil mode (positive = unconditional 1/4k radiation)
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

static int NCH;
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

/* rest-mass centroid + total for the x-half indicated by sgn (+1: x>CX) */
static void lump_cm(int sgn, double *cx, double *cy, double *cz, uint64_t *mm) {
    double sx = 0, sy = 0, sz = 0; uint64_t m = 0;
    for (int z = 0; z < D; z++)
    for (int y = 0; y < H; y++)
    for (int x = 0; x < W; x++) {
        if (!isite(x, y, z)) continue;
        if (sgn > 0 && x <= CX) continue;
        if (sgn < 0 && x >= CX) continue;
        uint32_t v = meso3i_get(x, y, z, NCH - 1);
        sx += (double)v * x; sy += (double)v * y; sz += (double)v * z;
        m += v;
    }
    if (m) { *cx = sx / m; *cy = sy / m; *cz = sz / m; }
    else { *cx = *cy = *cz = -1; }
    *mm = m;
}

int main(int argc, char **argv) {
    int ticks = argc > 1 ? atoi(argv[1]) : 800;
    int sep   = argc > 2 ? atoi(argv[2]) : 8;
    int mpn   = argc > 3 ? atoi(argv[3]) : 30;
    int fric  = argc > 4 ? atoi(argv[4]) : 8;
    int fricm = argc > 5 ? atoi(argv[5]) : 8;

    if (meso3i_init(W, H, D, 1)) { fprintf(stderr, "init fail\n"); return 1; }
    NCH = meso3i_nch();
    meso3i_collmode(0);
    if (fric) meso3i_friction(fric);
    meso3i_fricmode(fricm);

    /* seed two rest lumps: every site within r2<=8 of each center gets mpn */
    int ax = CX - sep / 2, bx = CX + sep / 2;
    uint64_t seeded = 0;
    for (int z = 0; z < D; z++)
    for (int y = 0; y < H; y++)
    for (int x = 0; x < W; x++) {
        if (!isite(x, y, z)) continue;
        int da = (x - ax) * (x - ax) + (y - CY) * (y - CY) + (z - CZ) * (z - CZ);
        int db = (x - bx) * (x - bx) + (y - CY) * (y - CY) + (z - CZ) * (z - CZ);
        if (da <= 8 || db <= 8) {
            meso3i_set(x, y, z, NCH - 1, (uint8_t)mpn);
            seeded += mpn;
        }
    }

    printf("# two sep=%d mpn=%d fric=%d fricm=%d seeded=%llu t=%d\n",
           sep, mpn, fric, fricm, (unsigned long long)seeded, ticks);
    printf("# t | lumpA cm | mA | lumpB cm | mB | sep_now | movmass\n");
    for (int t = 0; t <= ticks; t++) {
        double ax_, ay_, az_, bx_, by_, bz_;
        uint64_t ma, mb;
        lump_cm(-1, &ax_, &ay_, &az_, &ma);
        lump_cm(+1, &bx_, &by_, &bz_, &mb);
        uint64_t mov = 0;
        for (int z = 0; z < D; z++)
        for (int y = 0; y < H; y++)
        for (int x = 0; x < W; x++) {
            if (!isite(x, y, z)) continue;
            for (int c = 0; c < NCH - 1; c++) mov += meso3i_get(x, y, z, c);
        }
        if (t % 50 == 0 || t == ticks) {
            double d = (ax_ >= 0 && bx_ >= 0) ? bx_ - ax_ : -1;
            printf("t=%4d | A(%5.2f,%5.2f,%5.2f) m=%4llu | B(%5.2f,%5.2f,%5.2f) m=%4llu | sep=%6.2f | mov=%llu\n",
                   t, ax_, ay_, az_, (unsigned long long)ma,
                   bx_, by_, bz_, (unsigned long long)mb, d,
                   (unsigned long long)mov);
        }
        drain_edge();
        if (t < ticks) meso3i_tick();
    }
    return 0;
}
