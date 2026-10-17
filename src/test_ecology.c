// test_ecology.c — M14: does the thermalized cavity spontaneously
// nucleate limit-cycle structures, or is all condensed mass dead lumps?
//
//   test_ecology <thermo_ticks> [window] [nbreather]
//   nbreather>0: before the hotspot, seed a 6-spaced grid of breathers
//   ((x,y,20):200,s4 bootstraps the tau=4 two-lobe cycle) at z=20 —
//   tests whether a dense resonator population survives flux and
//   reshapes the condensate (Planck Step 3).
//
// Same apparatus as M3: 40^3 closed box, central hotspot (r<5 ball,
// q=150, random spins, h=400), canonical defaults (tension ON — the
// honest ecology question is what the natural bath makes).
// After <thermo_ticks> equilibration, every cell's (q,s) is recorded
// for <window> ticks (default 24), then each cell is classified:
//   DEAD-LUMP : q>0, s=0 for the entire window
//   CYCLE     : (q,s) sequence repeats with period tau in {2..8}
//               over >=2 full periods at window end, >=1 state s!=0
//   TRANSIENT : occupied at some point, neither of the above
//   EMPTY     : never occupied
// Census = mass per class at final tick + per-tau histogram +
// connected-cluster decomposition of CYCLE cells (Chebyshev<=1 covers
// all 12 FCC ports).
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <inttypes.h>

int     planck3_init_dims(int, int, int);
int     planck3_set_mode(int);
void    planck3_set_sync(int);
void    planck3_set_node(int32_t, int, int, int, int, int);
void    planck3_prepare(void);
void    planck3_tick(void);
uint8_t *planck3_state_pointer(void);
int32_t planck3_node_count(void);

typedef struct { uint8_t q, s; uint16_t h; uint8_t b, tn; } Rec;

#define W 40
#define H 40
#define D 40
#define N (W * H * D)
#define MAXW 32

enum { CL_EMPTY, CL_LUMP, CL_CYCLE, CL_TRANS };

int main(int argc, char **argv) {
    int thermo = argc > 1 ? atoi(argv[1]) : 2000;
    int K      = argc > 2 ? atoi(argv[2]) : 24;
    int nbseed = argc > 3 ? atoi(argv[3]) : 0;
    if (K > MAXW) K = MAXW;

    if (planck3_init_dims(W, H, D)) { fprintf(stderr, "init_dims failed\n"); return 1; }
    planck3_set_mode(0);
    planck3_set_sync(1);

    uint32_t rng = 0xC0FFEE42u;
    for (int z = 0; z < D; z++) for (int y = 0; y < H; y++) for (int x = 0; x < W; x++) {
        int dx = x - 20, dy = y - 20, dz = z - 20;
        if (dx * dx + dy * dy + dz * dz < 25) {
            rng = rng * 1664525u + 1013904223u;
            planck3_set_node((z * H + y) * W + x, 150, 1 + (rng >> 16) % 12, 400, 0, 0);
        }
    }
    // optional breather population at z=20, 6-spaced grid (lobe-safe)
    int nseeded = 0;
    for (int gy = 6; gy < H && nseeded < nbseed; gy += 6)
        for (int gx = 6; gx < W && nseeded < nbseed; gx += 6, nseeded++)
            planck3_set_node((20 * H + gy) * W + gx, 200, 4, 0, 0, 0);
    planck3_prepare();
    printf("# test_ecology thermo=%d window=%d breathers_seeded=%d\n", thermo, K, nseeded);

    const Rec *st = (const Rec *)planck3_state_pointer();
    int32_t n = planck3_node_count();
    for (int t = 0; t < thermo; t++) planck3_tick();
    st = (const Rec *)planck3_state_pointer();

    // record (q,s) history for K ticks
    static uint16_t hist[N][MAXW];   // q | s<<8
    memset(hist, 0, sizeof hist);
    for (int t = 0; t < K; t++) {
        for (int32_t i = 0; i < n; i++) {
            const Rec *r = &st[i];
            hist[i][t] = (uint16_t)(r->q | (r->s << 8));
        }
        if (t < K - 1) { planck3_tick(); st = (const Rec *)planck3_state_pointer(); }
    }

    // per-cell classification
    static uint8_t cl[N], tau[N];
    int64_t massL = 0, massC = 0, massT = 0;
    int64_t cntL = 0, cntC = 0, cntT = 0;
    int tauHist[9] = {0};
    for (int32_t i = 0; i < n; i++) {
        int qEnd = st[i].q, everQ = 0, everS = 0, allDead = 1;
        for (int t = 0; t < K; t++) {
            int q = hist[i][t] & 0xFF, s = hist[i][t] >> 8;
            if (q) everQ = 1;
            if (s) everS = 1;
            if (!(q > 0 && s == 0)) allDead = 0;
        }
        if (!everQ && !everS) { cl[i] = CL_EMPTY; continue; }
        if (allDead)          { cl[i] = CL_LUMP;  massL += qEnd; cntL++; continue; }
        // periodicity: smallest tau with last 2*tau states pairwise equal
        cl[i] = CL_TRANS;
        for (int tp = 1; tp <= 8; tp++) {
            int ok = 1;
            for (int t = K - 2 * tp; t < K; t++)
                if (hist[i][t] != hist[i][t - tp]) { ok = 0; break; }
            if (ok && everS) { cl[i] = CL_CYCLE; tau[i] = tp; tauHist[tp]++;
                               massC += qEnd; cntC++; break; }
        }
        if (cl[i] == CL_TRANS) { massT += qEnd; cntT++; }
    }

    printf("# census:  cells  mass\n");
    printf("#   lump      %5lld  %6lld\n", (long long)cntL, (long long)massL);
    printf("#   cycle     %5lld  %6lld\n", (long long)cntC, (long long)massC);
    printf("#   transient %5lld  %6lld\n", (long long)cntT, (long long)massT);
    printf("# tau histogram: ");
    for (int tp = 1; tp <= 8; tp++) if (tauHist[tp]) printf("t%d=%d ", tp, tauHist[tp]);
    printf("\n");

    // cluster CYCLE cells (Chebyshev<=1) via flood fill
    static int comp[N];
    memset(comp, -1, sizeof comp);
    int nc = 0;
    static int stk[N]; int sp;
    for (int32_t i = 0; i < n; i++) {
        if (cl[i] != CL_CYCLE || comp[i] >= 0) continue;
        int64_t cm = 0; int cc = 0, taus = 0;
        sp = 0; stk[sp++] = i; comp[i] = nc;
        int minx = W, miny = H, minz = D, maxx = 0, maxy = 0, maxz = 0;
        while (sp) {
            int32_t j = stk[--sp];
            int jz = j / (H * W), jy = (j / W) % H, jx = j % W;
            cm += st[j].q; cc++; taus |= 1 << tau[j];
            if (jx < minx) minx = jx;
            if (jx > maxx) maxx = jx;
            if (jy < miny) miny = jy;
            if (jy > maxy) maxy = jy;
            if (jz < minz) minz = jz;
            if (jz > maxz) maxz = jz;
            for (int dz = -1; dz <= 1; dz++) for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
                int nx = jx + dx, ny = jy + dy, nz = jz + dz;
                if (nx < 0 || nx >= W || ny < 0 || ny >= H || nz < 0 || nz >= D) continue;
                int32_t ni = (nz * H + ny) * W + nx;
                if (cl[ni] == CL_CYCLE && comp[ni] < 0) { comp[ni] = nc; stk[sp++] = ni; }
            }
        }
        printf("#   cluster %d: cells=%d mass=%lld bbox=(%d..%d,%d..%d,%d..%d) taus=",
               nc, cc, (long long)cm, minx, maxx, miny, maxy, minz, maxz);
        for (int tp = 1; tp <= 8; tp++) if (taus & (1 << tp)) printf("%d ", tp);
        printf("\n");
        nc++;
    }
    printf("# total cycle clusters=%d\n", nc);

    // dump every CYCLE cell's spin set (which ports appear in its history)
    printf("# cycle-cell spin sets:\n");
    for (int32_t i = 0; i < n; i++) {
        if (cl[i] != CL_CYCLE) continue;
        int spins = 0;
        for (int t = 0; t < K; t++) spins |= 1 << (hist[i][t] >> 8);
        int iz = i / (H * W), iy = (i / W) % H, ix = i % W;
        printf("#   (%2d,%2d,%2d) tau=%d spins=", ix, iy, iz, tau[i]);
        for (int s = 0; s <= 12; s++) if (spins & (1 << s)) printf("%d ", s);
        printf("\n");
    }

    // Wild-dimer audit (M16 follow-up): a dimer is two tau=4 cores
    // 2 hops apart along one axis sharing the middle lobe cell.
    // Signature: middle cell is CYCLE and its spin history shows BOTH
    // directions of the axis (returns to each core). Port offsets are
    // parity-dependent hex-row offsets (mirrors planck3.c HOFF/ZU/ZD).
    static const int8_t HOFF_[2][7][2] = {
        {{0,0},{1,0},{0,1},{-1,1},{-1,0},{-1,-1},{0,-1}},
        {{0,0},{1,0},{1,1},{0,1},{-1,0},{0,-1},{1,-1}}
    };
    static const uint8_t ZU_[3] = {1, 3, 5}, ZD_[3] = {2, 4, 6};
    static const uint8_t BK[13] = {0, 4, 5, 6, 1, 2, 3, 11, 12, 10, 9, 7, 8};
    int ndimer = 0;
    for (int32_t i = 0; i < n; i++) {
        if (cl[i] != CL_CYCLE || tau[i] != 4) continue;
        int iz = i / (H * W), iy = (i / W) % H, ix = i % W;
        // core-like: fires BOTH directions of some axis (lobes carry one)
        int ispins = 0;
        for (int t = 0; t < K; t++) ispins |= 1 << (hist[i][t] >> 8);
        for (int p = 1; p <= 12; p++) {
            // hop 1: i -> m
            int px, py, pz;
            if (p <= 6)        { px = HOFF_[iy & 1][p][0];      py = HOFF_[iy & 1][p][1];      pz = 0; }
            else if (p <= 9)   { px = HOFF_[iy & 1][ZU_[p-7]][0]; py = HOFF_[iy & 1][ZU_[p-7]][1]; pz = 1; }
            else               { px = HOFF_[iy & 1][ZD_[p-10]][0]; py = HOFF_[iy & 1][ZD_[p-10]][1]; pz = -1; }
            int mx = ix + px, my = iy + py, mz = iz + pz;
            if (mx < 0 || mx >= W || my < 0 || my >= H || mz < 0 || mz >= D) continue;
            // hop 2: m -> j (parity of m's row)
            int px2, py2, pz2;
            if (p <= 6)        { px2 = HOFF_[my & 1][p][0];      py2 = HOFF_[my & 1][p][1];      pz2 = 0; }
            else if (p <= 9)   { px2 = HOFF_[my & 1][ZU_[p-7]][0]; py2 = HOFF_[my & 1][ZU_[p-7]][1]; pz2 = 1; }
            else               { px2 = HOFF_[my & 1][ZD_[p-10]][0]; py2 = HOFF_[my & 1][ZD_[p-10]][1]; pz2 = -1; }
            int jx = mx + px2, jy = my + py2, jz = mz + pz2;
            if (jx < 0 || jx >= W || jy < 0 || jy >= H || jz < 0 || jz >= D) continue;
            int32_t mi = (mz * H + my) * W + mx;
            int32_t ji = (jz * H + jy) * W + jx;
            if (cl[mi] != CL_CYCLE || cl[ji] != CL_CYCLE || tau[ji] != 4) continue;
            // endpoint j must be a real core: fires both axis directions
            int jspins = 0;
            for (int t = 0; t < K; t++) jspins |= 1 << (hist[ji][t] >> 8);
            if (!(jspins & (1 << p)) || !(jspins & (1 << BK[p]))) continue;
            // shared lobe m must carry both axis directions too
            int mspins = 0;
            for (int t = 0; t < K; t++) mspins |= 1 << (hist[mi][t] >> 8);
            if (!(mspins & (1 << p)) || !(mspins & (1 << BK[p]))) continue;
            // i itself must fire both directions of THIS axis
            if (!(ispins & (1 << p)) || !(ispins & (1 << BK[p]))) continue;
            printf("# DIMER? core (%d,%d,%d) -- lobe (%d,%d,%d) spins=%d,%d -- core (%d,%d,%d) port=%d\n",
                   ix, iy, iz, mx, my, mz, p, BK[p], jx, jy, jz, p);
            ndimer++;
        }
    }
    printf("# wild dimers found: %d\n", ndimer);
    return 0;
}
