/* test_m20b.c — bounded offline probe: spin-ice combinatorics on the
 * diamond/pyrochlore channel set.
 *
 * Construction: diamond lattice on NC^3 cubic cells (4 quarter-units
 * per cell). A sites: all coords even, (x+y+z)%4==0.  B sites: all
 * coords odd, (x+y+z)%4==3.  A->B bonds via the 4 tetrahedral vectors
 * (+,+,+),(+,-,-),(-,+,-),(-,-,+).  Pyrochlore sites are the diamond
 * bond midpoints; a spin (1 bit) lives on each diamond bond, oriented
 * "in" at one end and "out" at the other.
 *
 * Ice rule: every diamond vertex has exactly 2 of its 4 bonds in.
 * Move family: flippable cycles — at every vertex of a diamond cycle
 * the two cycle edges must currently be one-in/one-out; toggling all
 * cycle edges then preserves the ice rule.
 *
 * Questions: (a) ice-rule state count vs Pauling ~(3/2)^V;
 *            (b) frozen fraction: states with no flippable cycle <=8;
 *            (c) union-find connectivity — components of the manifold.
 *
 * build: gcc -O2 -Wall test_m20b.c -o /tmp/m20b && /tmp/m20b
 */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define NC 2
#define L (4 * NC)

typedef unsigned __int128 st_t;

static int wrapi(int v) { v %= L; return v < 0 ? v + L : v; }
static int issite(int x, int y, int z, int par) {
    int s = (wrapi(x) + wrapi(y) + wrapi(z)) & 3;
    return par == 0
        ? ((x & 1) == 0 && (y & 1) == 0 && (z & 1) == 0 && s == 0)
        : ((x & 1) && (y & 1) && (z & 1) && s == 3);
}

static int NS, NB;
static int SID[8 * 8 * 8];
static int SX[128], SY[128], SZ[128], SPAR[128];
static const int ADIR[4][3] = {{1,1,1},{1,-1,-1},{-1,1,-1},{-1,-1,1}};

static int BOND[128][4];   /* incident bond id per site slot */
static int BDIR[128][4];   /* bond bit value that counts as "in" */
static int ADJ[128][4];    /* site adjacency */
static int ASITE[128 * 4], BSITE[128 * 4];

static void build(void) {
    memset(SID, 0xFF, sizeof SID);
    NS = 0;
    for (int z = 0; z < L; z++)
    for (int y = 0; y < L; y++)
    for (int x = 0; x < L; x++)
    for (int p = 0; p < 2; p++)
        if (issite(x, y, z, p)) {
            SID[x | (y << 3) | (z << 6)] = NS;
            SX[NS] = x; SY[NS] = y; SZ[NS] = z; SPAR[NS] = p;
            NS++;
        }
    memset(BOND, 0xFF, sizeof BOND);
    NB = 0;
    for (int i = 0; i < NS; i++) {
        if (SPAR[i] != 0) continue;
        for (int d = 0; d < 4; d++) {
            int bx = wrapi(SX[i] + ADIR[d][0]);
            int by = wrapi(SY[i] + ADIR[d][1]);
            int bz = wrapi(SZ[i] + ADIR[d][2]);
            int j = SID[bx | (by << 3) | (bz << 6)];
            if (j < 0) { printf("bond target missing\n"); exit(1); }
            int id = NB;                       /* sequential bond ids */
            BOND[i][d] = id; BDIR[i][d] = 1;            /* "in" at A end */
            for (int k = 0; k < 4; k++)
                if (BOND[j][k] == -1) { BOND[j][k] = id; BDIR[j][k] = 0; break; }
            ASITE[id] = i; BSITE[id] = j;
            NB++;
        }
    }
    printf("diamond: %d sites, %d bonds\n", NS, NB);
}

/* ---- ice-rule bookkeeping --------------------------------------------- */
static int VIN[128], VDONE[128];
static st_t   *sts;
static uint64_t nsts, ncnt;
static int     countonly, cap_hit;

static void collect(int bond, st_t st) {
    if (cap_hit) return;
    if (bond == NB) {
        ncnt++;
        if (countonly && ncnt > (1u << 21)) cap_hit = 1;   /* cap counting */
        if (!countonly) sts[nsts++] = st;
        return;
    }
    int a = ASITE[bond], b = BSITE[bond];
    for (int bit = 0; bit < 2; bit++) {
        int ain = bit, bin = !bit;
        VIN[a] += ain; VIN[b] += bin;
        VDONE[a]--; VDONE[b]--;
        int ok = VIN[a] <= 2 && VIN[a] + VDONE[a] >= 2 &&
                 VIN[b] <= 2 && VIN[b] + VDONE[b] >= 2;
        if (ok) collect(bond + 1, bit ? st | ((st_t)1 << bond) : st);
        VIN[a] -= ain; VIN[b] -= bin;
        VDONE[a]++; VDONE[b]++;
    }
}

/* ---- cycle enumeration ------------------------------------------------ */
#define CMAX 8
#define MAXCYC 8192
static int CYC[MAXCYC][CMAX], CYCLEN[MAXCYC], NCYC;

static void dfs_cyc(int start, int cur, int *path, int plen, char *vis) {
    for (int k = 0; k < 4; k++) {
        int nb = ADJ[cur][k];
        if (nb < start) continue;
        if (nb == start) {
            if (plen >= 6 && plen <= CMAX && NCYC < MAXCYC) {
                memcpy(CYC[NCYC], path, sizeof(int) * plen);
                CYCLEN[NCYC] = plen;
                NCYC++;
            }
            continue;
        }
        if (nb < 0 || vis[nb] || plen >= CMAX) continue;
        vis[nb] = 1; path[plen] = nb;
        dfs_cyc(start, nb, path, plen + 1, vis);
        vis[nb] = 0;
    }
}

static void find_cycles(void) {
    for (int i = 0; i < NS; i++)
        for (int k = 0; k < 4; k++) {
            int b = BOND[i][k];
            ADJ[i][k] = (ASITE[b] == i) ? BSITE[b] : ASITE[b];
        }
    int path[CMAX + 1];
    char vis[128];
    for (int s = 0; s < NS; s++) {
        memset(vis, 0, sizeof vis);
        vis[s] = 1; path[0] = s;
        dfs_cyc(s, s, path, 1, vis);
    }
    printf("simple cycles <=%d: %d\n", CMAX, NCYC);
}

/* flippable iff each vertex's two cycle edges are one-in/one-out */
static int flippable(st_t st, int c) {
    int len = CYCLEN[c];
    for (int i = 0; i < len; i++) {
        int v = CYC[c][i], pv = CYC[c][(i + len - 1) % len],
            nv = CYC[c][(i + 1) % len];
        int in = 0;
        for (int k = 0; k < 4; k++) {
            int nb = ADJ[v][k];
            if (nb != pv && nb != nv) continue;
            int bit = (int)((st >> BOND[v][k]) & 1);
            in += bit == BDIR[v][k];
        }
        if (in != 1) return 0;
    }
    return 1;
}

static st_t flip_state(st_t st, int c) {
    int len = CYCLEN[c];
    st_t mask = 0;
    for (int i = 0; i < len; i++) {
        int v = CYC[c][i], nv = CYC[c][(i + 1) % len];
        for (int k = 0; k < 4; k++)
            if (ADJ[v][k] == nv) { mask |= (st_t)1 << BOND[v][k]; break; }
    }
    return st ^ mask;
}

static int cmp_st(const void *a, const void *b) {
    st_t x = *(const st_t *)a, y = *(const st_t *)b;
    return x < y ? -1 : (x > y);
}
static int64_t sidx(st_t s) {
    int64_t lo = 0, hi = (int64_t)nsts - 1;
    while (lo < hi) {
        int64_t mid = (lo + hi) >> 1;
        if (sts[mid] < s) lo = mid + 1; else hi = mid;
    }
    return sts[lo] == s ? lo : -1;
}

/* ---- sampled probe for large manifolds -------------------------------- */
static uint32_t rng = 0x5EEDu;
static uint32_t rnd(void) {
    rng ^= rng << 13; rng ^= rng >> 17; rng ^= rng << 5; return rng;
}

/* random valid ice state via backtracking with random bit order */
static int rs_rec(int b, st_t *st) {
    if (b == NB) return 1;
    int a = ASITE[b], t = BSITE[b];
    int b0 = rnd() & 1;
    for (int o = 0; o < 2; o++) {
        int bit = o ? !b0 : b0;
        int ain = bit, bin = !bit;
        VIN[a] += ain; VIN[t] += bin;
        VDONE[a]--; VDONE[t]--;
        int ok = VIN[a] <= 2 && VIN[a] + VDONE[a] >= 2 &&
                 VIN[t] <= 2 && VIN[t] + VDONE[t] >= 2;
        if (ok) {
            if (bit) *st |= (st_t)1 << b;
            if (rs_rec(b + 1, st)) return 1;
            if (bit) *st &= ~((st_t)1 << b);
        }
        VIN[a] -= ain; VIN[t] -= bin;
        VDONE[a]++; VDONE[t]++;
    }
    return 0;
}

static void sampled_probe(void) {
    const int S = 300;
    int frozen = 0, ok = 0;
    for (int s = 0; s < S; s++) {
        st_t st = 0;
        memset(VIN, 0, sizeof VIN);
        for (int i = 0; i < NS; i++) VDONE[i] = 4;
        if (!rs_rec(0, &st)) continue;
        ok++;
        int f = 0;
        for (int c = 0; c < NCYC; c++) f += flippable(st, c);
        if (!f) frozen++;
    }
    printf("sampled probe: %d/%d valid states, %d frozen (%.1f%%)\n",
           ok, S, frozen, ok ? 100.0 * frozen / ok : 0.0);

    /* ergodicity: random flip walk from a seed, count distinct states */
    st_t st = 0;
    memset(VIN, 0, sizeof VIN);
    for (int i = 0; i < NS; i++) VDONE[i] = 4;
    if (!rs_rec(0, &st)) { printf("no valid seed\n"); return; }
    st_t *seen = malloc(sizeof(st_t) * 60000);
    int nseen = 0, steps = 0;
    for (int t = 0; t < 50000; t++) {
        int c = (int)(rnd() % NCYC);
        if (flippable(st, c)) { st = flip_state(st, c); steps++; }
        if (t % 5 == 0 && nseen < 60000) seen[nseen++] = st;
    }
    qsort(seen, nseen, sizeof(st_t), cmp_st);
    int distinct = nseen > 0;
    for (int i = 1; i < nseen; i++) if (seen[i] != seen[i - 1]) distinct++;
    printf("random-walk: %d flips in 50k attempts, %d distinct states "
           "visited of %d sampled\n", steps, distinct, nseen);
    free(seen);
}

int main(void) {
    build();
    find_cycles();
    for (int i = 0; i < NS; i++) { VIN[i] = 0; VDONE[i] = 4; }

    /* count-only pass first (manifold may be astronomically large) */
    countonly = 1; ncnt = 0; cap_hit = 0;
    collect(0, 0);
    printf("ice-rule states (%s): %s%llu (V=%d diamond sites)\n",
           cap_hit ? "capped" : "exact count", cap_hit ? ">" : "",
           (unsigned long long)ncnt, NS);
    if (cap_hit || ncnt > (1u << 21)) {
        printf("manifold >2M states — switching to sampled probe\n");
        sampled_probe();
        return 0;
    }
    sts = malloc(sizeof(st_t) * (ncnt ? ncnt : 1));
    countonly = 0; nsts = 0; ncnt = 0;
    collect(0, 0);
    qsort(sts, nsts, sizeof(st_t), cmp_st);
    printf("ice-rule states: %llu (V=%d diamond sites) -> per-vertex "
           "degeneracy factor %.4f (Pauling ~1.5)\n",
           (unsigned long long)nsts, NS,
           pow((double)nsts, 1.0 / NS));

    int *uf = malloc(sizeof(int) * nsts);
    for (uint64_t i = 0; i < nsts; i++) uf[i] = (int)i;
    uint64_t frozen = 0;
    for (uint64_t i = 0; i < nsts; i++) {
        int any = 0;
        for (int c = 0; c < NCYC; c++) {
            if (!flippable(sts[i], c)) continue;
            any = 1;
            int64_t j = sidx(flip_state(sts[i], c));
            if (j >= 0) {
                int ra = (int)i, rb = (int)j;
                while (uf[ra] != ra) { uf[ra] = uf[uf[ra]]; ra = uf[ra]; }
                while (uf[rb] != rb) { uf[rb] = uf[uf[rb]]; rb = uf[rb]; }
                uf[ra] = rb;
            }
        }
        if (!any) frozen++;
    }
    int comps = 0;
    for (uint64_t i = 0; i < nsts; i++) {
        int r = (int)i;
        while (uf[r] != r) { uf[r] = uf[uf[r]]; r = uf[r]; }
        if (r == (int)i) comps++;
    }
    printf("ice states=%llu: %d components, %llu frozen (%.1f%%)\n",
           (unsigned long long)nsts, comps,
           (unsigned long long)frozen, 100.0 * frozen / nsts);
    return 0;
}
