/*
 * test_cavity.c — M3 cavity equilibrium + spectral roll-off (Gemini brief).
 *
 *   test_cavity <ticks> [sync]
 *
 * 40^3 closed box. Central energy hotspot at t=0 (radius-4 ball of
 * q=150 cells with random spins + heat bath), stepped to equilibrium.
 * At the final tick the q(x) field is transformed by an EXACT separable
 * 3D DFT on the 40-point lattice (no padding: per-axis O(40^2) passes),
 * energy |F(k)|^2 binned radially in lattice wavenumber k = (pi/20)*|m|,
 * m folded to the first Brillouin zone (m <= 20).
 *
 * Prints thermodynamic snapshots every 250 ticks, then the E(k) table:
 *   k_bin_center  energy  mode_count  E/k^2 (equipartition = flat)
 * Equipartition E(k) ~ k^2 (DOS x const/mode); a blackbody-like cavity
 * shows roll-off vs the rising k^2 envelope.
 */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
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

int main(int argc, char **argv) {
    int ticks = argc > 1 ? atoi(argv[1]) : 5000;
    int sync  = argc > 2 ? atoi(argv[2]) : 1;
    const char *e = getenv("P3_SYNC");
    if (e) sync = atoi(e);

    if (planck3_init_dims(W, H, D)) { fprintf(stderr, "init_dims failed\n"); return 1; }
    planck3_set_mode(0);
    planck3_set_sync(sync);

    // Central hotspot: |r|<5 ball at the box center, q=150, random spins,
    // plus a heat jolt (h=400) to start the thermal bath.
    uint32_t rng = 0xC0FFEE42u;
    for (int z = 0; z < D; z++) for (int y = 0; y < H; y++) for (int x = 0; x < W; x++) {
        int dx = x - 20, dy = y - 20, dz = z - 20;
        if (dx * dx + dy * dy + dz * dz < 25) {
            rng = rng * 1664525u + 1013904223u;
            int s = 1 + (rng >> 16) % 12;
            planck3_set_node((z * H + y) * W + x, 150, s, 400, 0, 0);
        }
    }
    planck3_prepare();

    uint8_t *st = planck3_state_pointer();
    int32_t n = planck3_node_count();
    printf("# %dx%dx%d sync=%d ticks=%d  hotspot r<5 q=150 h=400\n", W, H, D, sync, ticks);
    printf("# t  sumQ  sumB  sumH  sumTN  live  meanH\n");

    for (int t = 0; t <= ticks; t++) {
        if (t % 250 == 0) {
            int64_t sQ = 0, sB = 0, sH = 0, sTN = 0, live = 0;
            for (int32_t i = 0; i < n; i++) {
                Rec *r = (Rec *)(st + (size_t)i * sizeof(Rec));
                sQ += r->q; sB += r->b; sH += r->h; sTN += r->tn;
                if (r->q) live++;
            }
            printf("%d %" PRId64 " %" PRId64 " %" PRId64 " %" PRId64 " %" PRId64 " %.2f\n",
                   t, sQ, sB, sH, sTN, live, (double)sH / n);
            fflush(stdout);
        }
        if (t < ticks) planck3_tick();
    }

    // --- Exact separable 3D DFT of q(x) on the 40-point lattice ---
    // Pass 1: x-axis. Pass 2: y on the x-spectrum. Pass 3: z.
    double *re = calloc(N, sizeof(double)), *im = calloc(N, sizeof(double));
    double *tr = calloc(N, sizeof(double)), *ti = calloc(N, sizeof(double));
    if (!re || !im || !tr || !ti) { fprintf(stderr, "oom\n"); return 1; }
    for (int32_t i = 0; i < n; i++) re[i] = ((Rec *)(st + (size_t)i * sizeof(Rec)))->q;

    const double PI2 = 6.2831853071795864769;
    // separable DFT-40 along each axis: out[a] = sum_x f(x) * e^{2pi i a x / 40}
    const int LEN[3] = {W, H, D};
    for (int ax = 0; ax < 3; ax++) {
        int L = LEN[ax];
        // strides: axis 0 (x) stride 1; axis 1 (y) stride W; axis 2 (z) stride W*H
        int stride = ax == 0 ? 1 : ax == 1 ? W : W * H;
        // iterate over all lines along this axis
        for (int32_t base = 0; base < N; base++) {
            // only start-of-line positions
            int coord = ax == 0 ? base % W : ax == 1 ? (base / W) % H : base / (W * H);
            if (coord != 0) continue;
            for (int k = 0; k < L; k++) {
                double sr = 0, si = 0;
                for (int x = 0; x < L; x++) {
                    double c = cos(PI2 * k * x / L), s = sin(PI2 * k * x / L);
                    double vr = re[base + x * stride], vi = im[base + x * stride];
                    sr += vr * c - vi * s;
                    si += vr * s + vi * c;
                }
                tr[base + k * stride] = sr;
                ti[base + k * stride] = si;
            }
        }
        memcpy(re, tr, N * sizeof(double)); memcpy(im, ti, N * sizeof(double));
    }

    // Radial energy binning: fold m > L/2 (negative frequencies).
    // E(mag) = sum |F|^2 over m-shells; report E vs k and E/k^2.
    double shellE[41] = {0}; int shellN[41] = {0};
    for (int mz = 0; mz < D; mz++) for (int my = 0; my < H; my++) for (int mx = 0; mx < W; mx++) {
        int fx = mx > W / 2 ? W - mx : mx;
        int fy = my > H / 2 ? H - my : my;
        int fz = mz > D / 2 ? D - mz : mz;
        int mag = (int)llrint(sqrt((double)(fx * fx + fy * fy + fz * fz)));
        if (mag > 40) mag = 40;
        int32_t i = (mz * H + my) * W + mx;
        shellE[mag] += re[i] * re[i] + im[i] * im[i];
        shellN[mag]++;
    }
    printf("# radial energy spectrum E(k), k = (pi/20)*|m|  (Nyquist k=pi at m=20):\n");
    printf("# |m|  k  modes  E  E/k^2\n");
    for (int m = 0; m <= 34; m++) {
        if (!shellN[m]) continue;
        double k = m * M_PI / 20.0;
        printf("%d %.4f %d %.6g %.6g\n", m, k, shellN[m], shellE[m],
               m ? shellE[m] / (k * k) : 0.0);
    }
    free(re); free(im); free(tr); free(ti);
    return 0;
}
