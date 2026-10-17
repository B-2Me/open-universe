/*
 * planck3_test.c — native test/bench driver for planck3.c (RFC-049).
 *
 *   planck3_test <state.bin> <ticks> [ref.bin]
 *
 * Loads a P3ST state dump (written by engine-sim.mjs `state` arg), runs
 * tick_flat3 and tick_chunk3 for <ticks> ticks each, byte-compares the
 * final quanta/spin/buffer/tension fields (heat is compared loosely —
 * the floor RNG differs from Math.random and never touches mass),
 * optionally compares against a JS-produced final-state dump, and times
 * both engines for the RFC-§3 cache-coherency benchmark.
 */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

int planck3_init_dims(int, int, int);
int planck3_set_mode(int);
void planck3_set_curl(int, int);
void planck3_set_trate(int);
void planck3_set_temit(int);
void planck3_set_recoil(int);
void planck3_set_split(int);
void planck3_set_split_duty(int);
int planck3_chunk_size(void);
void planck3_set_node(int32_t, int, int, int, int, int);
void planck3_prepare(void);
void planck3_collect(void);
void planck3_tick(void);
uint8_t *planck3_state_pointer(void);
int32_t planck3_node_count(void);
double planck3_total_quanta(void);
double planck3_deadlocked(void);

typedef struct { uint8_t q, s; uint16_t h; uint8_t b, tn; } Rec;

static Rec *load_state(const char *path, int32_t *n_out, int *dims_out) {
    FILE *f = fopen(path, "rb");
    if (!f) { fprintf(stderr, "open %s failed\n", path); exit(1); }
    uint8_t head[16];
    if (fread(head, 1, 16, f) != 16 || memcmp(head, "P3ST", 4)) {
        fprintf(stderr, "%s: bad magic\n", path); exit(1);
    }
    uint32_t w = *(uint32_t *)(head + 4), h = *(uint32_t *)(head + 8), d = *(uint32_t *)(head + 12);
    if (dims_out) { dims_out[0] = (int)w; dims_out[1] = (int)h; dims_out[2] = (int)d; }
    int32_t n = (int32_t)(w * h * d);
    uint8_t *q = malloc(n), *s = malloc(n), *b = malloc(n), *tn = malloc(n);
    uint16_t *hh = malloc(n * 2);
    fread(q, 1, n, f); fread(s, 1, n, f); fread(b, 1, n, f); fread(tn, 1, n, f); fread(hh, 2, n, f);
    fclose(f);
    Rec *r = malloc(n * sizeof(Rec));
    for (int32_t i = 0; i < n; i++) { r[i].q = q[i]; r[i].s = s[i]; r[i].b = b[i]; r[i].tn = tn[i]; r[i].h = hh[i]; }
    free(q); free(s); free(b); free(tn); free(hh);
    *n_out = n;
    return r;
}

static void inject(const Rec *r, int32_t n) {
    for (int32_t i = 0; i < n; i++) planck3_set_node(i, r[i].q, r[i].s, r[i].h, r[i].b, r[i].tn);
}

static Rec *snapshot(int32_t n) {
    uint8_t *p = planck3_state_pointer();
    Rec *r = malloc(n * sizeof(Rec));
    memcpy(r, p, n * sizeof(Rec));
    return r;
}

static double now_s(void) { return (double)clock() / CLOCKS_PER_SEC; }

int main(int argc, char **argv) {
    if (argc < 3) { fprintf(stderr, "usage: %s state.bin ticks [ref.bin]\n", argv[0]); return 1; }
    int32_t n;
    int dims[3] = {0, 0, 0}, rdims[3] = {0, 0, 0};
    Rec *init = load_state(argv[1], &n, dims);
    int ticks = atoi(argv[2]);
    Rec *ref = NULL;
    int32_t rn = 0;
    if (argc > 3) ref = load_state(argv[3], &rn, rdims);
    if (planck3_init_dims(dims[0], dims[1], dims[2]) != 0) { fprintf(stderr, "init_dims failed\n"); return 1; }
    if (n != planck3_node_count() || (ref && (rn != n || memcmp(dims, rdims, sizeof dims)))) {
        fprintf(stderr, "dim mismatch\n"); return 1;
    }
    if (planck3_chunk_size() == 0)
        printf("note: dims %dx%dx%d not chunk-divisible — chunked engines skipped\n",
               dims[0], dims[1], dims[2]);

    // +curl induction knobs via env: P3_CURL=<div> P3_CURLV=1
    {
        const char *cd = getenv("P3_CURL"), *cv = getenv("P3_CURLV");
        int div = cd ? atoi(cd) : 0, vac = cv ? atoi(cv) : 0;
        if (div || vac) printf("curl: div=%d vac=%d\n", div, vac);
        planck3_set_curl(div, vac);
        const char *tr = getenv("P3_TRATE");
        if (tr) { int r = atoi(tr); printf("trate: %d\n", r); planck3_set_trate(r); }
        const char *te = getenv("P3_TEMIT");
        if (te) { int m = atoi(te); printf("temit_min: %d\n", m); planck3_set_temit(m); }
        const char *rc = getenv("P3_RECOIL");
        if (rc) { int s = atoi(rc); printf("recoil: >>%d\n", s); planck3_set_recoil(s); }
        const char *sp = getenv("P3_SPLIT"), *sd = getenv("P3_SDUTY");
        if (sd) { int d = atoi(sd); printf("split_duty: %d/256\n", d); planck3_set_split_duty(d); }
        if (sp) { int s = atoi(sp); printf("split: >>%d\n", s); planck3_set_split(s); }
    }
    // --- flat run ---
    planck3_set_mode(0);
    inject(init, n); planck3_prepare();
    double t0 = now_s();
    for (int t = 0; t < ticks; t++) planck3_tick();
    double flat_s = now_s() - t0;
    Rec *flat = snapshot(n);
    printf("flat   %d ticks: totQ=%.0f dead=%.0f (%.3fs)\n",
           ticks, planck3_total_quanta(), planck3_deadlocked(), flat_s);

    int dif = -1, hdif = 0, hmax = 0, odif = -1;
    double chunk_s = 0, ord_s = 0;
    if (planck3_chunk_size() > 0) {
        // --- chunked run ---
        planck3_set_mode(1);
        inject(init, n); planck3_prepare();
        t0 = now_s();
        for (int t = 0; t < ticks; t++) planck3_tick();
        chunk_s = now_s() - t0;
        planck3_collect();
        Rec *chunk = snapshot(n);
        printf("chunk  %d ticks: totQ=%.0f dead=%.0f (%.3fs)\n",
               ticks, planck3_total_quanta(), planck3_deadlocked(), chunk_s);

        // --- ordered-chunk run (exact in all regimes) ---
        planck3_set_mode(2);
        inject(init, n); planck3_prepare();
        t0 = now_s();
        for (int t = 0; t < ticks; t++) planck3_tick();
        ord_s = now_s() - t0;
        planck3_collect();
        Rec *ord = snapshot(n);
        printf("ordchk %d ticks: totQ=%.0f dead=%.0f (%.3fs)\n",
               ticks, planck3_total_quanta(), planck3_deadlocked(), ord_s);

        // --- chunked vs flat: mass channels must be byte-identical ---
        dif = odif = 0;
        for (int32_t i = 0; i < n; i++) {
            if (flat[i].q != chunk[i].q || flat[i].s != chunk[i].s ||
                flat[i].b != chunk[i].b || flat[i].tn != chunk[i].tn) {
                if (dif < 10) printf("  DIFF cell %d: flat(%d,%d,%d,%d) chunk(%d,%d,%d,%d)\n",
                    i, flat[i].q, flat[i].s, flat[i].b, flat[i].tn,
                    chunk[i].q, chunk[i].s, chunk[i].b, chunk[i].tn);
                dif++;
            }
            int dh = abs((int)flat[i].h - (int)chunk[i].h);
            if (dh) { hdif++; if (dh > hmax) hmax = dh; }
            if (flat[i].q != ord[i].q || flat[i].s != ord[i].s ||
                flat[i].b != ord[i].b || flat[i].tn != ord[i].tn) odif++;
        }
        printf("chunk-vs-flat: %d mass-channel diffs, %d heat diffs (max %d)\n", dif, hdif, hmax);
        printf("ordchk-vs-flat: %d mass-channel diffs\n", odif);
    }

    // Optional final-state dump for offline census (P3_DUMP=path).
    {
        const char *dp = getenv("P3_DUMP");
        if (dp) {
            FILE *f = fopen(dp, "wb");
            if (f) {
                uint8_t head[16] = {'P', '3', 'S', 'T', 0,0,0,0, 0,0,0,0, 0,0,0,0};
                *(uint32_t *)(head + 4) = dims[0]; *(uint32_t *)(head + 8) = dims[1];
                *(uint32_t *)(head + 12) = dims[2];
                fwrite(head, 1, 16, f);
                for (int32_t i = 0; i < n; i++) fwrite(&flat[i].q, 1, 1, f);
                for (int32_t i = 0; i < n; i++) fwrite(&flat[i].s, 1, 1, f);
                for (int32_t i = 0; i < n; i++) fwrite(&flat[i].b, 1, 1, f);
                for (int32_t i = 0; i < n; i++) fwrite(&flat[i].tn, 1, 1, f);
                for (int32_t i = 0; i < n; i++) fwrite(&flat[i].h, 2, 1, f);
                fclose(f);
            }
        }
    }

    // --- vs JS final-state reference ---
    if (ref) {
        int rdif = 0, rhmax = 0;
        for (int32_t i = 0; i < n; i++) {
            if (flat[i].q != ref[i].q || flat[i].s != ref[i].s ||
                flat[i].b != ref[i].b || flat[i].tn != ref[i].tn) {
                if (rdif < 10) printf("  REF-DIFF cell %d: c(%d,%d,%d,%d) js(%d,%d,%d,%d)\n",
                    i, flat[i].q, flat[i].s, flat[i].b, flat[i].tn,
                    ref[i].q, ref[i].s, ref[i].b, ref[i].tn);
                rdif++;
            }
            int dh = abs((int)flat[i].h - (int)ref[i].h);
            if (dh > rhmax) rhmax = dh;
        }
        printf("flat-vs-js: %d mass-channel diffs, heat max diff %d\n", rdif, rhmax);
    }

    if (dif >= 0)
        printf("perf: flat %.3fs | halo %.3fs (%.2fx) | ordered %.3fs (%.2fx)\n",
               flat_s, chunk_s, flat_s / chunk_s, ord_s, flat_s / ord_s);
    else
        printf("perf: flat %.3fs (chunk modes unavailable on this grid)\n", flat_s);
    return 0;
}
