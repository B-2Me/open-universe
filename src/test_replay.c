/* test_replay.c — frame recorder for the "life of a lump" replay (docs)
 * Runs the canonical M33/M35/M36 sequence under IFRIC + carrier-gated
 * boil-off and writes sparse JSON frames to stdout:
 *   t<200   isotropic 18-spoke drive (breathing core)
 *   200-600 quiet (carrier-gated freeze)
 *   600+    one-sided +x beam (ablation drift)
 * usage: replay <ticks> > lump-life.json
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
#define RAY 3
#define RATE 4

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
    int ticks = argc > 1 ? atoi(argv[1]) : 1200;
    int fstep = argc > 2 ? atoi(argv[2]) : 10;

    if (meso3i_init(W, H, D, 1)) { fprintf(stderr, "init fail\n"); return 1; }
    NCH = meso3i_nch(); NMOV = NCH - 1;
    meso3i_collmode(0);
    meso3i_friction(8);
    meso3i_fricmode(-4);        /* carrier-gated radiation */

    printf("{\"w\":%d,\"h\":%d,\"d\":%d,\"c\":[%d,%d,%d],"
           "\"phases\":[[\"drive\",0,200],[\"quiet\",200,600],[\"beam\",600,%d]],"
           "\"frames\":[", W, H, D, CX, CY, CZ, ticks);
    int first = 1;
    for (int t = 0; t <= ticks; t++) {
        if (t % fstep == 0 || t == ticks) {
            double cmx = 0, cmy = 0, cmz = 0; uint64_t cmm = 0;
            if (!first) printf(",");
            first = 0;
            printf("{\"t\":%d,\"v\":[", t);
            int fst = 1;
            for (int z = 0; z < D; z++)
            for (int y = 0; y < H; y++)
            for (int x = 0; x < W; x++) {
                if (!isite(x, y, z)) continue;
                int dx = x - CX, dy = y - CY, dz = z - CZ;
                if (dx * dx + dy * dy + dz * dz > 324) continue;  /* r<=18 ROI */
                uint32_t rest = meso3i_get(x, y, z, NCH - 1);
                uint32_t mov = 0;
                for (int c = 0; c < NMOV; c++) mov += meso3i_get(x, y, z, c);
                if (!rest && !mov) continue;
                if (!fst) printf(",");
                fst = 0;
                printf("%d,%d,%d,%u,%u", x, y, z, rest, mov);
                cmx += (double)rest * x; cmy += (double)rest * y;
                cmz += (double)rest * z; cmm += rest;
            }
            printf("],\"rc\":%s", cmm ? "[" : "null");
            if (cmm) printf("%.3f,%.3f,%.3f],\"rm\":%llu",
                            cmx / cmm, cmy / cmm, cmz / cmm,
                            (unsigned long long)cmm);
            printf("}");
        }
        /* drive */
        int drive = t < 200 || t >= 600;
        if (drive && t < ticks) {
            for (int c = 0; c < NMOV; c++) {
                if (t >= 600 && cv(c, 0) <= 0) continue;   /* beam phase: +x only */
                int sx = CX - RAY * cv(c, 0), sy = CY - RAY * cv(c, 1),
                    sz = CZ - RAY * cv(c, 2);
                for (int u = 0; u < RATE; u++)
                    meso3i_set(sx, sy, sz, c,
                               (uint8_t)(meso3i_get(sx, sy, sz, c) + 1));
            }
        }
        drain_edge();
        if (t < ticks) meso3i_tick();
    }
    printf("]}\n");
    return 0;
}
