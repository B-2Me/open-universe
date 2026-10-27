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
 *
 * Photons (IPHOT): a parallel massless field on the moving channels —
 * photons stream like quanta but carry no mass and never collide.
 *   1 catalyst: photon presence licenses the IFRICM<0 emission gate
 *     (a massless carrier — isotropic boil-off, nothing added).
 *   2 stimulated: each arriving photon may kick a rest quantum into the
 *     photon's own channel — coherent directional ablation (a laser).
 * Neither deletes mass: parked heat converts back to moving flux, which
 * drains at the boundary or re-parks downstream.
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
static uint8_t *iE;                  /* excitation level n (Planck oscillator):
                                        IPHOT>=5 absorb raises n at fixed mass;
                                        thermal decay sheds n back as photons */
static int      IREFL;               /* congestion-reflection cap; 0=off */
static int      IFRIC;               /* routing friction: density cap; 0=off */
static int      IFRICP = 128;        /* flat park probability num/256 (128 = legacy p=1/2) */
static int      IPTH = 0;            /* absorb threshold nu (0 = all absorb) */
static int      INSH = 0;            /* transit down-shift k: 1/k chance per parked hop (0 = off) */
static int      EMASK = 7;         /* thermal decay mask: 1/(EMASK+1) per quantum */
static int      IFRICC;              /* park-probability curve: 0=flat p8/256,
                                        1=ramp cap->255, 2=ramp cap->2*cap */
static int      IFRICM;              /* rest-inertia: 0=rest collides; k=rest inert, radiates ~1/4k */
static int      IPHOT;               /* photons: 0 off, 1 catalyst gate, 2 stimulated emission */
static int      IPAIR;               /* antipodal pairs: 0 off, 1 on — momentum-honest
                                        wind/unwind. Rest radiates as back-to-back
                                        channel pairs (zero net momentum); populated
                                        antipodal pairs may bind back into rest. */
static int      ILAT = 1;            /* emission latency: carrier-gated radiation
                                        fires only after m>0 has persisted ILAT
                                        consecutive ticks at the node. 1 = instant
                                        (canonical). >1 lets freshly-bound mass
                                        survive transient flux — only sustained
                                        transit unwinds. */
static uint8_t *iLT;                 /* per-site consecutive-transit counter */
static int      IDREST;              /* directional rest ("frozen flux"): a
                                        friction-parked quantum lands in rest[c],
                                        the bin for the channel it was riding,
                                        and carrier-gated emission returns it to
                                        that same channel — momentum stored on
                                        park, handed back on emit. The only
                                        candidate so far for a wound state: an
                                        Lz imbalance survives inside parked
                                        mass instead of smearing to a scalar.
                                        0 = canonical scalar rest bin. */
static uint8_t *iRA, *iRB;           /* directional rest bins [site][IMOV] */
static int      IPHN;                /* live photon count — photon sweep skipped at 0 */
#define NNU 4                                   /* photon frequency bins (nu=1..NNU) */
static uint8_t *iPA, *iPB;           /* photon planes [site*IMOV*NNU + c*NNU + nu]: directional,
                                        massless, non-colliding messengers */
static int      ITICK;               /* global tick counter for the clock */
static uint32_t *iR;                 /* pre-collision per-site mass map */
static int      INPAIR;              /* unordered pairs incl doubles */
static uint16_t GID[19][19];         /* group id for pair (i<=j) */
static uint8_t  GPAIRS[400][2];
static uint16_t GWGT[400];
static uint16_t GOFF[300], GLEN[300];
static int      NGRP;

/* irreversible contact transactions, counted in quanta per class.
 * These are the engine's entropy-production analog: RNG-mediated or
 * boundary events that cannot be replayed backward. This is an event
 * count, not a computed entropy — it measures HOW MANY contact
 * transactions occurred, not dS/dt.
 *   0 drag-park   transit hop shed into rest by congestion (IFRIC)
 *   1 pair-bind   antipodal pair captured into rest (IPAIR)
 *   2 emit        parked mass vented through the radiation gate
 *   3 qcap        moving mass absorbed by the Q core register
 *   4 drain       mass quanta zeroed at the open boundary shell
 *   5 peject      parked mass ejected by photon contact (IPHOT 2/3)
 *   6 reflect     hop refused by congestion wall (IREFL) */
static uint64_t iEV[8];   /* 7 = pair production (photon+photon -> rest) */
double meso3i_ev(int k)     { return (k >= 0 && k < 8) ? (double)iEV[k] : 0; }
void   meso3i_ev_reset(void) { memset(iEV, 0, sizeof iEV); }

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
    iE = calloc((size_t)IN, 1);
    iPA = calloc((size_t)IN * IMOV * NNU, 1);
    iPB = calloc((size_t)IN * IMOV * NNU, 1);
    iLT = calloc((size_t)IN, 1);
    iRA = calloc((size_t)IN * IMOV, 1);
    iRB = calloc((size_t)IN * IMOV, 1);
    if (!iA || !iB || !iD || !iR || !iQ || !iPH || !iPA || !iPB || !iLT ||
        !iRA || !iRB || !iE) return -2;
    build_pairs();
    return 0;
}

void meso3i_clear(void) {
    memset(iA, 0, (size_t)IN * INCH);
    memset(iD, 0, (size_t)IN * 18 * IKMAX * sizeof(uint16_t));
    memset(iQ, 0, (size_t)IN);
    memset(iPH, 0, (size_t)IN);
    memset(iPA, 0, (size_t)IN * IMOV);
    memset(iPB, 0, (size_t)IN * IMOV * NNU);
    memset(iLT, 0, (size_t)IN);
    memset(iRA, 0, (size_t)IN * IMOV);
    memset(iRB, 0, (size_t)IN * IMOV);
    memset(iEV, 0, sizeof iEV);
    IPHN = 0;
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
void meso3i_reflect(int cap) { IREFL = cap; }
void meso3i_friction(int cap) { IFRIC = cap; }
void meso3i_fricp(int p8) { IFRICP = p8 < 0 ? 0 : (p8 > 256 ? 256 : p8); }
void meso3i_friccurve(int mode) { IFRICC = mode; }

/* park probability num/256 at destination rest mass rho: flat by default,
 * graded ramps when IFRICC selects a curve (0 at/below cap, rising to the
 * ceiling at 255 for mode 1, at 2*cap for mode 2). */
static inline int fricp_num(int rho) {
    if (!IFRICC) return IFRICP;
    int span = (IFRICC == 2) ? IFRIC : (255 - IFRIC);
    if (span < 1) return 256;
    int num = 256 * (rho - IFRIC) / span;
    return num > 256 ? 256 : num;
}
void meso3i_fricmode(int m) { IFRICM = m; }
void meso3i_phot(int m) { IPHOT = m; }
void meso3i_erate(int m) { EMASK = m; }
void meso3i_phth(int t)    { IPTH = t; }
void meso3i_nushift(int k) { INSH = k; }
void meso3i_pair(int m) { IPAIR = m; }
void meso3i_lat(int n) { ILAT = n; }
void meso3i_drest(int m) { IDREST = m; }
/* parked population in the directional bins at a site — iRA is the
 * canonical (post-swap) plane; iRB is only coherent mid-tick */
static int drest_at(const uint8_t *base, int si);
static int parked_now(int si) {
    return (int)iB[si * INCH + INCH - 1] +
           (IDREST ? drest_at(iRB, si) : 0);
}
static int drest_at(const uint8_t *base, int si) {
    const uint8_t *dr = base + (size_t)si * IMOV;
    int s = 0;
    for (int c = 0; c < IMOV; c++) s += dr[c];
    return s;
}
uint8_t meso3i_rget(int x, int y, int z, int c) {
    if (c < 0 || c >= IMOV) return 0;
    return iRA[iidx(iwrap(x, IW), iwrap(y, IH), iwrap(z, ID)) * IMOV + c];
}
void meso3i_rset(int x, int y, int z, int c, uint8_t v) {
    if (c < 0 || c >= IMOV) return;
    x = iwrap(x, IW); y = iwrap(y, IH); z = iwrap(z, ID);
    if (isite(x, y, z)) iRA[iidx(x, y, z) * IMOV + c] = v;
}

/* photon channel access — live parity only, like meso3i_set. Photons
 * carry direction (their channel) but no mass and never collide. */
void meso3i_phset(int x, int y, int z, int c, uint8_t v) {
    if (c < 0 || c >= IMOV) return;
    x = iwrap(x, IW); y = iwrap(y, IH); z = iwrap(z, ID);
    if (!isite(x, y, z)) return;
    int si = iidx(x, y, z) * IMOV * NNU + c * NNU;
    IPHN += (int)v - iPA[si];
    iPA[si] = v;
}
/* frequency-binned access: nu = 1..NNU (energy of the photon). */
void meso3i_phset_nu(int x, int y, int z, int c, int nu, uint8_t v) {
    if (c < 0 || c >= IMOV || nu < 1 || nu > NNU) return;
    x = iwrap(x, IW); y = iwrap(y, IH); z = iwrap(z, ID);
    if (!isite(x, y, z)) return;
    int si = iidx(x, y, z) * IMOV * NNU + c * NNU + (nu - 1);
    IPHN += (int)v - iPA[si];
    iPA[si] = v;
}
uint8_t meso3i_phget(int x, int y, int z, int c) {
    if (c < 0 || c >= IMOV) return 0;
    return iPA[iidx(iwrap(x, IW), iwrap(y, IH), iwrap(z, ID)) * IMOV * NNU + c * NNU];
}
uint8_t meso3i_phget_nu(int x, int y, int z, int c, int nu) {
    if (c < 0 || c >= IMOV || nu < 1 || nu > NNU) return 0;
    return iPA[iidx(iwrap(x, IW), iwrap(y, IH), iwrap(z, ID)) * IMOV * NNU + c * NNU + (nu - 1)];
}
int meso3i_photons(void) { return IPHN; }
/* total photon ENERGY: sum over bins of nu * occupancy */
int meso3i_phenergy(void) {
    long e = 0;
    for (int s = 0; s < IN * IMOV * NNU; s += NNU)
        for (int nu = 0; nu < NNU; nu++) e += (long)iPA[s + nu] * (nu + 1);
    return (int)e;
}
void meso3i_pset(int x, int y, int z, uint8_t v) {
    x = iwrap(x, IW); y = iwrap(y, IH); z = iwrap(z, ID);
    if (isite(x, y, z)) iPH[iidx(x, y, z)] = v & 3;
}
uint8_t meso3i_pget(int x, int y, int z) {
    x = iwrap(x, IW); y = iwrap(y, IH); z = iwrap(z, ID);
    return isite(x, y, z) ? iPH[iidx(x, y, z)] : 0;
}
uint8_t meso3i_eget(int x, int y, int z) {
    x = iwrap(x, IW); y = iwrap(y, IH); z = iwrap(z, ID);
    return isite(x, y, z) ? iE[iidx(x, y, z)] : 0;
}
void meso3i_eset(int x, int y, int z, uint8_t v) {
    x = iwrap(x, IW); y = iwrap(y, IH); z = iwrap(z, ID);
    if (isite(x, y, z)) iE[iidx(x, y, z)] = v;
}

/* mode>=4 capture: unconditionally at Q>0 nodes for modes 4-5; mode 6
 * is phase-gated — a node captures arriving flux into Q only during its
 * receptive beat (stream-phase clock (ITICK+iPH)&3 == 2, one beat after
 * an upstream emitter's beat-0 at the same global tick when phi ~ x). */
static int qcapture(int ni) {
    if (IQMODE < 4) return 0;
    if (IQMODE >= 6) {
        if (((ITICK + iPH[ni]) & 3) != 2) return 0;
        /* mode 7: mass-attracts-mass — capture probability ~ (1+Q)/16.
         * Peak pulls flux in, thin periphery mostly lets it pass —
         * the discrete self-focusing term */
        if (IQMODE >= 7) return (int)(irnd() % 16) < (int)iQ[ni] + 1;
        return 1;
    }
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
/* pick with a fully-excluded channel (inert rest) plus a one-less skip */
static int pick_chan_x(const uint8_t *n, int r, int excl, int skip) {
    for (int c = 0; c < INCH; c++) {
        if (c == excl) continue;
        int cnt = n[c] - (c == skip);
        if (cnt <= 0) continue;
        if (r < cnt) return c;
        r -= cnt;
    }
    return -1;
}

/* photon occupancy at a site — catalyst gate reads this only for
 * nodes with parked rest mass (rare), so a plain channel sum is fine */
static int phot_at(int si) {
    const uint8_t *p = iPA + (size_t)si * IMOV;
    int n = 0;
    for (int c = 0; c < IMOV; c++) n += p[c];
    return n;
}

static void collide_node(uint8_t *n, int si) {
    int rest = IFRICM ? n[INCH - 1] : 0;
    int m = 0;
    for (int c = 0; c < INCH; c++) m += n[c];
    m -= rest;                       /* inert heat: rest mass does not collide */
    /* transit dwell bookkeeping: consecutive ticks with moving mass
     * present. collide_node runs for every site, so empty sites reset. */
    if (m > 0) { if (iLT[si] < 255) iLT[si]++; } else iLT[si] = 0;
    /* radiative boil-off: parked heat re-emits into moving channels.
     * IFRICM>0: unconditional blackbody rate ~1/(4k) per quantum.
     * IFRICM<0: carrier-gated — emission only while moving mass
     * transits the node (heat needs a carrier; inert in true vacuum).
     * ILAT>1: the carrier must DWELL — transit must persist ILAT
     * consecutive ticks before the gate opens; a passing pair can't
     * unwind what it just wound.
     * IPHOT==1 (catalyst): a transiting photon field licenses the same
     * gate without contributing mass — a massless carrier probe. */
    int dsum = IDREST ? drest_at(iRA, si) : 0;
    int parked = n[INCH - 1] + dsum;
    if (IFRICM && parked && (IFRICM > 0 || iLT[si] >= ILAT ||
                             (IPHOT == 1 && phot_at(si)))) {
        int k = IFRICM < 0 ? -IFRICM : IFRICM;
        uint8_t *dr = iRA + (size_t)si * IMOV;
        for (int u = 0; u < n[INCH - 1] + dsum; u++) {
            if (irnd() % (4 * k) != 0) continue;
            int tot = n[INCH - 1] + dsum;
            int pick = tot > 0 ? (int)(irnd() % (uint32_t)tot) : 0;
            if (pick < n[INCH - 1]) {
                /* scalar bin: canonical flagged emission */
                if (IPAIR && n[INCH - 1] >= 2) {
                    /* pair emission: rest sheds as a back-to-back
                     * antipodal pair — zero net momentum, honest decay */
                    int c = irnd() % IMOV;
                    n[INCH - 1] -= 2;
                    n[c]++; n[c ^ 1]++;
                    iEV[2] += 2;
                } else if (IPHOT >= 4) {
                    /* fluorescence: rest re-emits as PHOTON, not mass —
                     * the "resume" branch of the refractive cycle
                     * (absorb->dwell->resume-as-photon, ILAT-gated) */
                    int c = irnd() % IMOV;
                    n[INCH - 1]--;
                    iPA[si * IMOV * NNU + c * NNU]++; IPHN++;   /* nu=1 */
                    iEV[2]++;
                } else {
                    n[INCH - 1]--; n[irnd() % IMOV]++;
                    iEV[2]++;
                }
            } else {
                /* directional bin: emit back onto the channel it parked
                 * on — the momentum stored at park is handed back */
                int w = pick - n[INCH - 1], c = 0;
                for (; c < IMOV - 1; c++) { if (w < dr[c]) break; w -= dr[c]; }
                dr[c]--; dsum--;
                n[c]++;
                iEV[2]++;
            }
        }
    }
    /* thermal decay: excited sites shed n back into photons —
     * the resume branch of conduction (warming in place is real).
     * IPHOT>=7: per-quantum decay (Einstein A — each quantum rolls
     * independently, emission rate proportional to occupation n).
     * IPHOT 5-6: flat per-site rate (one quantum per ~8 ticks). */
    if (IPHOT >= 7 && iE[si]) {
        int lv = iE[si];
        for (int u = 0; u < lv; u++) {
            if (!iE[si]) break;
            if ((irnd() & EMASK) == 0) {
                /* each emitted photon draws nu from the site's
                 * occupation — hotter sites reach higher nu
                 * (Wien displacement, mechanically) */
                int cap = iE[si] < NNU ? iE[si] : NNU;
                int nu = 1 + (int)(irnd() % (uint32_t)cap);
                iE[si] -= nu;
                iPA[si * IMOV * NNU + (irnd() % IMOV) * NNU + nu - 1]++;
                IPHN++;
            }
        }
    } else if (IPHOT >= 5 && iE[si] && (irnd() & EMASK) == 0) {
        iE[si]--;
        iPA[si * IMOV * NNU + (irnd() % IMOV) * NNU]++; IPHN++;   /* nu=1 */
    }
    /* pair capture (IPAIR): a populated antipodal pair may bind into
     * rest mass — the wind side of the cycle. Zero net momentum either
     * way; binding needs no congestion, just two quanta arriving
     * head-on. Rate ~1/(4k) per pair, mirroring the emission clock.
     * IDREST: each quantum parks on its own channel — winding stores
     * the pair's axis, not just its mass. */
    if (IPAIR) {
        int k = IFRICM ? (IFRICM < 0 ? -IFRICM : IFRICM) : 4;
        for (int c = 0; c + 1 < IMOV; c += 2)
            if (n[c] && n[c + 1] && irnd() % (4 * k) == 0) {
                n[c]--; n[c + 1]--;
                iEV[1] += 2;
                if (IDREST) {
                    uint8_t *dr = iRA + (size_t)si * IMOV;
                    if (dr[c] < 255) dr[c]++;
                    if (dr[c + 1] < 255) dr[c + 1]++;
                } else {
                    uint32_t r = n[INCH - 1] + 2;
                    n[INCH - 1] = r > 255 ? 255 : (uint8_t)r;
                }
            }
    }
    if (m < 2) return;
    int excl = IFRICM ? INCH - 1 : -1;
    int attempts = (IBIAS || IFLD) ? m : m >> 1;   /* weighted: full coverage */
    if (!attempts) attempts = 1;
    int x = si % IW, y = (si / IW) % IH, z = si / (IW * IH);
    for (int a = 0; a < attempts; a++) {
        int i = pick_chan_x(n, irnd() % m, excl, -1);
        int j = pick_chan_x(n, irnd() % (m - 1), excl, i);
        if (i < 0 || j < 0) continue;
        int lo = i < j ? i : j, hi = i < j ? j : i;
        /* Q condensation: at gated nodes an antipodal pair {c,-c} may
         * convert to core mass (Q is outside the collision move family —
         * the ratchet the rest channel lacked) */
        if (IQMODE && i != j && ICV[i][0] + ICV[j][0] == 0 &&
            ICV[i][1] + ICV[j][1] == 0 && ICV[i][2] + ICV[j][2] == 0 &&
            (!IGATE || m >= IGATE) && irnd() % 2 == 0) {
            n[i]--; n[j]--;
            iEV[3] += 2;
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
        } else if (IBIAS || IFLD || ICOND) {
            /* ungated node in weighted regime: the domain wall acts on the
             * bath side too — weight ALL group members by gradient pull
             * and/or external-field alignment; with only ICOND set this is
             * the pure rest-channel ratchet (rest outputs get +ICOND*atti) */
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
     * gradient read must not see partially-collided sites). Includes
     * directional rest — parked flux in iRA is congestion exactly like
     * scalar rest (collide_node/rg_refresh/hist already count it). */
    for (int s = 0; s < IN; s++) {
        const uint8_t *n = iA + (size_t)s * INCH;
        uint32_t r = 0;
        for (int c = 0; c < INCH; c++) r += n[c];
        iR[s] = r + (IDREST ? (uint32_t)drest_at(iRA, s) : 0u);
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
            if (IQMODE >= 8) {
                /* peristaltic swell: dump ALL Q isotropically into
                 * random moving channels — the expansion beat */
                int nq = iQ[s];
                for (int u = 0; u < nq; u++) n[irnd() % IMOV]++;
                iQ[s] = 0;
            } else if (IQMODE >= 3 && IDIR >= 0) {
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
    if (IDREST) memcpy(iRB, iRA, (size_t)IN * IMOV);   /* parked flux stays put */
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
                iEV[3] += n[c];
                continue;
            }
            if (IFRIC && (int)iR[ni] >= IFRIC &&
                (int)(irnd() & 255) < fricp_num((int)iR[ni])) {
                /* network drag (space-is-friction): a transit hop into a
                 * congested node sheds momentum — the quantum lands in the
                 * destination's REST channel as parked heat. Entry rate ∝
                 * inflow×congestion; exit only via slow collision re-picks.
                 * Momentum absorbed by the network (flagged, inelastic).
                 * IDREST: park on the channel's own rest bin instead —
                 * "frozen flux": momentum stored, not absorbed. */
                if (IPHOT >= 6) {
                    /* thermalize: the carrier is absorbed as EXCITATION —
                     * mass -> bound energy at contact (collision->n, the
                     * convection channel). Energy delivered without mass
                     * deposit: real heating, not accretion. */
                    uint32_t v = iE[ni] + n[c];
                    iE[ni] = v > 255 ? 255 : (uint8_t)v;
                } else if (IDREST) {
                    uint32_t v = iRB[(size_t)ni * IMOV + c] + n[c];
                    iRB[(size_t)ni * IMOV + c] = v > 255 ? 255 : (uint8_t)v;
                } else {
                    iB[ni * INCH + INCH - 1] += n[c];
                }
                iEV[0] += n[c];
                continue;
            }
            if (IREFL && (int)(iR[ni] + iQ[ni]) >= IREFL) {
                /* elastic wall (congestion refusal, planck3 DEADLOCK
                 * analog): hop refused — quantum reverses to the
                 * antipodal channel at source; momentum flip absorbed
                 * by the wall (flagged).  c^1 = antipode in the
                 * direction tables. */
                int di = si * INCH + (c ^ 1);
                uint32_t v = iB[di] + n[c];
                iB[di] = v > 255 ? 255 : (uint8_t)v;
                iEV[6] += n[c];
                continue;
            }
            int di = ni * INCH + c;
            uint32_t v = iB[di] + n[c];
            iB[di] = v > 255 ? 255 : (uint8_t)v;   /* hard cap safety */
        }
    }

    /* 4. photon stream — after the mass stream so arrivals at ni see the
     * complete post-stream state (iB rest channel is final). Photons hop
     * along channel vectors, never collide, carry no mass.
     * IPHOT==2 (stimulated emission): each arriving photon may kick one
     * rest quantum at the destination into the photon's OWN channel —
     * coherent directional ablation. The photon survives the transit
     * (the emitted quantum's momentum comes from beam alignment —
     * flagged, like every other non-invariant in this engine). */
    if (IPHN) {
        memset(iPB, 0, (size_t)IN * IMOV * NNU);
        for (int z = 0; z < ID; z++)
        for (int y = 0; y < IH; y++)
        for (int x = 0; x < IW; x++) {
            if (!isite(x, y, z)) continue;
            const uint8_t *ps = iPA + (size_t)iidx(x, y, z) * IMOV * NNU;
            for (int c = 0; c < IMOV; c++)
            for (int nu = 0; nu < NNU; nu++) {
                int p = ps[c * NNU + nu];
                if (!p) continue;
                int ni = iidx(iwrap(x + ICV[c][0], IW),
                              iwrap(y + ICV[c][1], IH),
                              iwrap(z + ICV[c][2], ID));
                if (IPHOT >= 3 && nu + 1 >= IPTH) {
                    /* absorbed photon (radiation pressure / YORP mode):
                     * the photon is CONSUMED on contact with parked mass —
                     * its momentum transfers into the mass ledger as an
                     * ejected quantum on the photon's own channel, drawn
                     * proportionally from scalar vs directional rest.
                     * Momentum closes if photons are counted (totals):
                     * -p leaves the light field, +p enters the matter
                     * field. Light can write spin where it grazes. */
                    int ri = ni * INCH + INCH - 1;
                    int dsum = IDREST ? drest_at(iRB, ni) : 0;
                    int parked = iB[ri] + dsum;
                    int absorbed = 0;
                    if (IPHOT >= 5) {
                        /* thermalize: photon absorbed as EXCITATION —
                         * n++ at fixed mass, no ejection (Planck's n) */
                        for (int u = 0; u < p; u++)
                            if (parked && (int)(irnd() & 255) < parked) {
                                uint32_t e = iE[ni] + nu + 1;   /* energy-conserving absorb */
                                iE[ni] = e > 255 ? 255 : (uint8_t)e;
                                absorbed++;
                            }
                    } else {
                    for (int u = 0; u < p; u++)
                        if (parked && (int)(irnd() & 255) < parked) {
                            int pick = parked > iB[ri]
                                ? (int)(irnd() % (uint32_t)parked) : 0;
                            if (pick < iB[ri]) {
                                iB[ri]--;
                            } else {
                                uint8_t *dr = iRB + (size_t)ni * IMOV;
                                int w = pick - iB[ri], c2 = 0;
                                for (; c2 < IMOV - 1; c2++) { if (w < dr[c2]) break; w -= dr[c2]; }
                                dr[c2]--;
                            }
                            parked--; absorbed++;
                            int di = ni * INCH + c;
                            uint32_t v = iB[di] + nu + 1;
                            iB[di] = v > 255 ? 255 : (uint8_t)v;
                        }
                    }
                    p -= absorbed;
                    IPHN -= absorbed;
                    iEV[5] += absorbed;
                    if (!p) continue;
                }
                if (IPHOT == 2) {
                    int ri = ni * INCH + INCH - 1;
                    int dsum = IDREST ? drest_at(iRB, ni) : 0;
                    int parked = iB[ri] + dsum;
                    for (int u = 0; u < p; u++)
                        if (parked && (int)(irnd() & 255) < parked) {
                            /* eject into the photon's channel — the
                             * photon fixes the direction either way;
                             * draw proportionally from scalar vs its
                             * directional bins */
                            int pick = parked > iB[ri]
                                ? (int)(irnd() % (uint32_t)parked) : 0;
                            if (pick < iB[ri]) {
                                iB[ri]--;
                            } else {
                                uint8_t *dr = iRB + (size_t)ni * IMOV;
                                int w = pick - iB[ri], c2 = 0;
                                for (; c2 < IMOV - 1; c2++) { if (w < dr[c2]) break; w -= dr[c2]; }
                                dr[c2]--;
                            }
                            parked--;
                            iEV[5]++;
                            int di = ni * INCH + c;
                            uint32_t v = iB[di] + 1;
                            iB[di] = v > 255 ? 255 : (uint8_t)v;
                        }
                }
                int pi;
                /* INSH>0: flat 1/k shift chance (additive loss).
                 * INSH<0: P = nu/|k| shift chance (multiplicative
                 * loss — the blackbody-preserving condition). */
                int shift = INSH > 0
                    ? (int)(irnd() % (uint32_t)INSH) == 0
                    : INSH < 0 && (int)(irnd() % (uint32_t)(-INSH)) < nu + 1;
                if (shift && nu > 0 && parked_now(ni)) {
                    /* transit dissipation: the photon drops one energy
                     * bin crossing matter, depositing 1 unit into the
                     * site's excitation — a mechanical 'tired light'
                     * channel (flagged). */
                    uint32_t e = iE[ni] + p;
                    iE[ni] = e > 255 ? 255 : (uint8_t)e;
                    pi = ni * IMOV * NNU + c * NNU + (nu - 1);
                } else {
                    pi = ni * IMOV * NNU + c * NNU + nu;
                }
                uint32_t v = iPB[pi] + p;
                if (v > 255) { IPHN -= (int)(v - 255); v = 255; }
                iPB[pi] = (uint8_t)v;
            }
        }
        uint8_t *tp = iPA; iPA = iPB; iPB = tp;
        /* pair production (IPHOT>=8): head-on photons on antipodal
         * channels crystallize into rest mass — gamma+gamma -> matter,
         * the last leg of the mass<->photon<->n triangle. Energy and
         * momentum conserved; no parked mass required (in vacuum). */
        if (IPHOT >= 8)
        for (int si = 0; si < IN; si++) {
            uint8_t *pa = iPA + (size_t)si * IMOV * NNU;
            for (int c = 0; c < IMOV; c++)
            for (int c2 = c + 1; c2 < IMOV; c2++) {
                /* non-antipodal allowed (IPHOT>=9): pairs meeting at
                 * an angle carry net momentum -> orbital spin can be
                 * stored. IPHOT==8 keeps collinear antipodes only. */
                if (IPHOT == 8 && c2 != (c ^ 1)) continue;
                for (int nu = 0; nu < NNU; nu++)
                while (pa[c * NNU + nu] && pa[c2 * NNU + nu] &&
                       (irnd() & 7) == 0) {
                    /* same-frequency photon pair fuses: 2*nu quanta of
                     * energy crystallize into rest/directional mass */
                    pa[c * NNU + nu]--; pa[c2 * NNU + nu]--; IPHN -= 2;
                    if (IDREST) {
                        uint8_t *dr = iRB + (size_t)si * IMOV;
                        uint32_t v1 = dr[c] + nu + 1, v2 = dr[c2] + nu + 1;
                        dr[c]  = v1 > 255 ? 255 : (uint8_t)v1;
                        dr[c2] = v2 > 255 ? 255 : (uint8_t)v2;
                    } else {
                        uint32_t v = iB[si * INCH + INCH - 1] + 2 * (nu + 1);
                        iB[si * INCH + INCH - 1] = v > 255 ? 255 : (uint8_t)v;
                    }
                    iEV[7] += 2;
                }
            }
        }
    }

    uint8_t *t = iA; iA = iB; iB = t;
    if (IDREST) { uint8_t *tr = iRA; iRA = iRB; iRB = tr; }
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
        if (IDREST) {
            /* parked flux still carries its stored momentum — count it
             * honestly: under IDREST a friction park is momentum-neutral
             * for the field (stored, not absorbed by the network) */
            const uint8_t *dr = iRA + (size_t)s * IMOV;
            for (int c = 0; c < IMOV; c++) {
                m += dr[c];
                x_ += (int64_t)dr[c] * ICV[c][0];
                y_ += (int64_t)dr[c] * ICV[c][1];
                z_ += (int64_t)dr[c] * ICV[c][2];
            }
        }
        if (IPHOT >= 3) {
            /* photon momentum counts in the ledger under absorbed mode —
             * absorption then closes: -p in flight, +p as ejecta */
            const uint8_t *pp = iPA + (size_t)s * IMOV;
            for (int c = 0; c < IMOV; c++) {
                x_ += (int64_t)pp[c] * ICV[c][0];
                y_ += (int64_t)pp[c] * ICV[c][1];
                z_ += (int64_t)pp[c] * ICV[c][2];
            }
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
        if (IDREST) out[INCH - 1] += drest_at(iRA, s);
    }
}

int meso3i_nch(void) { return INCH; }
const int (*meso3i_cv(void))[3] { return (const int (*)[3])ICV; }

/* ---- viewer shim (Yarkovsky's Ember wasm build; harmless natively) ----
 * R = summed moving-channel population (clamped), G = rest-channel
 * population, B = summed photon population (massless light field),
 * packed site-major so texSubImage3D can read it as RGB8.
 * Stats refreshed alongside: rest/moving totals + rest-mass centroid in
 * fixed point (x256), for the HUD — one pass, no extra sweeps. */
static uint8_t *iRG;
static int st_rest, st_mov, st_cx, st_cy, st_cz;

int meso3i_dim(int a)      { return a == 0 ? IW : a == 1 ? IH : ID; }
int meso3i_cvc(int c, int k) { return c < 0 || c >= INCH ? 0 : ICV[c][k]; }

const uint8_t *meso3i_rg_refresh(void) {
    if (!iRG) iRG = malloc((size_t)IN * 4);
    long long cx = 0, cy = 0, cz = 0;
    st_rest = st_mov = 0;
    for (int s = 0; s < IN; s++) {
        const uint8_t *n = iA + (size_t)s * INCH;
        int mov = 0;
        for (int c = 0; c < IMOV; c++) mov += n[c];
        int rest = n[INCH - 1] + (IDREST ? drest_at(iRA, s) : 0);
        iRG[s * 4]     = (uint8_t)(mov > 255 ? 255 : mov);
        iRG[s * 4 + 1] = (uint8_t)rest;
        if (IPHN) {
            const uint8_t *pp = iPA + (size_t)s * IMOV * NNU;
            int ph = 0;
            for (int c = 0; c < IMOV * NNU; c++) ph += pp[c];
            iRG[s * 4 + 2] = (uint8_t)(ph > 255 ? 255 : ph);
        } else iRG[s * 4 + 2] = 0;
        iRG[s * 4 + 3] = iE ? iE[s] : 0;   /* bound excitation n */
        st_mov += mov; st_rest += rest;
        int x = s % IW, y = (s / IW) % IH, z = s / (IW * IH);
        cx += (long long)rest * x;
        cy += (long long)rest * y;
        cz += (long long)rest * z;
    }
    if (st_rest) {
        st_cx = (int)(cx * 256 / st_rest);
        st_cy = (int)(cy * 256 / st_rest);
        st_cz = (int)(cz * 256 / st_rest);
    } else st_cx = st_cy = st_cz = -256;
    return iRG;
}
const uint8_t *meso3i_rg_pointer(void) { return iRG ? iRG : meso3i_rg_refresh(); }
int meso3i_rest_mass(void) { return st_rest; }
int meso3i_mov_mass(void)  { return st_mov; }
int meso3i_cm(int a)       { return a == 0 ? st_cx : a == 1 ? st_cy : st_cz; }

/* vacuum boundary: zero every channel on sites within `t` of the shell —
 * the open-drain the test harnesses use (in JS this loop is too hot).
 * Photons drain too — an open boundary for light as well as mass. */
void meso3i_drain_edge(int t) {
    for (int z = 0; z < ID; z++)
    for (int y = 0; y < IH; y++)
    for (int x = 0; x < IW; x++) {
        if (x >= t && x < IW - t && y >= t && y < IH - t &&
            z >= t && z < ID - t) continue;
        int si = iidx(x, y, z);
        const uint8_t *na = iA + (size_t)si * INCH;
        for (int c = 0; c < INCH; c++) iEV[4] += na[c];
        if (IDREST) {
            const uint8_t *dr = iRA + (size_t)si * IMOV;
            for (int c = 0; c < IMOV; c++) iEV[4] += dr[c];
            memset(iRA + (size_t)si * IMOV, 0, IMOV);
        }
        memset(iA + (size_t)si * INCH, 0, INCH);
        iE[si] = 0;   /* drain excitation at the edge too */
        if (IPHN) {
            uint8_t *pp = iPA + (size_t)si * IMOV * NNU;
            for (int c = 0; c < IMOV * NNU; c++) IPHN -= pp[c];
            memset(pp, 0, IMOV * NNU);
        }
    }
}

/* snapshot = the full cross-tick state: mass channels, photon plane,
 * latency counters, dwell delay lines (in-flight mass), Q + phase
 * registers, and the tick clock / photon count / RNG state so a
 * restore replays bit-for-bit. iB/iPB are scratch write buffers and
 * iR is recaptured at the top of every tick — neither persists. */
static uint8_t *iSNAP;
static size_t   iSNAP_SZ;
static int      iSNAP_N, iSNAP_CH, iSNAP_TICK, iSNAP_PHN;
static uint32_t iSNAP_RNG;

void meso3i_save(void) {
    const size_t sz = (size_t)IN * INCH + (size_t)IN * IMOV * (NNU + 1) + (size_t)IN * 4
                    + (size_t)IN * IMOV * IKMAX * sizeof(uint16_t);
    if (iSNAP_SZ < sz) {
        free(iSNAP);
        iSNAP = malloc(sz);
        iSNAP_SZ = iSNAP ? sz : 0;
    }
    if (!iSNAP) return;
    uint8_t *p = iSNAP;
    memcpy(p, iA,  (size_t)IN * INCH);                        p += (size_t)IN * INCH;
    memcpy(p, iPA, (size_t)IN * IMOV * NNU);                  p += (size_t)IN * IMOV * NNU;
    memcpy(p, iRA, (size_t)IN * IMOV);                        p += (size_t)IN * IMOV;
    memcpy(p, iLT, (size_t)IN);                               p += IN;
    memcpy(p, iQ,  (size_t)IN);                               p += IN;
    memcpy(p, iPH, (size_t)IN);                               p += IN;
    memcpy(p, iE,  (size_t)IN);                               p += IN;
    memcpy(p, iD,  (size_t)IN * IMOV * IKMAX * sizeof(uint16_t));
    iSNAP_N = IN; iSNAP_CH = INCH;
    iSNAP_TICK = ITICK; iSNAP_PHN = IPHN; iSNAP_RNG = irng;
}
int meso3i_restore(void) {
    if (!iSNAP || iSNAP_N != IN || iSNAP_CH != INCH) return -1;
    uint8_t *p = iSNAP;
    memcpy(iA,  p, (size_t)IN * INCH);                        p += (size_t)IN * INCH;
    memcpy(iPA, p, (size_t)IN * IMOV * NNU);                  p += (size_t)IN * IMOV * NNU;
    memcpy(iRA, p, (size_t)IN * IMOV);                        p += (size_t)IN * IMOV;
    memcpy(iLT, p, (size_t)IN);                               p += IN;
    memcpy(iQ,  p, (size_t)IN);                               p += IN;
    memcpy(iPH, p, (size_t)IN);                               p += IN;
    memcpy(iE,  p, (size_t)IN);                               p += IN;
    memcpy(iD,  p, (size_t)IN * IMOV * IKMAX * sizeof(uint16_t));
    ITICK = iSNAP_TICK; IPHN = iSNAP_PHN; irng = iSNAP_RNG;
    return 0;
}
