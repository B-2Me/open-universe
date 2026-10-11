/*
 * planck3.c — True FCC (A-B-C) 12-port 3D substrate for the Planck engine.
 * RFC-049: chunk-and-halo memory architecture with a flat-array control.
 *
 * Bit-identical port of tickFCC() in engine-sim.mjs under the canonical
 * flags (engine+intmom+spray: FLOW_CAP, Phase Lock, SPRAY, tension,
 * congestion gravity, FCC bandwidth ceiling). Mirrors the harness — keep
 * the two in sync.
 *
 * Geometry (RFC-048): stacked-hex close packing, parity-free. Every
 * layer offers zenith ports at planar dirs {1,3,5} and nadir ports at
 * {2,4,6}; a fixed port index repeats its offset each layer, tracing a
 * straight 3D diagonal through the A->B->C->A cycle. Spin 1-6 equatorial,
 * 7-9 zenith, 10-12 nadir, 0 dead. Planar wrap; z is a hard surface.
 *
 * Memory models:
 *   tick_flat3()   — flat Node3[N3] arrays, arithmetic neighbor indexing
 *                    (the RFC-§2 "naive flat" control; an NT3 lookup table
 *                    as in the harness would only add ~20MB of traffic).
 *   tick_chunk3()  — 20^3-interior chunks padded to 22^3 with a 1-node
 *                    ghost ring (RFC-§3): a halo exchange refreshes the
 *                    copies before each tick; physics reads strictly
 *                    inside the chunk block. Mid-sweep buffer mutations
 *                    (tension divert, unwind spray) resolve through to
 *                    the OWNER chunk's live cell so later-ticked cells
 *                    see them — chunks hold no cross-chunk pointers;
 *                    ownership is resolved arithmetically.
 *                    Known corner: a push into a chunk EDGE/CORNER cell
 *                    shared by >=3 chunks leaves third-party ghost copies
 *                    stale for the remainder of that tick — pushes only
 *                    occur under knot conditions, and the laminar regime
 *                    (where bit-identity is claimed) emits none.
 *   Sweep order    — chunks tick in (zc,yc,xc) order, cells in (z,y,x);
 *                    identical to the flat global order wherever no
 *                    mid-sweep pushes exist (see above).
 */

#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <math.h>
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif

// --- Geometry ---
#define W3 (100)
#define H3 (100)
#define D3 (40)
#define N3 (W3 * H3 * D3)

// --- Physics constants (canonical — mirror engine-sim.mjs) ---
#define DEADLOCK (200)
#define HEAT_MAX (65535)
#define KINETIC_BASE (1)
#define KINETIC_SHUNT (5)
#define KINETIC_BACKPRESSURE (10)
#define QUANTA_HEAT_GEN (15)
#define TEMP_SCALAR_DIV (200)
#define HEAT_FLOOR (2)
#define FLOW_CAP (160)
#define BUFDECAY (4)
#define FCC_BW (440)
#define KNOB_DISS (15)
#define KNOB_LIMIT (50000)
#define T_EMIT (4)
#define T_EMIT_MIN (200)
#define T_DECAY (5)
#define T_PULL (4)
#define T_RATE (0)
#define T_DIVERT (4)

typedef struct {
    uint8_t quanta;
    uint8_t spin;
    uint16_t heat;
    uint8_t buffer;
    uint8_t tension;
} Node3; // 6 bytes — same register set as PlanckNode

static Node3 *g_rd = NULL, *g_wr = NULL;
static uint32_t cur_tick = 0;

// Deterministic floor noise (replaces Math.random — same 1..3 range,
// reproducible across runs; never touches mass channels).
static uint32_t rng_state = 0x9E3779B9u;
static inline uint32_t rng_next(void) {
    rng_state ^= rng_state << 13; rng_state ^= rng_state >> 17; rng_state ^= rng_state << 5;
    return rng_state;
}

// Odd-r offset hex rows (mirrors HOFF); planar parity alternates.
static const int8_t HOFF[2][7][2] = {
    {{0,0},{1,0},{0,1},{-1,1},{-1,0},{-1,-1},{0,-1}},
    {{0,0},{1,0},{1,1},{0,1},{-1,0},{0,-1},{1,-1}}
};
static const uint8_t BACK3[13] = {0, 4, 5, 6, 1, 2, 3, 11, 12, 10, 9, 7, 8};
static const uint8_t ZU3[3] = {1, 3, 5};
static const uint8_t ZD3[3] = {2, 4, 6};

// Unit port vectors at x256 fixed point (FZ=209=sqrt(2/3)*256,
// FP=148=(1/sqrt(3))*256 — values baked to match Math.round output).
static const int16_t V3[13][3] = {
    {0,0,0},
    {256,0,0}, {128,222,0}, {-128,222,0}, {-256,0,0}, {-128,-222,0}, {128,-222,0},
    {148,0,209}, {-74,128,209}, {-74,-128,209},
    {74,128,-209}, {-148,0,-209}, {74,-128,-209}
};
// Angular-distance LUT (x256 cosine) + antipodal port — built at init.
static int16_t DOTS[13][13];
static uint8_t REV3[13];
// Per-parity port offsets (dx,dy,dz) — the NT3 table in arithmetic form.
static int8_t POFF[2][13][3];
// Quadrature bandwidth LUT: BWF3[r] = round(256*sqrt(1-(r/FCC_BW)^2)).
static uint16_t BWF3_LUT[FCC_BW + 1];

static void fcc_tables_init(void) {
    for (int par = 0; par < 2; par++) {
        for (int d = 1; d <= 6; d++) {
            POFF[par][d][0] = HOFF[par][d][0];
            POFF[par][d][1] = HOFF[par][d][1];
            POFF[par][d][2] = 0;
        }
        for (int j = 0; j < 3; j++) {
            POFF[par][7 + j][0] = HOFF[par][ZU3[j]][0];
            POFF[par][7 + j][1] = HOFF[par][ZU3[j]][1];
            POFF[par][7 + j][2] = 1;
            POFF[par][10 + j][0] = HOFF[par][ZD3[j]][0];
            POFF[par][10 + j][1] = HOFF[par][ZD3[j]][1];
            POFF[par][10 + j][2] = -1;
        }
    }
    for (int a = 0; a <= 12; a++) {
        int best = 0, bd = INT32_MAX;
        for (int b = 1; b <= 12; b++) {
            int d = ((int)V3[a][0] * V3[b][0] + (int)V3[a][1] * V3[b][1] + (int)V3[a][2] * V3[b][2]) >> 8;
            DOTS[a][b] = (int16_t)d;
            if (a != 0 && d < bd) { bd = d; best = b; }
        }
        REV3[a] = (uint8_t)best;
    }
    for (int r = 0; r <= FCC_BW; r++)
        BWF3_LUT[r] = (uint16_t)llround(256.0 * sqrt(1.0 - ((double)r / FCC_BW) * ((double)r / FCC_BW)));
}

static inline int tshare3(int v) { return (v * 3) / 48; } // 3/(4*12) per channel
static inline int hshare3(int v) { return (v * 2) / 36; } // 2/(3*12) per channel

// Nearest port to a momentum vector (argmax dot — dir3 in the harness).
static inline uint8_t dir3(int32_t vx, int32_t vy, int32_t vz) {
    if (vx == 0 && vy == 0 && vz == 0) return 0;
    int bs = 0; int32_t bd = INT32_MIN;
    for (int s = 1; s <= 12; s++) {
        int32_t d = V3[s][0] * vx + V3[s][1] * vy + V3[s][2] * vz;
        if (d > bd) { bd = d; bs = s; }
    }
    return (uint8_t)bs;
}

// ---------------------------------------------------------
// Shared node physics. nb[] carries per-port read pointers (the flat
// array cell or the chunk block cell — ghost copies included); key[]
// carries an opaque per-port target token for pushes (-1 = z-wall).
// resolve() maps a key to the OWNER cell for buffer pushes — flat mode
// returns &g_rd[key]; chunk mode resolves owner chunk + interior pos.
// ---------------------------------------------------------
typedef Node3 *(*resolve_fn)(void *ctx, int32_t key);

static inline void fcc_node_tick(int32_t gidx,
                                 const Node3 *self, const Node3 *nb[13], const int32_t key[13],
                                 resolve_fn resolve, void *ctx, Node3 *out) {
    int cq = self->quanta, cs = self->spin, ch = self->heat, tn0 = self->tension;
    int cb = self->buffer;

    int deadlocked = 0;
    if (cs != 0) {
        if (key[cs] < 0) deadlocked = 1;
        else if (nb[cs]->quanta + nb[cs]->buffer > DEADLOCK) deadlocked = 1;
    }

    int heatSum = 0, kin = 0, maxCong = 0, congSpin = cs, incoming = 0;
    int32_t mx = 0, my = 0, mz = 0;
    int tSum = 0, gx = 0, gy = 0, gz_ = 0, gKey = -1, gMaxD = 0;
    const int feelsTension = (cq > 0 && cs != 0);

    for (int d = 1; d <= 12; d++) {
        if (key[d] < 0) continue; // hard z-surface — no channel
        const Node3 *np = nb[d];
        heatSum += hshare3(np->heat);
        int nOcc = np->quanta + np->buffer;
        tSum += tshare3(np->tension);
        int gd = np->tension - tn0;
        if (gd > gMaxD && np->spin != 0) { gMaxD = gd; gKey = key[d]; }
        if (feelsTension) { gx += V3[d][0] * gd; gy += V3[d][1] * gd; gz_ += V3[d][2] * gd; }

        int nq = np->quanta, ns = np->spin;
        if (nq > 0 && ns == BACK3[d]) {
            int sent = nq > FLOW_CAP ? FLOW_CAP : nq;
            kin += sent * KINETIC_BASE;
            if (cq > 0 && cs != 0) kin += sent * ((256 - DOTS[ns][cs]) >> 6);
            if (cq + cb <= DEADLOCK) {
                incoming += sent;
                mx -= V3[d][0] * sent; my -= V3[d][1] * sent; mz -= V3[d][2] * sent;
            }
        }
        if (nOcc > maxCong && nOcc <= DEADLOCK) { maxCong = nOcc; congSpin = d; }
    }

    int nq2 = cq, shunt = 0;
    if (cq > 0 && cs != 0) {
        if (!deadlocked) nq2 = cq - (cq > FLOW_CAP ? FLOW_CAP : cq);
        else { shunt = 1; kin += cq * KINETIC_SHUNT; }
    }

    // Tension shear: arrivals >>4 deflect into the up-gradient flowing
    // neighbor's buffer — owner write, so later-ticked cells see it.
    if (gKey >= 0 && incoming > 0 && T_DIVERT < 16) {
        Node3 *tgt = resolve(ctx, gKey);
        int room = 255 - tgt->buffer;
        int push = incoming >> T_DIVERT;
        if (push > room) push = room;
        incoming -= push;
        tgt->buffer += (uint8_t)push;
    }

    int nb2 = cb + incoming;
    if (nb2 > 255) { kin += (nb2 - 255) * KINETIC_BACKPRESSURE; nb2 = 255; }
    int take = nb2 < 255 - nq2 ? nb2 : 255 - nq2;
    nq2 += take; nb2 -= take;
    if (nb2 > 0) { int bleed = nb2 >> BUFDECAY; nb2 -= bleed; kin += bleed; }

    int ntn = tn0 - 12 * tshare3(tn0) + tSum - (tn0 >> T_DECAY)
            + ((cq + cb) > T_EMIT_MIN ? ((cq + cb) >> T_EMIT) : 0);
    if (ntn < 0) ntn = 0;
    if (ntn > 255) ntn = 255;
    // T_RATE=0 canonical — the hash gate is ported verbatim anyway.
    if ((((uint32_t)gidx * 2654435761u + cur_tick * 40503u) & 255u) < T_RATE) {
        gx <<= T_PULL; gy <<= T_PULL; gz_ <<= T_PULL;
    } else { gx = 0; gy = 0; gz_ = 0; }

    int dom = dir3(mx + gx, my + gy, mz + gz_);
    int mag = (abs(mx) + abs(my) + abs(mz)) >> 8;
    int routing = incoming + mag + (shunt ? cq : 0) + cb;
    if (routing > FCC_BW) routing = FCC_BW;

    int nh2 = ch - 12 * hshare3(ch) + heatSum + kin + nq2 * QUANTA_HEAT_GEN;
    if (nh2 > KNOB_LIMIT && nq2 > 0) {
        // Unwind: the knot unspools into neighbor buffers (spray).
        int share = (nq2 + nb2) / 12;
        for (int d = 1; d <= 12; d++) {
            if (key[d] < 0) continue;
            Node3 *tgt = resolve(ctx, key[d]);
            int add = 255 - tgt->buffer;
            if (share < add) add = share;
            tgt->buffer += (uint8_t)add;
        }
        nh2 = HEAT_MAX; nq2 = 0; dom = 0; shunt = 1; nb2 = 0;
    } else {
        int ts = nh2 / TEMP_SCALAR_DIV;
        nh2 -= (int)(((int64_t)(1 + ts * ts) * KNOB_DISS * BWF3_LUT[routing]) >> 8);
        if (nh2 < HEAT_FLOOR) nh2 = 1 + (int)(rng_next() % 3);
    }

    int ns2 = dom != 0 ? dom : cs;
    if (shunt) ns2 = REV3[cs];
    else if (maxCong > FLOW_CAP && nq2 > 0) ns2 = congSpin;
    else if (cs != 0) {
        if (dom == 0) ns2 = (cq == 0) ? cs : 0;
        else ns2 = DOTS[cs][dom] >= 128 ? cs : dom;
    } else ns2 = dom;

    out->quanta = (uint8_t)nq2;
    out->spin = (uint8_t)ns2;
    out->heat = (uint16_t)nh2;
    out->buffer = (uint8_t)nb2;
    out->tension = (uint8_t)ntn;
}

// ---------------------------------------------------------
// Flat engine (control): arithmetic neighbor indexing on Node3[N3].
// ---------------------------------------------------------
static Node3 *resolve_flat(void *ctx, int32_t key) {
    (void)ctx;
    return &g_rd[key];
}

static void tick_flat3(void) {
    const Node3 *nb[13];
    int32_t key[13];
    cur_tick++;
    for (int z = 0; z < D3; z++) {
        for (int y = 0; y < H3; y++) {
            const int8_t (*off)[3] = POFF[y & 1];
            for (int x = 0; x < W3; x++) {
                int32_t i = ((int32_t)z * H3 + y) * W3 + x;
                for (int d = 1; d <= 12; d++) {
                    int nz = z + off[d][2];
                    if (nz < 0 || nz >= D3) { key[d] = -1; nb[d] = NULL; continue; }
                    int nx = (x + off[d][0] + W3) % W3;
                    int ny = (y + off[d][1] + H3) % H3;
                    key[d] = ((int32_t)nz * H3 + ny) * W3 + nx;
                    nb[d] = &g_rd[key[d]];
                }
                key[0] = -1; nb[0] = NULL;
                fcc_node_tick(i, &g_rd[i], nb, key, resolve_flat, NULL, &g_wr[i]);
            }
        }
    }
    Node3 *t = g_rd; g_rd = g_wr; g_wr = t;
}

// ---------------------------------------------------------
// Chunked engine: 20^3 interior + 1-node ghost ring = 22^3 block.
// ---------------------------------------------------------
#define CW (20)
#define CB (CW + 2)
#define NCX (W3 / CW)          // 5
#define NCY (H3 / CW)          // 5
#define NCZ (D3 / CW)          // 2
#define NCHUNK (NCX * NCY * NCZ) // 50
#define BVOL (CB * CB * CB)    // 10648
#define IVOL (CW * CW * CW)    // 8000

typedef struct {
    Node3 rd[BVOL]; // interior + ghost ring (read state)
    Node3 wr[IVOL]; // interior only (write state)
    int x0, y0, z0; // global coord of interior cell (0,0,0)
} Chunk3;

static Chunk3 *chunks = NULL;

static inline int bpos(int bx, int by, int bz) { return (bz * CB + by) * CB + bx; }
static inline int ipos(int lx, int ly, int lz) { return (lz * CW + ly) * CW + lx; }

// Global coordinate of a block position within chunk c (x,y wrap; z may
// land out of range — callers check before use).
static inline void block_global(const Chunk3 *c, int bx, int by, int bz,
                                int *gx, int *gy, int *gz) {
    *gx = (c->x0 + bx - 1 + W3) % W3;
    *gy = (c->y0 + by - 1 + H3) % H3;
    *gz = c->z0 + bz - 1;
}

// Resolve a block position to the OWNER chunk's live interior cell.
static Node3 *chunk_owner(Chunk3 *c, int bp) {
    int bz = bp / (CB * CB), rem = bp % (CB * CB), by = rem / CB, bx = rem % CB;
    int gx, gy, gz;
    block_global(c, bx, by, bz, &gx, &gy, &gz);
    Chunk3 *o = &chunks[(gz / CW * NCY + gy / CW) * NCX + gx / CW];
    return &o->rd[bpos(gx % CW + 1, gy % CW + 1, gz % CW + 1)];
}

static Node3 *resolve_chunk(void *ctx, int32_t key) {
    Chunk3 *c = (Chunk3 *)ctx;
    int bp = key; // key = block pos within this chunk's 22^3 block
    int bz = bp / (CB * CB), rem = bp % (CB * CB), by = rem / CB, bx = rem % CB;
    if (bx >= 1 && bx <= CW && by >= 1 && by <= CW && bz >= 1 && bz <= CW)
        return &c->rd[bp]; // same-chunk interior
    return chunk_owner(c, bp);
}

// Phase 1 (RFC-§4): halo exchange — refresh every ghost cell from its
// owner chunk's live boundary. Out-of-range z ghosts become dead nodes;
// the channel-validity check in the tick reads global z directly, so a
// dead ghost is never mistaken for a real channel.
static void halo_exchange(void) {
    static const Node3 dead = {0, 0, 0, 0, 0};
    for (int ci = 0; ci < NCHUNK; ci++) {
        Chunk3 *c = &chunks[ci];
        for (int bz = 0; bz < CB; bz++) {
            for (int by = 0; by < CB; by++) {
                for (int bx = 0; bx < CB; bx++) {
                    if (bx >= 1 && bx <= CW && by >= 1 && by <= CW && bz >= 1 && bz <= CW)
                        continue; // interior — not a ghost
                    int gx, gy, gz;
                    block_global(c, bx, by, bz, &gx, &gy, &gz);
                    if (gz < 0 || gz >= D3) { c->rd[bpos(bx, by, bz)] = dead; continue; }
                    Chunk3 *o = &chunks[(gz / CW * NCY + gy / CW) * NCX + gx / CW];
                    c->rd[bpos(bx, by, bz)] = o->rd[bpos(gx % CW + 1, gy % CW + 1, gz % CW + 1)];
                }
            }
        }
    }
}

static void tick_chunk3(void) {
    const Node3 *nb[13];
    int32_t key[13];
    cur_tick++;
    halo_exchange();
    for (int ci = 0; ci < NCHUNK; ci++) {
        Chunk3 *c = &chunks[ci];
        for (int lz = 0; lz < CW; lz++) {
            int gz = c->z0 + lz;
            for (int ly = 0; ly < CW; ly++) {
                int gy = c->y0 + ly;
                const int8_t (*off)[3] = POFF[gy & 1];
                for (int lx = 0; lx < CW; lx++) {
                    int gx = c->x0 + lx;
                    int32_t gidx = ((int32_t)gz * H3 + gy) * W3 + gx;
                    int self_bp = bpos(lx + 1, ly + 1, lz + 1);
                    for (int d = 1; d <= 12; d++) {
                        int nz = gz + off[d][2];
                        if (nz < 0 || nz >= D3) { key[d] = -1; nb[d] = NULL; continue; }
                        int bp = self_bp + off[d][2] * CB * CB + off[d][1] * CB + off[d][0];
                        key[d] = bp;
                        nb[d] = &c->rd[bp];
                    }
                    key[0] = -1; nb[0] = NULL;
                    fcc_node_tick(gidx, &c->rd[self_bp], nb, key,
                                  resolve_chunk, c, &c->wr[ipos(lx, ly, lz)]);
                }
            }
        }
    }
    // Swap: write state becomes next tick's read state (interior only —
    // the ghost ring is refreshed by the next halo exchange).
    for (int ci = 0; ci < NCHUNK; ci++) {
        Chunk3 *c = &chunks[ci];
        for (int lz = 0; lz < CW; lz++)
            for (int ly = 0; ly < CW; ly++)
                memcpy(&c->rd[bpos(1, ly + 1, lz + 1)],
                       &c->wr[ipos(0, ly, lz)], CW * sizeof(Node3));
    }
}

static int chunk_mode = 0; // 0=flat 1=halo(ghost copies) 2=ordered chunks

// Ordered-chunk variant (exact in all regimes): chunked storage, but
// the sweep follows the flat global (z,y,x) order — row-segments are
// interleaved across chunks. Neighbors resolve arithmetically to the
// owner chunk's live cell (no ghost ring, no ordering caveats — pushes
// land exactly as in flat mode). Kept as an A/B against the RFC's
// ghost-copy architecture: if the perf gap is small, exactness wins.
static Node3 *resolve_ordered(void *ctx, int32_t key) {
    (void)ctx;
    int x = key % W3, y = (key % (H3 * W3)) / W3, z = key / (H3 * W3);
    Chunk3 *o = &chunks[((z / CW) * NCY + y / CW) * NCX + x / CW];
    return &o->rd[bpos(x % CW + 1, y % CW + 1, z % CW + 1)];
}
static void tick_ordered3(void) {
    const Node3 *nb[13];
    int32_t key[13];
    cur_tick++;
    // Iterate in exact flat order; each cell's state lives inside its
    // chunk's rd interior. Neighbor pointers resolve chunk+pos by
    // arithmetic — always live, so push semantics are flat-exact.
    for (int z = 0; z < D3; z++) {
        for (int y = 0; y < H3; y++) {
            const int8_t (*off)[3] = POFF[y & 1];
            for (int x = 0; x < W3; x++) {
                int32_t i = ((int32_t)z * H3 + y) * W3 + x;
                Chunk3 *c = &chunks[((z / CW) * NCY + y / CW) * NCX + x / CW];
                int bp_self = bpos(x % CW + 1, y % CW + 1, z % CW + 1);
                for (int d = 1; d <= 12; d++) {
                    int nz = z + off[d][2];
                    if (nz < 0 || nz >= D3) { key[d] = -1; nb[d] = NULL; continue; }
                    int nx = (x + off[d][0] + W3) % W3;
                    int ny = (y + off[d][1] + H3) % H3;
                    Chunk3 *nc = &chunks[((nz / CW) * NCY + ny / CW) * NCX + nx / CW];
                    key[d] = ((int32_t)nz * H3 + ny) * W3 + nx; // unused for reads
                    nb[d] = &nc->rd[bpos(nx % CW + 1, ny % CW + 1, nz % CW + 1)];
                }
                // wr target mirrors rd's chunk-interior position
                fcc_node_tick(i, &c->rd[bp_self], nb, key,
                              resolve_ordered, c,
                              &c->wr[ipos(x % CW, y % CW, z % CW)]);
            }
        }
    }
    for (int ci = 0; ci < NCHUNK; ci++) {
        Chunk3 *c = &chunks[ci];
        for (int lz = 0; lz < CW; lz++)
            for (int ly = 0; ly < CW; ly++)
                memcpy(&c->rd[bpos(1, ly + 1, lz + 1)],
                       &c->wr[ipos(0, ly, lz)], CW * sizeof(Node3));
    }
}

EMSCRIPTEN_KEEPALIVE void fcc_init(void) {
    fcc_tables_init();
    if (!g_rd) { g_rd = calloc(N3, sizeof(Node3)); g_wr = calloc(N3, sizeof(Node3)); }
    if (!chunks) {
        chunks = calloc(NCHUNK, sizeof(Chunk3));
        for (int cz = 0; cz < NCZ; cz++)
            for (int cy = 0; cy < NCY; cy++)
                for (int cx = 0; cx < NCX; cx++) {
                    Chunk3 *c = &chunks[(cz * NCY + cy) * NCX + cx];
                    c->x0 = cx * CW; c->y0 = cy * CW; c->z0 = cz * CW;
                }
    }
    cur_tick = 0;
    rng_state = 0x9E3779B9u;
}

EMSCRIPTEN_KEEPALIVE void fcc_set_mode(int mode) { chunk_mode = mode; } // 0=flat 1=halo 2=ordered

EMSCRIPTEN_KEEPALIVE void fcc_set_node(int32_t i, int q, int s, int h, int b, int tn) {
    g_rd[i].quanta = (uint8_t)q; g_rd[i].spin = (uint8_t)s;
    g_rd[i].heat = (uint16_t)h; g_rd[i].buffer = (uint8_t)b; g_rd[i].tension = (uint8_t)tn;
}

EMSCRIPTEN_KEEPALIVE int32_t fcc_get_node(int32_t i) {
    Node3 *n = &g_rd[i];
    return (n->quanta << 24) | (n->spin << 16) | (n->buffer << 8) | n->tension;
}
EMSCRIPTEN_KEEPALIVE int32_t fcc_get_heat(int32_t i) { return g_rd[i].heat; }

// Load the flat g_rd state into the chunk interiors (pre-run), and dump
// chunk interiors back to g_rd (post-run compare/export).
static void chunks_from_flat(void) {
    for (int ci = 0; ci < NCHUNK; ci++) {
        Chunk3 *c = &chunks[ci];
        for (int lz = 0; lz < CW; lz++)
            for (int ly = 0; ly < CW; ly++)
                for (int lx = 0; lx < CW; lx++) {
                    int32_t i = ((int32_t)(c->z0 + lz) * H3 + (c->y0 + ly)) * W3 + (c->x0 + lx);
                    c->rd[bpos(lx + 1, ly + 1, lz + 1)] = g_rd[i];
                }
    }
}
static void chunks_to_flat(void) {
    for (int ci = 0; ci < NCHUNK; ci++) {
        Chunk3 *c = &chunks[ci];
        for (int lz = 0; lz < CW; lz++)
            for (int ly = 0; ly < CW; ly++)
                for (int lx = 0; lx < CW; lx++) {
                    int32_t i = ((int32_t)(c->z0 + lz) * H3 + (c->y0 + ly)) * W3 + (c->x0 + lx);
                    g_rd[i] = c->rd[bpos(lx + 1, ly + 1, lz + 1)];
                }
    }
}

EMSCRIPTEN_KEEPALIVE void fcc_prepare(void) { if (chunk_mode) chunks_from_flat(); }
EMSCRIPTEN_KEEPALIVE void fcc_collect(void) { if (chunk_mode) chunks_to_flat(); }

EMSCRIPTEN_KEEPALIVE void fcc_tick(void) {
    if (chunk_mode == 1) tick_chunk3();
    else if (chunk_mode == 2) tick_ordered3();
    else tick_flat3();
}

// Direct access for the test driver / wasm bulk state moves.
EMSCRIPTEN_KEEPALIVE uint8_t *fcc_state_pointer(void) { return (uint8_t *)g_rd; }
EMSCRIPTEN_KEEPALIVE int32_t fcc_node_count(void) { return N3; }
EMSCRIPTEN_KEEPALIVE int32_t fcc_dims(void) { return (W3 << 16) | (H3 << 8) | D3; }

// Telemetry snapshot (flat array is canonical — call fcc_collect() first
// after chunked runs).
EMSCRIPTEN_KEEPALIVE double fcc_total_quanta(void) {
    double t = 0;
    for (int i = 0; i < N3; i++) t += g_rd[i].quanta;
    return t;
}
EMSCRIPTEN_KEEPALIVE double fcc_deadlocked(void) {
    double n = 0;
    for (int i = 0; i < N3; i++) if (g_rd[i].quanta + g_rd[i].buffer > DEADLOCK) n++;
    return n;
}
