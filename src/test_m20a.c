/* test_m20a.c — M20a offline combinatorial audit.
 *
 * Question: is the meso3i equal-sum pair-group move graph connected within
 * each (mass, momentum) class? States = compositions of m quanta over
 * NCH channels (3-bit packed occupancy in a u64). An edge replaces an
 * unordered occupied pair by any member of its equal-sum group (the same
 * move family meso3i's collision operator draws from).
 *
 * Verdict per class:
 *   1 component   → fully ergodic: every state thermalizes into the bath.
 *   >1 components → protected sectors exist: states unreachable from the
 *                   main component can never be eroded by this rule.
 *
 * build: gcc -O2 -Wall test_m20a.c -o /tmp/m20a && /tmp/m20a
 */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static const int8_t D12[12][3] = {
    { 1, 1,0},{-1,-1,0},{ 1,-1,0},{-1, 1,0},
    { 1,0, 1},{-1,0,-1},{ 1,0,-1},{-1,0, 1},
    {0, 1, 1},{0,-1,-1},{0, 1,-1},{0,-1, 1}
};
static const int8_t D6[6][3] = {
    {2,0,0},{-2,0,0},{0,2,0},{0,-2,0},{0,0,2},{0,0,-2}
};

static int NCH, NMOV;
static int CV[19][3];

/* pair groups (same construction as meso3i.c) */
static uint16_t GID[19][19];
static uint8_t  GPAIRS[400][2];
static uint16_t GOFF[300], GLEN[300];
static int      NGRP;

static void build_pairs(void) {
    NGRP = 0;
    memset(GID, 0xFF, sizeof GID);
    memset(GLEN, 0, sizeof GLEN);
    memset(GOFF, 0, sizeof GOFF);
    int8_t gsum[300][3];
    uint16_t cur[300] = {0};
    for (int i = 0; i < NCH; i++)
    for (int j = i; j < NCH; j++) {
        int sx = CV[i][0] + CV[j][0];
        int sy = CV[i][1] + CV[j][1];
        int sz = CV[i][2] + CV[j][2];
        int g = -1;
        for (int k = 0; k < NGRP; k++)
            if (gsum[k][0] == sx && gsum[k][1] == sy && gsum[k][2] == sz) { g = k; break; }
        if (g < 0) { g = NGRP++; gsum[g][0] = sx; gsum[g][1] = sy; gsum[g][2] = sz; }
        GID[i][j] = (uint16_t)g;
        GLEN[g]++;
    }
    GOFF[0] = 0;
    for (int g = 1; g < NGRP; g++) GOFF[g] = GOFF[g - 1] + GLEN[g - 1];
    for (int i = 0; i < NCH; i++)
    for (int j = i; j < NCH; j++) {
        int g = GID[i][j];
        int slot = GOFF[g] + cur[g]++;
        GPAIRS[slot][0] = (uint8_t)i;
        GPAIRS[slot][1] = (uint8_t)j;
    }
}

/* ---- state enumeration ------------------------------------------------ */

static uint64_t *states;      /* packed occupancy vectors */
static int      nstates;

static uint64_t pack(const int *n) {
    uint64_t s = 0;
    for (int c = 0; c < NCH; c++) s |= (uint64_t)n[c] << (3 * c);
    return s;
}
static void unpack(uint64_t s, int *n) {
    for (int c = 0; c < NCH; c++) { n[c] = s & 7; s >>= 3; }
}

static void gen(int pos, int rem, int *n) {
    if (pos == NCH - 1) {
        n[pos] = rem;
        states = realloc(states, sizeof(uint64_t) * (nstates + 1));
        states[nstates++] = pack(n);
        return;
    }
    for (int k = 0; k <= rem; k++) { n[pos] = k; gen(pos + 1, rem - k, n); }
    n[pos] = 0;
}

static int cmp_u64(const void *a, const void *b) {
    uint64_t x = *(const uint64_t *)a, y = *(const uint64_t *)b;
    return x < y ? -1 : (x > y);
}
static int sidx(uint64_t s) {
    int lo = 0, hi = nstates - 1;
    while (lo < hi) {
        int mid = (lo + hi) >> 1;
        if (states[mid] < s) lo = mid + 1; else hi = mid;
    }
    return states[lo] == s ? lo : -1;
}

/* ---- union-find over move edges ---------------------------------------- */

static int *uf;
static int ufind(int x) { while (uf[x] != x) { uf[x] = uf[uf[x]]; x = uf[x]; } return x; }
static void uunion(int a, int b) { uf[ufind(a)] = ufind(b); }

static void analyze_mass(int m, int axial) {
    NMOV = 12 + (axial ? 6 : 0);
    NCH = NMOV + 1;
    for (int c = 0; c < 12; c++) for (int k = 0; k < 3; k++) CV[c][k] = D12[c][k];
    for (int c = 0; c < 6;  c++) for (int k = 0; k < 3; k++) CV[12 + c][k] = D6[c][k];
    CV[NCH - 1][0] = CV[NCH - 1][1] = CV[NCH - 1][2] = 0;
    build_pairs();

    nstates = 0; states = NULL;
    int tmp[19] = {0};
    gen(0, m, tmp);
    qsort(states, nstates, sizeof(uint64_t), cmp_u64);

    /* class key per state */
    int64_t *ckey = malloc(sizeof(int64_t) * nstates);
    for (int i = 0; i < nstates; i++) {
        int n[19]; unpack(states[i], n);
        int px = 0, py = 0, pz = 0;
        for (int c = 0; c < NCH; c++) {
            px += n[c] * CV[c][0]; py += n[c] * CV[c][1]; pz += n[c] * CV[c][2];
        }
        ckey[i] = ((int64_t)(px + 32) << 14) | ((int64_t)(py + 32) << 7) | (pz + 32);
    }

    /* union all move edges */
    uf = malloc(sizeof(int) * nstates);
    for (int i = 0; i < nstates; i++) uf[i] = i;
    for (int i = 0; i < nstates; i++) {
        int n[19]; unpack(states[i], n);
        for (int a = 0; a < NCH; a++)
        for (int b = a; b < NCH; b++) {
            if (a == b ? n[a] < 2 : !(n[a] && n[b])) continue;
            int g = GID[a][b];
            for (int k = 0; k < GLEN[g]; k++) {
                int c = GPAIRS[GOFF[g] + k][0], d = GPAIRS[GOFF[g] + k][1];
                int n2[19]; memcpy(n2, n, sizeof n2);
                n2[a]--; n2[b]--; n2[c]++; n2[d]++;
                int j = sidx(pack(n2));
                if (j >= 0) uunion(i, j);
            }
        }
    }

    /* count components per class */
    int ncls = 0, multi = 0, comps = 0;
    int printed = 0;
    /* per-class: root of first-seen component set; count via scan */
    for (int i = 0; i < nstates; i++) {
        int seen = 0;
        for (int j = 0; j < i; j++) if (ckey[j] == ckey[i]) { seen = 1; break; }
        if (!seen) ncls++;
    }
    /* for each class, count distinct roots */
    for (int i = 0; i < nstates; i++) {
        int seen = 0;
        for (int j = 0; j < i; j++) if (ckey[j] == ckey[i]) { seen = 1; break; }
        if (seen) continue;
        int64_t key = ckey[i];
        int roots = 0, members = 0;
        for (int j = i; j < nstates; j++) {
            if (ckey[j] != key) continue;
            members++;
            if (ufind(j) == j) roots++;
        }
        comps += roots;
        if (roots > 1) {
            multi++;
            if (printed < 6) {
                int px = (int)(key >> 14) - 32;
                int py = (int)((key >> 7) & 0x7F) - 32;
                int pz = (int)(key & 0x7F) - 32;
                printf("    class m=%d p=(%d,%d,%d): %d states, %d components\n",
                       m, px, py, pz, members, roots);
                printed++;
            }
        }
    }
    printf("m=%d %s: %d states, %d momentum classes, %d components total, "
           "%d classes with protected sectors\n",
           m, axial ? "D3Q19" : "D3Q13", nstates, ncls, comps, multi);
    free(states); free(ckey); free(uf);
}

int main(void) {
    for (int axial = 0; axial <= 1; axial++)
        for (int m = 2; m <= 4; m++)
            analyze_mass(m, axial);
    return 0;
}
