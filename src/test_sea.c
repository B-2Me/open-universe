// test_sea — ambient ground-state sea probe (Direction 1, macro critique).
// Dead vacuum (q=0) vs active sea: does low-level background flux change
// what a bound mass does?
//
// metrics per tick:
//   sea mass (whole grid), halo mass in radial shells r=1..8 around the
//   breather, breather survival verdict, drained mass at x=0.
//
// usage: sea <ticks> <mode> [sea_density_pct]
//   mode 0: breather alone (dead-vacuum control)
//   mode 1: sea alone (no breather — sea lifetime)
//   mode 2: breather + sea
//   density_pct: each cell gets q=1..3 with probability pct/100
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

#define W 120
#define H 40
#define D 40
#define CX 60
#define CY 20
#define CZ 20
#define RMAX 8

typedef struct { uint8_t q, s; uint16_t h; uint8_t b, tn; } Rec;
static int idx(int x, int y, int z) { return (z * H + y) * W + x; }

/* deterministic hash -> 0..255 (matches engine's deterministic-rng spirit) */
static uint32_t h32(uint32_t v) {
    v ^= v >> 16; v *= 0x7feb352d; v ^= v >> 15; v *= 0x846ca68b; v ^= v >> 16;
    return v;
}

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

int main(int argc, char **argv) {
    int ticks = argc > 1 ? atoi(argv[1]) : 300;
    int mode  = argc > 2 ? atoi(argv[2]) : 2;
    int dens  = argc > 3 ? atoi(argv[3]) : 40;   /* % cells occupied */

    if (planck3_init_dims(W, H, D)) { fprintf(stderr, "init fail\n"); return 1; }
    planck3_set_mode(0);
    planck3_set_sync(1);
    planck3_set_temit(300);

    /* ambient sea: hash-sprinkled q=1..3, isotropic random spins.
     * keep the breather footprint + drain plane clean. */
    if (mode >= 1) {
        for (int z = 0; z < D; z++)
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++) {
                    if (x < 2) continue;               /* drain column */
                    int dx = x - CX, dy = y - CY, dz = z - CZ;
                    if (dx * dx + dy * dy + dz * dz <= 4) continue;
                    uint32_t r = h32((uint32_t)idx(x, y, z) ^ 0x9e3779b9u);
                    if ((r & 255) < (uint32_t)(dens * 256 / 100)) {
                        int q = 1 + ((r >> 8) & 3);
                        int s = 1 + ((r >> 16) % 12);
                        planck3_set_node(idx(x, y, z), q, s, 0, 0, 0);
                    }
                }
    }
    if (mode != 1) seed_breather(CX, 0);
    planck3_prepare();

    const Rec *st = (const Rec *)planck3_state_pointer();
    int64_t drained = 0;
    printf("# sea mode=%d dens=%d%% t=%d\n", mode, dens, ticks);
    printf("# t | sea_mass | halo r1..r8 | breather\n");
    for (int t = 0; t <= ticks; t++) {
        int64_t sea = 0;
        int halo[RMAX + 1];
        memset(halo, 0, sizeof halo);
        for (int z = 0; z < D; z++)
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++) {
                    const Rec *r = &st[idx(x, y, z)];
                    int m = r->q + r->b;
                    sea += m;
                    int dx = x - CX, dy = y - CY, dz = z - CZ;
                    int d2 = dx * dx + dy * dy + dz * dz;
                    for (int s = 1; s <= RMAX; s++)
                        if (d2 >= s * s && d2 < (s + 1) * (s + 1)) {
                            halo[s] += m; break;
                        }
                }
        const Rec *c = &st[idx(CX, CY, CZ)];
        const char *v = c->q >= 150 ? "ALIVE" : (c->q ? "LOW" : "DEAD");
        if (t % 25 == 0 || t == ticks)
            printf("t=%3d | %7lld | %d %d %d %d %d %d %d %d | %s(q%d)\n",
                   t, (long long)sea,
                   halo[1], halo[2], halo[3], halo[4],
                   halo[5], halo[6], halo[7], halo[8], v, c->q);
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
