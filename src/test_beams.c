// test_beams.c — converging-beam collision at a shared cell (M6).
// Two single-packet emitters placed by backward-walking a port ray from
// the crossing cell C, fired with arrival offset dt. Dumps every live
// cell near C per tick. Usage: test_beams <ticks> <geom> <dt> <qA> <qB>
//   geom: 0 = head-on (B arrives via port4), 1 = in-plane 60 deg (port2),
//         2 = vertical ~55 deg (port7)
//   dt: B fired at tick (NB - NA + dt); dt=0 -> simultaneous arrival.
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int     planck3_init_dims(int, int, int);
int     planck3_set_mode(int);
void    planck3_set_sync(int);
void    planck3_set_node(int32_t, int, int, int, int, int);
void    planck3_prepare(void);
void    planck3_tick(void);
uint8_t *planck3_state_pointer(void);

typedef struct { uint8_t q, s; uint16_t h; uint8_t b, tn; } Rec;

#define W 120
#define H 40
#define D 40
#define NA 15
#define NB 15

static const int8_t HOFF[2][7][2] = {
    {{0,0},{1,0},{0,1},{-1,1},{-1,0},{-1,-1},{0,-1}},
    {{0,0},{1,0},{1,1},{0,1},{-1,0},{0,-1},{1,-1}}
};
static const uint8_t ZU3[3] = {1, 3, 5};
static const uint8_t ZD3[3] = {2, 4, 6};

static void poff(int par, int d, int *dx, int *dy, int *dz) {
    if (d <= 6) { *dx = HOFF[par][d][0]; *dy = HOFF[par][d][1]; *dz = 0; }
    else if (d <= 9) { *dx = HOFF[par][ZU3[d - 7]][0]; *dy = HOFF[par][ZU3[d - 7]][1]; *dz = 1; }
    else { *dx = HOFF[par][ZD3[d - 10]][0]; *dy = HOFF[par][ZD3[d - 10]][1]; *dz = -1; }
}

// Step backward along port p from (x,y,z): find the predecessor cell
// whose spin-p fires into us. Verified by forward step.
static void back_step(int *x, int *y, int *z, int port) {
    int dx, dy, dz, bx = -999, by = -999, bz = -999;
    for (int par = 0; par < 2; par++) {
        poff(par, port, &dx, &dy, &dz);
        int cx = *x - dx, cy = *y - dy, cz = *z - dz;
        if ((cy & 1) != par) continue;
        if (cx + dx == *x && cy + dy == *y && cz + dz == *z) { bx = cx; by = cy; bz = cz; }
    }
    if (bx == -999 || bx < 0 || bx >= W || by < 0 || by >= H || bz < 0 || bz >= D) {
        fprintf(stderr, "back_step failed/off-grid at (%d,%d,%d) port %d\n", *x, *y, *z, port); exit(1);
    }
    *x = bx; *y = by; *z = bz;
}

int main(int argc, char **argv) {
    int ticks = argc > 1 ? atoi(argv[1]) : 60;
    int geom = argc > 2 ? atoi(argv[2]) : 0;
    int dt   = argc > 3 ? atoi(argv[3]) : 0;
    int qA   = argc > 4 ? atoi(argv[4]) : 159;
    int qB   = argc > 5 ? atoi(argv[5]) : 159;

    int bport = geom == 0 ? 4 : geom == 1 ? 2 : 7;
    const char *gname = geom == 0 ? "head-on(180)" : geom == 1 ? "in-plane(60)" : "vertical(~55)";

    if (planck3_init_dims(W, H, D)) { fprintf(stderr, "init_dims failed\n"); return 1; }
    planck3_set_mode(0);
    planck3_set_sync(1);

    int cx = 50, cy = 20, cz = 20;
    int ax = cx - NA, ay = cy, az = cz;            // A: port-1 ray, +x line
    int bx = cx, by = cy, bz = cz;                 // B: backward-walked ray
    for (int i = 0; i < NB; i++) back_step(&bx, &by, &bz, bport);
    int fireB = NB - NA + dt;                      // arrivals coincide at dt=0

    printf("# test_beams geom=%s dt=%d qA=%d qB=%d\n", gname, dt, qA, qB);
    printf("# C=(%d,%d,%d) A=(%d,%d,%d,p1) B=(%d,%d,%d,p%d) fireB=%d\n",
           cx, cy, cz, ax, ay, az, bx, by, bz, bport, fireB);

    const Rec *st = (const Rec *)planck3_state_pointer();
    for (int t = 0; t <= ticks; t++) {
        if (t == 0)     planck3_set_node((az * H + ay) * W + ax, qA, 1, 0, 0, 0);
        if (t == fireB) planck3_set_node((bz * H + by) * W + bx, qB, bport, 0, 0, 0);

        printf("t=%3d |", t);
        int n = 0;
        for (int z = cz - 6; z <= cz + 6 && z < D; z++)
            for (int y = cy - 8; y <= cy + 8 && y < H; y++)
                for (int x = cx - 30; x <= cx + 30 && x < W; x++) {
                    if (z < 0 || y < 0 || x < 0) continue;
                    const Rec *nd = &st[((size_t)z * H + y) * W + x];
                    if (nd->q > 0 || nd->b > 0) {
                        printf(" (%d,%d,%d):q%d,s%d,b%d", x, y, z, nd->q, nd->s, nd->b);
                        n++;
                    }
                }
        printf("  n=%d\n", n);
        if (t < ticks) planck3_tick();
        st = (const Rec *)planck3_state_pointer();
    }
    return 0;
}
