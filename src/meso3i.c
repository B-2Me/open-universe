/* meso3i.c — M19b: integer-occupancy multi-channel lattice gas (True-FCC).
 *
 * Same even-parity FCC sublattice and channel set as meso3.c, but each
 * channel holds a uint8 population (multi-quantum, Maxwell-Boltzmann-
 * class statistics) instead of a Boolean bit.
 *
 * Collision operator: procedural pair-group shuffle. All unordered pairs
 * {i,j} (i <= j, doubles and rest included) are grouped at init by the
 * sum vector c_i + c_j. A collision picks two random quanta from the
 * node, looks up their pair's equal-sum group, and replaces them with a
 * selected member pair — mass and momentum conserved exactly per move.
 * This covers balanced head-on swaps, axial<->face coupling
 * ({(1,1,0),(1,-1,0)} <-> {(2,0,0),rest}), face triangulations, and
 * rest-channel exchange in a single uniform rule.
 *
 * Modes: 0 uniform member pick, 1 shell-weighted (pair weight (1/8) per
 * axial member), 2 forward-bias (7/8 keep the input pair).
 */
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

static const int8_t IDIR12[12][3] = {
    { 1, 1,0},{-1,-1,0},{ 1,-1,0},{-1, 1,0},
    { 1,0, 1},{-1,0,-1},{ 1,0,-1},{-1,0, 1},
    {0, 1, 1},{0,-1,-1},{0, 1,-1},{0,-1, 1}
};
static const int8_t IDIR6[6][3] = {
    {2,0,0},{-2,0,0},{0,2,0},{0,-2,0},{0,0,2},{0,0,-2}
};

static int      IW, IH, ID, IN;
static int      INCH, IMOV;          /* channels incl rest; moving chans */
static uint8_t *iA, *iB;             /* site-major: [site*INCH + c] */
static int      ICV[19][3];

/* edge dwell: per-(site,channel) delay line, stage j = delivers in j+1 ticks.
 * A quantum streamed with DWELL=k enters stage k-1 and reaches the
 * destination node after k ticks -> effective channel velocity v = 1/k.
 * DWELL=1 bypasses the buffer (direct stream, v=1). */
#define IKMAX 4
static int      DWELL = 1;
static uint16_t *iD;                 /* [site][NMOV][IKMAX] */

static int      IMODE;
static int      IGATE;               /* rho_crit for planar gating; 0=off */
static int      IBIAS;               /* density-gradient weight strength */
static int      IRSAT = 8;           /* tent cap: density where pull cuts off */
static int      ICOND;               /* rest-condensation ratchet strength */
static uint8_t *iQ;                  /* per-site core register (Path A) */
static int      IQMODE;              /* 0 off, 1 condense, 2 +tau emit, 3 +dir */
static int      IDIR = -1;           /* directed emission channel (mode 3) */
static int      IFLD;                /* external-field weight strength */
static int      IFV[3];              /* field vector (components -1,0,+1) */
static int      IQCAP;               /* Q overflow capacity (mode>=5) */
static uint8_t *iPH;                 /* per-site phase offset 0..3 (mode 6) */
static int      ITICK;               /* global tick counter for the clock */
static uint32_t *iR;                 /* pre-collision per-site mass map */
static int      INPAIR;              /* unordered pairs incl doubles */
static uint16_t GID[19][19];         /* group id for pair (i<=j) */
static uint8_t  GPAIRS[400][2];
static uint16_t GWGT[400];
static uint16_t GOFF[300], GLEN[300];
static int      NGRP;

static uint32_t irng = 0xC0FFEEu;
static inline uint32_t irnd(void) {
    irng ^= irng << 13; irng ^= irng >> 17; irng ^= irng << 5;
    return irng;
}

static inline int isite(int x, int y, int z) { return ((x + y + z) & 1) == 0; }
static inline int iidx(int x, int y, int z)  { return (z * IH + y) * IW + x; }
static inline int iwrap(int v, int n)        { v %= n; return v < 0 ? v + n : v; }

static void build_pairs(void) {
    NGRP = 0; INPAIR = 0;
    memset(GID, 0xFF, sizeof GID);
    memset(GLEN, 0, sizeof GLEN);
    memset(GOFF, 0, sizeof GOFF);
    int8_t gsum[300][3];
    uint16_t cur[300] = {0};
    /* pass 1: count members per equal-sum group */
    for (int i = 0; i < INCH; i++)
    for (int j = i; j < INCH; j++) {
        int sx = ICV[i][0] + ICV[j][0];
        int sy = ICV[i][1] + ICV[j][1];
        int sz = ICV[i][2] + ICV[j][2];
        int g = -1;
        for (int k = 0; k < NGRP; k++)
            if (gsum[k][0] == sx && gsum[k][1] == sy && gsum[k][2] == sz) { g = k; break; }
        if (g < 0) { g = NGRP++; gsum[g][0] = sx; gsum[g][1] = sy; gsum[g][2] = sz; }
        GID[i][j] = (uint8_t)g;
        GLEN[g]++; INPAIR++;
    }
    GOFF[0] = 0;
    for (int g = 1; g < NGRP; g++) GOFF[g] = GOFF[g - 1] + GLEN[g - 1];
    /* pass 2: place each pair into its group's contiguous run */
    for (int i = 0; i < INCH; i++)
    for (int j = i; j < INCH; j++) {
        int g = GID[i][j];
        int slot = GOFF[g] + cur[g]++;
        GPAIRS[slot][0] = (uint8_t)i;
        GPAIRS[slot][1] = (uint8_t)j;
        int na = (i >= 12 && i < IMOV) + (j >= 12 && j < IMOV);
        GWGT[slot] = (uint16_t)(na > 2 ? 1 : (256 >> (3 * na)));
    }
}

int meso3i_init(int w, int h, int d, int axial) {
    if ((w | h | d) & 1) return -1;
    IW = w; IH = h; ID = d; IN = w * h * d;
    IMOV = 12 + (axial ? 6 : 0);
    INCH = IMOV + 1;
    for (int c = 0; c < 12; c++) for (int k = 0; k < 3; k++) ICV[c][k] = IDIR12[c][k];
    for (int c = 0; c < 6;  c++) for (int k = 0; k < 3; k++) ICV[12 + c][k] = IDIR6[c][k];
    ICV[INCH - 1][0] = ICV[INCH - 1][1] = ICV[INCH - 1][2] = 0;
    iA = calloc((size_t)IN * INCH, 1);
    iB = calloc((size_t)IN * INCH, 1);
    iD = calloc((size_t)IN * 18 * IKMAX, sizeof(uint16_t));
    iR = malloc((size_t)IN * sizeof(uint32_t));
    iQ = calloc((size_t)IN, 1);
    iPH = calloc((size_t)IN, 1);
    if (!iA || !iB || !iD || !iR || !iQ || !iPH) return -2;
    build_pairs();
    return 0;
}

void meso3i_clear(void) {
    memset(iA, 0, (size_t)IN * INCH);
    memset(iD, 0, (size_t)IN * 18 * IKMAX * sizeof(uint16_t));
    memset(iQ, 0, (size_t)IN);
    memset(iPH, 0, (size_t)IN);
    ITICK = 0;
}
void meso3i_collmode(int m) { IMODE = m; }
void meso3i_dwell(int k) { DWELL = k < 1 ? 1 : (k > IKMAX ? IKMAX : k); }
void meso3i_gate(int crit) { IGATE = crit; IRSAT = crit ? 2 * crit : 8; }
void meso3i_bias(int b) { IBIAS = b; }
void meso3i_condense(int c) { ICOND = c; }
void meso3i_qmode(int m) { IQMODE = m; }
void meso3i_qdir(int c) { IDIR = c; }
void meso3i_field(int fx, int fy, int fz, int f) {
    IFV[0] = fx; IFV[1] = fy; IFV[2] = fz; IFLD = f;
}
void meso3i_qcap(int c) { IQCAP = c; }
void meso3i_pset(int x, int y, int z, uint8_t v) {
    x = iwrap(x, IW); y = iwrap(y, IH); z = iwrap(z, ID);
    if (isite(x, y, z)) iPH[iidx(x, y, z)] = v & 3;
}

/* mode>=4 capture: unconditionally at Q>0 nodes for modes 4-5; mode 6
 * is phase-gated — a node captures arriving flux into Q only during its
 * receptive beat (stream-phase clock (ITICK+iPH)&3 == 2, one beat after
 * an upstream emitter's beat-0 at the same global tick when phi ~ x). */
static int qcapture(int ni) {
    if (IQMODE < 4) return 0;
    if (IQMODE >= 6) return ((ITICK + iPH[ni]) & 3) == 2;
    return iQ[ni] > 0;
}
uint8_t meso3i_qget(int x, int y, int z) {
    return iQ[iidx(iwrap(x, IW), iwrap(y, IH), iwrap(z, ID))];
}
void meso3i_qset(int x, int y, int z, uint8_t v) {
    x = iwrap(x, IW); y = iwrap(y, IH); z = iwrap(z, ID);
    if (isite(x, y, z)) iQ[iidx(x, y, z)] = v;
}

/* saturation-tent attraction: linear pull up to IRSAT, zero beyond —
 * inward pressure at the domain wall, hard repulsion against runaway */
static int atti(uint32_t r) { return (int)(r > (uint32_t)IRSAT ? 0 : r); }

/* coordinate planes containing channel c: bit0=xy, bit1=xz, bit2=yz.
 * A channel lies in a coordinate plane iff its orthogonal component
 * is zero — axial channels thus get two-plane masks. */
static int ipmask(int c) {
    if (c == INCH - 1) return 7;            /* rest: all planes */
    int x = ICV[c][0], y = ICV[c][1], z = ICV[c][2];
    return (!z ? 1 : 0) | (!y ? 2 : 0) | (!x ? 4 : 0);
}

uint8_t meso3i_get(int x, int y, int z, int c) {
    return iA[iidx(iwrap(x, IW), iwrap(y, IH), iwrap(z, ID)) * INCH + c];
}
/* in-flight population on the edge leaving site (x,y,z) along channel c */
uint32_t meso3i_edge(int x, int y, int z, int c) {
    if (c >= IMOV) return 0;
    const uint16_t *ed = iD + (size_t)iidx(iwrap(x, IW), iwrap(y, IH), iwrap(z, ID)) * IMOV * IKMAX;
    uint32_t n = 0;
    for (int j = 0; j < IKMAX; j++) n += ed[c * IKMAX + j];
    return n;
}
void meso3i_set(int x, int y, int z, int c, uint8_t v) {
    x = iwrap(x, IW); y = iwrap(y, IH); z = iwrap(z, ID);
    if (isite(x, y, z)) iA[iidx(x, y, z) * INCH + c] = v;
}

/* pick channel of the r-th quantum (0-based) in occupied-channel order */
static int pick_chan(const uint8_t *n, int r, int skip) {
    for (int c = 0; c < INCH; c++) {
        int cnt = n[c] - (c == skip);
        if (cnt <= 0) continue;
        if (r < cnt) return c;
        r -= cnt;
    }
    return -1;
}

static void collide_node(uint8_t *n, int si) {
    int m = 0;
    for (int c = 0; c < INCH; c++) m += n[c];
    if (m < 2) return;
    int attempts = (IBIAS || IFLD) ? m : m >> 1;   /* weighted: full coverage */
    if (!attempts) attempts = 1;
    int x = si % IW, y = (si / IW) % IH, z = si / (IW * IH);
    for (int a = 0; a < attempts; a++) {
        int i = pick_chan(n, irnd() % m, -1);
        int j = pick_chan(n, irnd() % (m - 1), i);
        if (i < 0 || j < 0) continue;
        int lo = i < j ? i : j, hi = i < j ? j : i;
        /* Q condensation: at gated nodes an antipodal pair {c,-c} may
         * convert to core mass (Q is outside the collision move family —
         * the ratchet the rest channel lacked) */
        if (IQMODE && i != j && ICV[i][0] + ICV[j][0] == 0 &&
            ICV[i][1] + ICV[j][1] == 0 && ICV[i][2] + ICV[j][2] == 0 &&
            (!IGATE || m >= IGATE) && irnd() % 2 == 0) {
            n[i]--; n[j]--;
            uint32_t q = iQ[si] + 2;
            iQ[si] = q > 255 ? 255 : (uint8_t)q;
            continue;
        }
        int g = GID[lo][hi];
        int len = GLEN[g];
        if (len <= 1) continue;
        int ko, lo2;
        if (IGATE && m >= IGATE) {
            /* planar-circulation subfamily gated at rho>=crit; output
             * members weighted by density-gradient attraction (tent
             * capped at 2*crit) toward each member's destinations —
             * the discrete surface-tension analog */
            int pm = ipmask(lo) & ipmask(hi);
            uint32_t wtot = 0, wgt[200];
            int ok[200], nok = 0;
            for (int k = 0; k < len; k++) {
                int c2 = GPAIRS[GOFF[g] + k][0], d2 = GPAIRS[GOFF[g] + k][1];
                if (!(pm & ipmask(c2) & ipmask(d2))) continue;
                uint32_t w = 1;
                if (IBIAS || IFLD) {
                    for (int q = 0; q < 2; q++) {
                        int cc = q ? d2 : c2;
                        if (cc == INCH - 1) { w += IBIAS * atti(iR[si]); continue; }
                        if (IBIAS) {
                            int ni = iidx(iwrap(x + ICV[cc][0], IW),
                                          iwrap(y + ICV[cc][1], IH),
                                          iwrap(z + ICV[cc][2], ID));
                            w += IBIAS * atti(iR[ni]);
                        }
                        if (IFLD) {   /* external field: boost field-aligned
                                       * members — momentum injected, flagged */
                            int dt = ICV[cc][0] * IFV[0] + ICV[cc][1] * IFV[1]
                                   + ICV[cc][2] * IFV[2];
                            if (dt > 0) w += IFLD * dt;
                        }
                    }
                }
                if (ICOND && (c2 == INCH - 1 || d2 == INCH - 1))
                    w += ICOND * atti(iR[si]);   /* rest-output ratchet */
                ok[nok] = k; wgt[nok] = w; wtot += w; nok++;
            }
            if (!nok) continue;
            uint32_t r = irnd() % wtot;
            int pick = 0;
            while (pick < nok - 1 && r >= wgt[pick]) { r -= wgt[pick]; pick++; }
            int k = ok[pick];
            ko = GPAIRS[GOFF[g] + k][0]; lo2 = GPAIRS[GOFF[g] + k][1];
        } else if (IBIAS || IFLD) {
            /* ungated node in weighted regime: the domain wall acts on the
             * bath side too — weight ALL group members by gradient pull
             * and/or external-field alignment */
            uint32_t wtot = 0, wgt[200];
            for (int k = 0; k < len; k++) {
                int c2 = GPAIRS[GOFF[g] + k][0], d2 = GPAIRS[GOFF[g] + k][1];
                uint32_t w = 1;
                for (int q = 0; q < 2; q++) {
                    int cc = q ? d2 : c2;
                    if (cc == INCH - 1) { w += IBIAS * atti(iR[si]); continue; }
                    if (IBIAS) {
                        int ni = iidx(iwrap(x + ICV[cc][0], IW),
                                      iwrap(y + ICV[cc][1], IH),
                                      iwrap(z + ICV[cc][2], ID));
                        w += IBIAS * atti(iR[ni]);
                    }
                    if (IFLD) {
                        int dt = ICV[cc][0] * IFV[0] + ICV[cc][1] * IFV[1]
                               + ICV[cc][2] * IFV[2];
                        if (dt > 0) w += IFLD * dt;
                    }
                }
                if (ICOND && (c2 == INCH - 1 || d2 == INCH - 1))
                    w += ICOND * atti(iR[si]);   /* rest-output ratchet */
                wgt[k] = w; wtot += w;
            }
            uint32_t r = irnd() % wtot;
            int k = 0;
            while (k < len - 1 && r >= wgt[k]) { r -= wgt[k]; k++; }
            ko = GPAIRS[GOFF[g] + k][0]; lo2 = GPAIRS[GOFF[g] + k][1];
        } else if (IMODE == 2 && irnd() % 8 < 7) continue;   /* forward bias */
        else if (IMODE == 1) {                               /* shell weighted */
            uint32_t tot = 0;
            for (int k = 0; k < len; k++) tot += GWGT[GOFF[g] + k];
            uint32_t r = tot ? irnd() % tot : 0;
            int k = 0;
            for (; k < len; k++) {
                if (r < GWGT[GOFF[g] + k]) break;
                r -= GWGT[GOFF[g] + k];
            }
            if (k == len) continue;
            ko = GPAIRS[GOFF[g] + k][0]; lo2 = GPAIRS[GOFF[g] + k][1];
        } else {
            int k = irnd() % len;
            ko = GPAIRS[GOFF[g] + k][0]; lo2 = GPAIRS[GOFF[g] + k][1];
        }
        n[i]--; n[j]--;
        n[ko]++; n[lo2]++;
    }
}

void meso3i_tick(void) {
    /* 1. edge delivery: stage-0 quanta arrive at their destination node,
     *    then all stages shift down one slot */
    if (DWELL > 1) {
        for (int z = 0; z < ID; z++)
        for (int y = 0; y < IH; y++)
        for (int x = 0; x < IW; x++) {
            if (!isite(x, y, z)) continue;
            uint16_t *ed = iD + (size_t)iidx(x, y, z) * IMOV * IKMAX;
            for (int c = 0; c < IMOV; c++) {
                uint16_t arr = ed[c * IKMAX];
                if (arr) {
                    int nx = iwrap(x + ICV[c][0], IW);
                    int ny = iwrap(y + ICV[c][1], IH);
                    int nz = iwrap(z + ICV[c][2], ID);
                    int ni = iidx(nx, ny, nz);
                    if (qcapture(ni)) {
                        /* congestion capture: a Q-core absorbs arriving
                         * channel quanta into core mass (momentum is
                         * absorbed into the core register, flagged) */
                        uint32_t q = iQ[ni] + arr;
                        iQ[ni] = q > 255 ? 255 : (uint8_t)q;
                    } else {
                        uint8_t *na = iA + (size_t)ni * INCH;
                        uint32_t v = na[c] + arr;
                        na[c] = v > 255 ? 255 : (uint8_t)v;
                    }
                }
                for (int j = 0; j < IKMAX - 1; j++)
                    ed[c * IKMAX + j] = ed[c * IKMAX + j + 1];
                ed[c * IKMAX + IKMAX - 1] = 0;
            }
        }
    }

    /* 2a. pre-collision density snapshot (strict synchronicity: the
     * gradient read must not see partially-collided sites) */
    for (int s = 0; s < IN; s++) {
        const uint8_t *n = iA + (size_t)s * INCH;
        uint32_t r = 0;
        for (int c = 0; c < INCH; c++) r += n[c];
        iR[s] = r;
    }

    /* 2. node collisions */
    for (int s = 0; s < IN; s++)
        collide_node(iA + (size_t)s * INCH, s);

    /* 2b. Q emission clock (tau=4): modes 2-5 fire on the global beat
     *    (ITICK&3)==3; mode 6 is per-node phased — emit when the node's
     *    own clock (ITICK+iPH)&3 == 0.  Mode 2 emits antipodal pairs
     *    (momentum-neutral), mode>=3 with IDIR>=0 emits a directed
     *    single quantum (emission event — momentum flagged) */
    if (IQMODE >= 2) {
        for (int s = 0; s < IN; s++) {
            int onbeat = IQMODE >= 6 ? ((ITICK + iPH[s]) & 3) == 0
                                     : (ITICK & 3) == 3;
            /* capacity-thresholded emit (T18): hoard to IQCAP, only the
             * excess pumps forward — trailing edge chokes off its own
             * emission (self-sharpening profile / soliton analog) */
            int qmin = IQCAP ? IQCAP + 1 : 2;
            if (!onbeat || iQ[s] < qmin) continue;
            uint8_t *n = iA + (size_t)s * INCH;
            if (IQMODE >= 3 && IDIR >= 0) {
                /* emit count: 1/beat baseline; with IQCAP, proportional
                 * to excess above cap (max 4) — peak pumps, thin edges
                 * hold — rate ∝ local Q-height */
                int nemit = 1;
                if (IQCAP) {
                    nemit = iQ[s] - IQCAP;
                    if (nemit > 4) nemit = 4;
                }
                n[IDIR] = n[IDIR] + nemit > 255 ? 255 : (uint8_t)(n[IDIR] + nemit);
                iQ[s] -= nemit;
            } else {
                int c = (int)(irnd() % 6) * 2 + (int)(irnd() & 1);
                if (c >= IMOV) c %= IMOV;
                n[c]++; n[c ^ 1]++;         /* {c, -c} antipodal pair */
                iQ[s] -= 2;
            }
        }
    }
    /* 2c. Q overflow (mode>=5): core mass above IQCAP migrates one unit
     * per tick to a neighbor's Q register — lowest-Q neighbor, field-
     * aligned preferred (the capacity-overflow conduction analog) */
    if (IQMODE >= 5 && IQCAP) {
        for (int s = 0; s < IN; s++) {
            if (iQ[s] <= IQCAP) continue;
            int x = s % IW, y = (s / IW) % IH, z = s / (IW * IH);
            int best = -1;
            long bs = 0;
            for (int c = 0; c < IMOV; c++) {
                int ni = iidx(iwrap(x + ICV[c][0], IW),
                              iwrap(y + ICV[c][1], IH),
                              iwrap(z + ICV[c][2], ID));
                long sc = iQ[ni];
                if (IFLD) sc -= (long)IFLD *
                    (ICV[c][0] * IFV[0] + ICV[c][1] * IFV[1] + ICV[c][2] * IFV[2]);
                if (best < 0 || sc < bs) { best = c; bs = sc; }
            }
            if (best < 0) continue;
            int ni = iidx(iwrap(x + ICV[best][0], IW),
                          iwrap(y + ICV[best][1], IH),
                          iwrap(z + ICV[best][2], ID));
            iQ[s]--; iQ[ni]++;
        }
    }
    ITICK++;

    /* 3. stream: rest stays; moving quanta go direct (DWELL=1) or into
     *    the edge delay line at stage DWELL-1 */
    memset(iB, 0, (size_t)IN * INCH);
    for (int z = 0; z < ID; z++)
    for (int y = 0; y < IH; y++)
    for (int x = 0; x < IW; x++) {
        if (!isite(x, y, z)) continue;
        int si = iidx(x, y, z);
        uint8_t *n = iA + (size_t)si * INCH;
        iB[si * INCH + INCH - 1] += n[INCH - 1];
        for (int c = 0; c < IMOV; c++) {
            if (!n[c]) continue;
            if (DWELL > 1) {
                iD[(size_t)si * IMOV * IKMAX + c * IKMAX + DWELL - 1] += n[c];
                continue;
            }
            int nx = iwrap(x + ICV[c][0], IW);
            int ny = iwrap(y + ICV[c][1], IH);
            int nz = iwrap(z + ICV[c][2], ID);
            int ni = iidx(nx, ny, nz);
            if (qcapture(ni)) {
                uint32_t q = iQ[ni] + n[c];   /* core captures the hop */
                iQ[ni] = q > 255 ? 255 : (uint8_t)q;
                continue;
            }
            int di = ni * INCH + c;
            uint32_t v = iB[di] + n[c];
            iB[di] = v > 255 ? 255 : (uint8_t)v;   /* hard cap safety */
        }
    }
    uint8_t *t = iA; iA = iB; iB = t;
}

void meso3i_totals(uint64_t *mass, int64_t *px, int64_t *py, int64_t *pz) {
    uint64_t m = 0; int64_t x_ = 0, y_ = 0, z_ = 0;
    for (int s = 0; s < IN; s++) {
        const uint8_t *n = iA + (size_t)s * INCH;
        for (int c = 0; c < INCH; c++) {
            m += n[c];
            x_ += (int64_t)n[c] * ICV[c][0];
            y_ += (int64_t)n[c] * ICV[c][1];
            z_ += (int64_t)n[c] * ICV[c][2];
        }
    }
    for (int s = 0; s < IN; s++) {
        const uint16_t *ed = iD + (size_t)s * IMOV * IKMAX;
        for (int c = 0; c < IMOV; c++)
            for (int j = 0; j < IKMAX; j++) {
                m += ed[c * IKMAX + j];
                x_ += (int64_t)ed[c * IKMAX + j] * ICV[c][0];
                y_ += (int64_t)ed[c * IKMAX + j] * ICV[c][1];
                z_ += (int64_t)ed[c * IKMAX + j] * ICV[c][2];
            }
    }
    *mass = m; *px = x_; *py = y_; *pz = z_;
}

void meso3i_hist(uint64_t *out) {
    memset(out, 0, sizeof(uint64_t) * INCH);
    for (int s = 0; s < IN; s++) {
        const uint8_t *n = iA + (size_t)s * INCH;
        for (int c = 0; c < INCH; c++) out[c] += n[c];
    }
}

int meso3i_nch(void) { return INCH; }
const int (*meso3i_cv(void))[3] { return (const int (*)[3])ICV; }
