/*
 * kernel.cu — CUDA port of planck3_node_tick (sync semantics only).
 *
 * Per tick, per batch of stacked sub-grids:
 *   1. smx_force_kernel    — re-apply sparse pinned registers (walls)
 *   2. smx_tick_kernel     — pure g_rd reads; writes q/spin/heat/tension
 *                            to g_wr; ALL buffer contributions (own nb2
 *                            + divert/spray pushes) CAS-add into the
 *                            g_push u16 plane (packed-u32 emulation —
 *                            CUDA has no 16-bit atomicAdd)
 *   3. smx_publish_kernel  — g_wr.buffer = min(255, g_push[i])
 *   4. host swaps d_rd/d_wr — no publish memcpy (unlike wasm build,
 *                            nothing external holds the pointer)
 *
 * Bit-exactness vs planck3.c --sync: identical integer math throughout.
 * The sequential per-push saturation in pushq_flush equals
 * min(255, nb2 + Σpushes) because all pushes are positive — so order-
 * free atomic accumulation is provably equivalent. Spray counters use
 * u64 atomics (telemetry only).
 */
#include "node3.h"
#include <cuda_runtime.h>
#include <stdio.h>
#include <math.h>
#include <string.h>
#include <vector>
#include <utility>

// ---- constant-memory tables (filled once from host-computed values) --
__constant__ int8_t  c_POFF[2][13][3];
__constant__ uint8_t c_BACK3[13];
__constant__ uint8_t c_REV3[13];
__constant__ int16_t c_V3[13][3];
__constant__ int16_t c_DOTS[13][13];
__constant__ uint16_t c_BWF[SM_FCC_BW + 1];
__constant__ int32_t c_W, c_H, c_D, c_N3;
__constant__ int32_t c_dissipation, c_thermal_limit;

// Host-side mirrors (built once at init — same code as planck3.c).
static const int8_t HOFF[2][7][2] = {
    {{0,0},{1,0},{0,1},{-1,1},{-1,0},{-1,-1},{0,-1}},
    {{0,0},{1,0},{1,1},{0,1},{-1,0},{0,-1},{1,-1}}
};
static const uint8_t BACK3[13] = {0, 4, 5, 6, 1, 2, 3, 11, 12, 10, 9, 7, 8};
static const uint8_t ZU3[3] = {1, 3, 5};
static const uint8_t ZD3[3] = {2, 4, 6};
static const int16_t V3[13][3] = {
    {0,0,0},
    {256,0,0}, {128,222,0}, {-128,222,0}, {-256,0,0}, {-128,-222,0}, {128,-222,0},
    {148,0,209}, {-74,128,209}, {-74,-128,209},
    {74,128,-209}, {-148,0,-209}, {74,-128,-209}
};

__device__ static inline int tshare3(int v) { return (v * 3) / 48; }
__device__ static inline int hshare3(int v) { return (v * 2) / 36; }

__device__ static inline uint8_t dir3(int32_t vx, int32_t vy, int32_t vz) {
    if (vx == 0 && vy == 0 && vz == 0) return 0;
    int bs = 0; int32_t bd = INT32_MIN;
    for (int s = 1; s <= 12; s++) {
        int32_t d = c_V3[s][0] * vx + c_V3[s][1] * vy + c_V3[s][2] * vz;
        if (d > bd) { bd = d; bs = s; }
    }
    return (uint8_t)bs;
}

// Deterministic floor noise — replaces the serial rng_next() stream.
// Observational equivalence argument in node3.h: fires only below
// HEAT_FLOOR and hshare3(1..3)==0 so it never reaches a channel.
__device__ static inline uint32_t smx_hash(int32_t i, uint32_t t) {
    uint32_t r = (uint32_t)i * 2654435761u ^ t * 40503u;
    r ^= r << 13; r ^= r >> 17; r ^= r << 5;
    return r;
}

// CUDA has no 16-bit atomicAdd (max overload is u32). Emulate u16 add on
// the push plane via packed-u32 CAS — two cells per word, little-endian
// halves. Contention is bounded (a cell receives <=13 writers: its own
// buffer + 12 neighbors), and the u16 sum can never exceed 3315, so the
// saturate branch is dead-code insurance only.
__device__ static inline void smx_push_add(uint16_t *p, unsigned int v) {
    uintptr_t a = reinterpret_cast<uintptr_t>(p);
    unsigned int *w = reinterpret_cast<unsigned int*>(a & ~uintptr_t(3));
    const unsigned int sh = (a & 2) ? 16 : 0;
    unsigned int old = *w, assumed;
    do {
        assumed = old;
        unsigned int s = ((assumed >> sh) & 0xFFFFu) + v;
        if (s > 0xFFFFu) s = 0xFFFFu;
        old = atomicCAS(w, assumed,
                        (assumed & ~(0xFFFFu << sh)) | (s << sh));
    } while (old != assumed);
}

// ---- the node kernel: pure read g_rd → write g_wr, pushes via atomic
__global__ void smx_tick_kernel(const SmNode *__restrict__ rd,
                                SmNode *__restrict__ wr,
                                uint16_t *__restrict__ push,
                                uint64_t *sprayEv, uint64_t *sprayQ,
                                int batchN3, uint32_t tick) {
    int64_t gid = (int64_t)blockIdx.x * blockDim.x + threadIdx.x;
    if (gid >= batchN3) return;
    int32_t i = (int32_t)(gid % c_N3);          // batch-local index
    int32_t z = i / (c_H * c_W);
    int32_t rem = i - z * c_H * c_W;
    int32_t y = rem / c_W, x = rem - y * c_W;
    const int8_t (*off)[3] = c_POFF[y & 1];
    int64_t base = gid - i;                     // batch base

    const SmNode *self = &rd[gid];
    int cq = self->quanta, cs = self->spin, ch = self->heat;
    int tn0 = self->tension, cb = self->buffer;

    // Resolve the 12 ports: x/y wrap within batch, z is a hard wall.
    const SmNode *nb[13];
    int64_t key[13];
    nb[0] = 0; key[0] = -1;
    for (int d = 1; d <= 12; d++) {
        int nz = z + off[d][2];
        if (nz < 0 || nz >= c_D) { key[d] = -1; nb[d] = 0; continue; }
        int nx = (x + off[d][0] + c_W) % c_W;
        int ny = (y + off[d][1] + c_H) % c_H;
        key[d] = base + ((int32_t)nz * c_H + ny) * c_W + nx;
        nb[d] = &rd[key[d]];
    }

    int deadlocked = 0;
    if (cs != 0) {
        if (key[cs] < 0) deadlocked = 1;
        else if (nb[cs]->quanta + nb[cs]->buffer > SM_DEADLOCK) deadlocked = 1;
    }

    int heatSum = 0, kin = 0, maxCong = 0, congSpin = cs, incoming = 0;
    int32_t mx = 0, my = 0, mz = 0;
    int tSum = 0, gx = 0, gy = 0, gz_ = 0, gMaxD = 0;
    int64_t gKey = -1;
    const int feelsTension = (cq > 0 && cs != 0);

    for (int d = 1; d <= 12; d++) {
        if (key[d] < 0) continue;
        const SmNode *np = nb[d];
        heatSum += hshare3(np->heat);
        int nOcc = np->quanta + np->buffer;
        tSum += tshare3(np->tension);
        int gd = np->tension - tn0;
        if (gd > gMaxD && np->spin != 0) { gMaxD = gd; gKey = key[d]; }
        if (feelsTension) { gx += c_V3[d][0] * gd; gy += c_V3[d][1] * gd; gz_ += c_V3[d][2] * gd; }

        int nq = np->quanta, ns = np->spin;
        if (nq > 0 && ns == c_BACK3[d]) {
            int sent = nq > SM_FLOW_CAP ? SM_FLOW_CAP : nq;
            kin += sent * SM_KINETIC_BASE;
            if (cq > 0 && cs != 0) kin += sent * ((256 - c_DOTS[ns][cs]) >> 6);
            if (cq + cb <= SM_DEADLOCK) {
                incoming += sent;
                mx -= c_V3[d][0] * sent; my -= c_V3[d][1] * sent; mz -= c_V3[d][2] * sent;
            }
        }
        if (nOcc > maxCong && nOcc <= SM_DEADLOCK) { maxCong = nOcc; congSpin = d; }
    }

    int nq2 = cq, shunt = 0;
    if (cq > 0 && cs != 0) {
        if (!deadlocked) nq2 = cq - (cq > SM_FLOW_CAP ? SM_FLOW_CAP : cq);
        else { shunt = 1; kin += cq * SM_KINETIC_SHUNT; }
    }

    // Tension shear divert → deferred push (CAS add; equivalent to
    // pushq_add then flush — see header comment).
    if (gKey >= 0 && incoming > 0 && SM_T_DIVERT < 16) {
        int pv = incoming >> SM_T_DIVERT;
        if (pv > 255) pv = 255;                  // matches pushq_add clamp
        if (pv > 0) smx_push_add(&push[gKey], (unsigned int)pv);
        incoming -= (incoming >> SM_T_DIVERT);
    }

    int nb2 = cb + incoming;
    if (nb2 > 255) { kin += (nb2 - 255) * SM_KINETIC_BP; nb2 = 255; }
    int take = nb2 < 255 - nq2 ? nb2 : 255 - nq2;
    nq2 += take; nb2 -= take;
    if (nb2 > 0) { int bleed = nb2 >> SM_BUFDECAY; nb2 -= bleed; kin += bleed; }

    int ntn = tn0 - 12 * tshare3(tn0) + tSum - (tn0 >> SM_T_DECAY)
            + ((cq + cb) > SM_T_EMIT_MIN ? ((cq + cb) >> SM_T_EMIT) : 0);
    if (ntn < 0) ntn = 0;
    if (ntn > 255) ntn = 255;
    // T_RATE=0 canonical — hash gate never passes; gradient stays zeroed.
    gx = 0; gy = 0; gz_ = 0;

    int dom = dir3(mx + gx, my + gy, mz + gz_);
    int mag = (abs(mx) + abs(my) + abs(mz)) >> 8;
    int routing = incoming + mag + (shunt ? cq : 0) + cb;
    if (routing > SM_FCC_BW) routing = SM_FCC_BW;

    int nh2 = ch - 12 * hshare3(ch) + heatSum + kin + nq2 * SM_QUANTA_HEAT;
    if (nh2 > c_thermal_limit && nq2 > 0) {
        // Unwind: spray into neighbor buffers via deferred pushes.
        atomicAdd(sprayEv, 1ull);
        atomicAdd(sprayQ, (uint64_t)(nq2 + nb2));
        int share = (nq2 + nb2) / 12;
        if (share > 0)
            for (int d = 1; d <= 12; d++)
                if (key[d] >= 0) smx_push_add(&push[key[d]], (unsigned int)share);
        nh2 = SM_HEAT_MAX; nq2 = 0; dom = 0; shunt = 1; nb2 = 0;
    } else {
        int ts = nh2 / SM_TEMP_DIV;
        nh2 -= (int)(((int64_t)(1 + ts * ts) * c_dissipation * c_BWF[routing]) >> 8);
        if (nh2 < SM_HEAT_FLOOR) nh2 = 1 + (int)(smx_hash(i, tick) % 3);
    }

    int ns2 = dom != 0 ? dom : cs;
    if (shunt) ns2 = c_REV3[cs];
    else if (maxCong > SM_FLOW_CAP && nq2 > 0) ns2 = congSpin;
    else if (cs != 0) {
        if (dom == 0) ns2 = (cq == 0) ? cs : 0;
        else ns2 = c_DOTS[cs][dom] >= 128 ? cs : dom;
    } else ns2 = dom;

    // Own buffer contribution joins the push plane — publish clamps once.
    if (nb2 > 0) smx_push_add(&push[gid], (unsigned int)nb2);

    wr[gid].quanta  = (uint8_t)nq2;
    wr[gid].spin    = (uint8_t)ns2;
    wr[gid].heat    = (uint16_t)nh2;
    wr[gid].tension = (uint8_t)ntn;
    // wr.buffer is assigned by the publish kernel.
}

__global__ void smx_publish_kernel(SmNode *__restrict__ wr,
                                   const uint16_t *__restrict__ push,
                                   int64_t total) {
    int64_t gid = (int64_t)blockIdx.x * blockDim.x + threadIdx.x;
    if (gid >= total) return;
    wr[gid].buffer = push[gid] > 255 ? 255 : (uint8_t)push[gid];
}

// Absorbing boundary: drain q/buf and damp heat on each batch's outer
// `margin` shell, pre-tick on the READ state (same slot as force).
// Absorbed mass is counted — the missing-transverse-energy channel.
__global__ void smx_drain_kernel(SmNode *__restrict__ rd,
                                 uint64_t *__restrict__ absorbed,
                                 int64_t total, int margin) {
    int64_t gid = (int64_t)blockIdx.x * blockDim.x + threadIdx.x;
    if (gid >= total) return;
    int32_t i = (int32_t)(gid % c_N3);
    int32_t z = i / (c_H * c_W);
    int32_t rem = i - z * c_H * c_W;
    int32_t y = rem / c_W, x = rem - y * c_W;
    if (x >= margin && x < c_W - margin &&
        y >= margin && y < c_H - margin &&
        z >= margin && z < c_D - margin) return;
    SmNode *p = &rd[gid];
    uint32_t m = p->quanta + p->buffer;
    if (m) atomicAdd(absorbed, (uint64_t)m);
    p->quanta = 0; p->buffer = 0;
    p->heat >>= 1;
}

// Sparse persistent forcing (pinch walls / emitters): add to pinned
// registers with the same clamps collide.mjs applies between ticks.
// fMod: 0 = every tick; p > 0 = square wave — on while tick%p < p/2
// (resonant/acoustic drive probing; backward compat: pad byte was 0).
__global__ void smx_force_kernel(SmNode *__restrict__ rd,
                                 const uint32_t *__restrict__ fIdx,
                                 const uint8_t *__restrict__ fSpin,
                                 const uint8_t *__restrict__ fTens,
                                 const uint8_t *__restrict__ fQuant,
                                 const uint8_t *__restrict__ fMod,
                                 int nForce, uint32_t tick) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= nForce) return;
    uint8_t m = fMod[i];
    if (m && ((tick % m) << 1) >= m) return;   // off-phase of the period
    SmNode *p = &rd[fIdx[i]];
    if (fQuant[i]) { int v = p->quanta + fQuant[i]; p->quanta = v > 255 ? 255 : v; }
    if (fTens[i])  { int v = p->tension + fTens[i]; p->tension = v > 255 ? 255 : v; }
    if (fSpin[i])  p->spin = fSpin[i];
}

// ---------------- host-side API (extern "C" for plain-cpp callers) ----
extern "C" {

static SmNode *d_rd = 0, *d_wr = 0;
static uint16_t *d_push = 0;
static uint64_t *d_counters = 0;   // [0]=spray_events [1]=spray_quanta [2]=absorbed
static uint32_t *d_fIdx = 0;
static uint8_t *d_fSpin = 0, *d_fTens = 0, *d_fQuant = 0, *d_fMod = 0;
static int gW = 0, gH = 0, gD = 0, gN3 = 0, gBatch = 0, gNForce = 0, gMargin = 0;
static uint32_t gTick = 0;

int smx_init(int w, int h, int d, int batch, int diss, int limit) {
    gW = w; gH = h; gD = d; gN3 = w * h * d; gBatch = batch; gTick = 0;
    int64_t total = (int64_t)gN3 * batch;

    int8_t poff[2][13][3];
    memset(poff, 0, sizeof(poff));
    for (int par = 0; par < 2; par++) {
        for (int dd = 1; dd <= 6; dd++) {
            poff[par][dd][0] = HOFF[par][dd][0];
            poff[par][dd][1] = HOFF[par][dd][1];
            poff[par][dd][2] = 0;
        }
        for (int j = 0; j < 3; j++) {
            poff[par][7 + j][0] = HOFF[par][ZU3[j]][0];
            poff[par][7 + j][1] = HOFF[par][ZU3[j]][1];
            poff[par][7 + j][2] = 1;
            poff[par][10 + j][0] = HOFF[par][ZD3[j]][0];
            poff[par][10 + j][1] = HOFF[par][ZD3[j]][1];
            poff[par][10 + j][2] = -1;
        }
    }
    int16_t dots[13][13]; uint8_t rev3[13];
    memset(dots, 0, sizeof(dots));
    for (int a = 0; a <= 12; a++) {
        int best = 0, bd = INT32_MAX;
        for (int b = 1; b <= 12; b++) {
            int dd = ((int)V3[a][0] * V3[b][0] + (int)V3[a][1] * V3[b][1] + (int)V3[a][2] * V3[b][2]) >> 8;
            dots[a][b] = (int16_t)dd;
            if (a != 0 && dd < bd) { bd = dd; best = b; }
        }
        rev3[a] = (uint8_t)best;
    }
    uint16_t bwf[SM_FCC_BW + 1];
    for (int r = 0; r <= SM_FCC_BW; r++)
        bwf[r] = (uint16_t)llround(256.0 * sqrt(1.0 - ((double)r / SM_FCC_BW) * ((double)r / SM_FCC_BW)));

    cudaMemcpyToSymbol(c_POFF, poff, sizeof(poff));
    cudaMemcpyToSymbol(c_BACK3, BACK3, sizeof(BACK3));
    cudaMemcpyToSymbol(c_REV3, rev3, sizeof(rev3));
    cudaMemcpyToSymbol(c_V3, V3, sizeof(V3));
    cudaMemcpyToSymbol(c_DOTS, dots, sizeof(dots));
    cudaMemcpyToSymbol(c_BWF, bwf, sizeof(bwf));
    cudaMemcpyToSymbol(c_W, &gW, sizeof(int32_t));
    cudaMemcpyToSymbol(c_H, &gH, sizeof(int32_t));
    cudaMemcpyToSymbol(c_D, &gD, sizeof(int32_t));
    cudaMemcpyToSymbol(c_N3, &gN3, sizeof(int32_t));
    cudaMemcpyToSymbol(c_dissipation, &diss, sizeof(int32_t));
    cudaMemcpyToSymbol(c_thermal_limit, &limit, sizeof(int32_t));

    cudaMalloc(&d_rd, total * sizeof(SmNode));
    cudaMalloc(&d_wr, total * sizeof(SmNode));
    // Pad to even count — the packed-u32 CAS on the last odd cell
    // touches the neighbouring halfword, which must be in-bounds.
    const int64_t pushN = (total + 1) & ~(int64_t)1;
    cudaMalloc(&d_push, pushN * sizeof(uint16_t));
    cudaMalloc(&d_counters, 3 * sizeof(uint64_t));   // [2] = absorbed mass
    cudaMemset(d_counters, 0, 3 * sizeof(uint64_t));
    cudaMemset(d_rd, 0, total * sizeof(SmNode));
    cudaMemset(d_wr, 0, total * sizeof(SmNode));
    return (cudaGetLastError() == cudaSuccess) ? 0 : -1;
}

int smx_set_drain(int margin) { gMargin = margin; return 0; }

int smx_set_force(const uint32_t *idx, const uint8_t *spin,
                  const uint8_t *tens, const uint8_t *quant,
                  const uint8_t *mod, int n) {
    gNForce = n;
    if (!n) return 0;
    cudaMalloc(&d_fIdx, n * sizeof(uint32_t));
    cudaMalloc(&d_fSpin, n);
    cudaMalloc(&d_fTens, n);
    cudaMalloc(&d_fQuant, n);
    cudaMalloc(&d_fMod, n);
    cudaMemcpy(d_fIdx, idx, n * sizeof(uint32_t), cudaMemcpyHostToDevice);
    cudaMemcpy(d_fSpin, spin, n, cudaMemcpyHostToDevice);
    cudaMemcpy(d_fTens, tens, n, cudaMemcpyHostToDevice);
    cudaMemcpy(d_fQuant, quant, n, cudaMemcpyHostToDevice);
    cudaMemcpy(d_fMod, mod, n, cudaMemcpyHostToDevice);
    return (cudaGetLastError() == cudaSuccess) ? 0 : -1;
}

// Load one batch's 6-byte-node P3ST planes into the padded SmNode grid.
int smx_load(int batchIdx, const uint8_t *p3st) {
    // p3st: q[n],s[n],heat16[2n],buf[n],tn[n] — packer emits this order
    const uint8_t *q = p3st, *s = q + gN3, *hb = s + gN3;
    const uint8_t *b = hb + 2 * gN3, *tn = b + gN3;
    std::vector<SmNode> tmp(gN3);
    int64_t off = (int64_t)batchIdx * gN3;
    for (int i = 0; i < gN3; i++) {
        tmp[i].quanta = q[i]; tmp[i].spin = s[i];
        tmp[i].heat = (uint16_t)(hb[2 * i] | (hb[2 * i + 1] << 8));
        tmp[i].buffer = b[i]; tmp[i].tension = tn[i];
        tmp[i]._pad[0] = tmp[i]._pad[1] = 0;
    }
    cudaMemcpy(d_rd + off, tmp.data(), gN3 * sizeof(SmNode), cudaMemcpyHostToDevice);
    return (cudaGetLastError() == cudaSuccess) ? 0 : -1;
}

void smx_tick(void) {
    gTick++;
    int64_t total = (int64_t)gN3 * gBatch;
    cudaMemsetAsync(d_push, 0, ((total + 1) & ~(int64_t)1) * sizeof(uint16_t));
    int threads = 256;
    int64_t blocks = (total + threads - 1) / threads;
    if (gNForce > 0)
        smx_force_kernel<<<(gNForce + 255) / 256, 256>>>(d_rd, d_fIdx, d_fSpin, d_fTens, d_fQuant, d_fMod, gNForce, gTick);
    if (gMargin > 0)
        smx_drain_kernel<<<(int)blocks, threads>>>(d_rd, d_counters + 2, total, gMargin);
    smx_tick_kernel<<<(int)blocks, threads>>>(d_rd, d_wr, d_push,
                                            d_counters, d_counters + 1, total, gTick);
    smx_publish_kernel<<<(int)blocks, threads>>>(d_wr, d_push, total);
    std::swap(d_rd, d_wr);                       // zero-cost publish
}

// Read back batch state into a 6-byte-plane P3ST-style blob (no header).
int smx_dump(int batchIdx, uint8_t *p3st) {
    int64_t off = (int64_t)batchIdx * gN3;
    std::vector<SmNode> tmp(gN3);
    cudaMemcpy(tmp.data(), d_rd + off, gN3 * sizeof(SmNode), cudaMemcpyDeviceToHost);
    uint8_t *q = p3st, *s = q + gN3, *hb = s + gN3;
    uint8_t *b = hb + 2 * gN3, *tn = b + gN3;
    for (int i = 0; i < gN3; i++) {
        q[i] = tmp[i].quanta; s[i] = tmp[i].spin;
        hb[2 * i] = (uint8_t)tmp[i].heat; hb[2 * i + 1] = (uint8_t)(tmp[i].heat >> 8);
        b[i] = tmp[i].buffer; tn[i] = tmp[i].tension;
    }
    return 0;
}

int smx_counters(uint64_t *ev, uint64_t *q, uint64_t *absorbed) {
    uint64_t c[3];
    cudaMemcpy(c, d_counters, sizeof(c), cudaMemcpyDeviceToHost);
    *ev = c[0]; *q = c[1]; *absorbed = c[2];
    return 0;
}

uint32_t smx_tick_id(void) { return gTick; }

void smx_free(void) {
    cudaFree(d_rd); cudaFree(d_wr); cudaFree(d_push); cudaFree(d_counters);
    cudaFree(d_fIdx); cudaFree(d_fSpin); cudaFree(d_fTens); cudaFree(d_fQuant);
    d_rd = d_wr = 0; d_push = 0; d_counters = 0;
    d_fIdx = 0; d_fSpin = d_fTens = d_fQuant = 0;
    gNForce = 0;
}

} // extern "C"
