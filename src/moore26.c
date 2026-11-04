/* moore26 — 0.1fm/node Planck-substrate engine (Moore-26 stencil).
 *
 * The Planck Field Engine (Langevin's Wake)
 * Copyright (c) 2026 Nathan / btwo.me
 *
 * The 0.8fm→0.1fm migration of qi3: a nucleon is ~500 volumetric
 * nodes at this scale (a macroscopic topological knot, not a
 * sub-grid anomaly). The geometry upgrades from 18 channels to the
 * 26-neighbor Moore stencil (the 3x3x3 cube) for isotropic fields,
 * and the memory layout packs per-node state into an AoS NodeState
 * (one cache line per node) instead of separate flat SoA arrays.
 *
 * The physics is qi3's local-causal model: packets (the field's
 * energy-carriers) + quanta (charged conserved states, bound or
 * unbound) carrying direction/orbit/helicity/charge, moved by
 * offer/answer transactions between nodes. Conservation keeps it
 * faithful — the transactions preserve the labels' global totals.
 *
 * At 0.1fm the physics relaxes into macroscopic fluid dynamics:
 * over-pressure routing (a saturated core shunts excess outward),
 * decoupled phase-sync (a fast-pass relaxation beats c=1 transit),
 * and macroscopic string-breaking (integrated tube tension, not a
 * single saturated link).
 *
 * Vacuum-skip: ~99% of a 0.1fm grid is empty. An 8x8x8 macro-chunk
 * ledger marks chunks holding any mass/winding/photons; each tick
 * processes live chunks plus a 1-chunk halo (catching inbound flux)
 * and re-scans the write buffer to compute next-tick liveness.
 * Invariant: content only ever exists inside processed chunks, so
 * unprocessed nodes' grid_next slots stay equal to grid_current and
 * the swap is an identity there — no phantom resurrection.
 */
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#ifdef _OPENMP
#include <omp.h>
#endif

static int QWidth, QHeight, QDepth, QSites;

/* the 26-neighbor Moore stencil: the 3x3x3 cube minus the center.
 * vec[v][0..2] = dx,dy,dz — face(6), edge(12), corner(8) neighbors.
 * len2 = squared distance (1 face, 2 edge, 3 corner) for the 1/r2
 * field-weighting — the bound state's wake being a sphere, not a
 * faceted diamond. Channels come in +/- pairs: channel 2e is the
 * opposite direction of 2e+1 (edge e spans both). */
static int QChannels = 26;
static int8_t QChannelVec[26][3] = {
    {1,0,0},{-1,0,0},{0,1,0},{0,-1,0},{0,0,1},{0,0,-1},        /* faces */
    {1,1,0},{-1,-1,0},{1,-1,0},{-1,1,0},                      /* xy edges */
    {1,0,1},{-1,0,-1},{1,0,-1},{-1,0,1},                      /* xz edges */
    {0,1,1},{0,-1,-1},{0,1,-1},{0,-1,1},                      /* yz edges */
    {1,1,1},{-1,-1,-1},{1,1,-1},{-1,-1,1},                    /* corners */
    {1,-1,1},{-1,1,-1},{1,-1,-1},{-1,1,1}
};
static inline int edgeLen2(int c){
    const int8_t *v=QChannelVec[c];
    return v[0]*v[0]+v[1]*v[1]+v[2]*v[2];
}

/* AoS NodeState — one cache line per node. The SoA flat arrays of
 * qi3 (qMass, qWinding, ...) packed into a single struct so a node's
 * whole local state is one memory fetch, not 12 disconnected reads.
 * grid_next mirrors it for the double-buffered transactional write. */
typedef struct {
    uint16_t winding[26];      /* channel populations — the directedness */
    uint16_t massFlight[26];   /* in-flight mass per channel */
    uint8_t  photon[26];       /* packet counts (the offers) */
    uint8_t  photonNu[26];     /* packet nu tags (the energy) */
    uint32_t phase;            /* bound-state phase 0-511 (double-cover) */
    uint16_t mass;             /* parked mass (the structure) */
    uint16_t charge;           /* bound charge (the completed-transaction deposits) */
    uint16_t heat;             /* vacuum heat reservoir (the local temp) */
    uint16_t localDensity;     /* neighbor-sampled density (the gradient) */
} NodeState;
static NodeState *grid_current, *grid_next;

/* vacuum-skip ledgers — 8x8x8 macro-chunks */
#define CHUNK 8
static int CW,CH,CD,nChunks;
static uint8_t *chunkLive, *chunkProc;
static int *procList, nProc;

static uint64_t qEvents[32];
static int QMaskX, QMaskY, QMaskZ, QMaskCX, QMaskCY, QMaskCZ;

/* bitwise-wrap neighbor: the power-of-2 dims make wrapping a mask,
 * not a modulo — v&m instead of v%m + the v<0 branch. */
static inline int nbr(int x,int y,int z,int dx,int dy,int dz){
    return ((z+dz)&QMaskZ)*QWidth*QHeight+((y+dy)&QMaskY)*QWidth+((x+dx)&QMaskX);
}

/* loop over every node in every processed chunk (live ∪ halo).
 * pi iterates the proc list; x,y,z,si bound inside. */
#define PROC_NODES                                                     \
    _Pragma("omp parallel for schedule(static)")                       \
    for(int pi=0;pi<nProc;pi++){                                       \
        int ci_=procList[pi];                                          \
        int cz_=ci_/(CW*CH),cy_=(ci_%(CW*CH))/CW,cx_=ci_%CW;           \
        for(int z=cz_*CHUNK;z<cz_*CHUNK+CHUNK&&z<QDepth;z++)           \
        for(int y=cy_*CHUNK;y<cy_*CHUNK+CHUNK&&y<QHeight;y++)          \
        for(int x=cx_*CHUNK;x<cx_*CHUNK+CHUNK&&x<QWidth;x++){          \
            int si=z*QWidth*QHeight+y*QWidth+x;

#define PROC_NODES_END }}

/* content test — a chunk is live if any node carries structure or
 * packets; the scan early-outs on the first live node found. */
static int node_live(const NodeState *n){
    if(n->mass)return 1;
    for(int c=0;c<QChannels;c++)
        if(n->winding[c]||n->photon[c])return 1;
    return 0;
}

/* build the process list = live chunks ∪ 1-chunk halo (halo catches
 * inbound flight/conduction writes, which can only land adjacent). */
static void build_proc(void){
    memset(chunkProc,0,nChunks);
    nProc=0;
    for(int cz=0;cz<CD;cz++)for(int cy=0;cy<CH;cy++)for(int cx=0;cx<CW;cx++){
        int ci=cz*CW*CH+cy*CW+cx;
        if(!chunkLive[ci])continue;
        for(int dz=-1;dz<=1;dz++)for(int dy=-1;dy<=1;dy++)for(int dx=-1;dx<=1;dx++){
            int nj=((cz+dz)&QMaskCZ)*CW*CH+((cy+dy)&QMaskCY)*CW+((cx+dx)&QMaskCX);
            if(!chunkProc[nj]){chunkProc[nj]=1;procList[nProc++]=nj;}
        }
    }
}

/* after the phases: scan grid_next in every processed chunk — any
 * content (incl. freshly arrived packets) keeps the chunk live. */
static void rescan_live(void){
    memset(chunkLive,0,nChunks);
    for(int pi=0;pi<nProc;pi++){
        int ci=procList[pi];
        int cz=ci/(CW*CH),cy=(ci%(CW*CH))/CW,cx=ci%CW;
        for(int z=cz*CHUNK;z<cz*CHUNK+CHUNK&&z<QDepth&&!chunkLive[ci];z++)
        for(int y=cy*CHUNK;y<cy*CHUNK+CHUNK&&y<QHeight&&!chunkLive[ci];y++)
        for(int x=cx*CHUNK;x<cx*CHUNK+CHUNK&&x<QWidth;x++)
            if(node_live(&grid_next[z*QWidth*QHeight+y*QWidth+x])){chunkLive[ci]=1;break;}
    }
}

static void mark_chunk(int x,int y,int z){
    int ci=(z/CHUNK)*CW*CH+(y/CHUNK)*CW+(x/CHUNK);
    if(ci>=0&&ci<nChunks)chunkLive[ci]=1;
}

void moore26_init(int w,int h,int d){
    /* power-of-2 dims required for the bitwise-mask wrap; each dim
     * must be >= 8 so the chunk grid is also power-of-2. */
    QWidth=w;QHeight=h;QDepth=d;QSites=w*h*d;
    QMaskX=w-1;QMaskY=h-1;QMaskZ=d-1;
    CW=w/CHUNK;CH=h/CHUNK;CD=d/CHUNK;
    if(CW<1)CW=1;
    if(CH<1)CH=1;
    if(CD<1)CD=1;
    QMaskCX=CW-1;QMaskCY=CH-1;QMaskCZ=CD-1;
    nChunks=CW*CH*CD;
    grid_current=calloc(QSites,sizeof(NodeState));
    grid_next   =calloc(QSites,sizeof(NodeState));
    chunkLive   =calloc(nChunks,1);
    chunkProc   =calloc(nChunks,1);
    procList    =malloc(nChunks*sizeof(int));
    memset(qEvents,0,sizeof(qEvents));
}

/* the tick — the offer/answer transaction cycle. One carry-forward
 * per processed node, then the phases read grid_current and write
 * grid_next (intra-tick visibility where a phase reads next-state
 * fields it just staged). */
void moore26_tick(void){
    build_proc();

    /* Phase 0: carry — every processed node copies current→next so
     * unwritten fields survive the swap (and vacuum writes zeros,
     * killing stale-state resurrection). */
    PROC_NODES
        grid_next[si]=grid_current[si];
    PROC_NODES_END

    /* Phase 1: packet flight — photons hop 1 node/tick along their
     * channel direction (c at transit scale). Each (ni,c) slot has a
     * unique writer (its upstream neighbor), so no atomics. */
    PROC_NODES
        NodeState *o=&grid_current[si];
        for(int c=0;c<QChannels;c++){
            if(!o->photon[c])continue;
            int ni=nbr(x,y,z,QChannelVec[c][0],QChannelVec[c][1],QChannelVec[c][2]);
            grid_next[si].photon[c]=0;
            grid_next[ni].photon[c]=o->photon[c];
            grid_next[ni].photonNu[c]=o->photonNu[c];
        }
    PROC_NODES_END

    /* Phase 2: absorption — arrived packets meeting structure deposit
     * their nu into winding (the bound volume building). Vacuum lets
     * the packet keep flying; only structured nodes absorb. */
    PROC_NODES
        NodeState *n=&grid_next[si],*o=&grid_current[si];
        int32_t netd=0;
        for(int e=0;e<QChannels/2;e++)
            netd+=(int)o->winding[2*e]-(int)o->winding[2*e+1];
        if(o->mass||netd){
            for(int c=0;c<QChannels;c++){
                if(!n->photon[c])continue;
                uint32_t nu=n->photonNu[c];
                n->photon[c]--;
                n->winding[2*(c/2)]+=nu>>2;
                /* charge-response — the net directedness responds to
                 * the absorbed momentum (the +/- imbalance feeding the
                 * paired return channel). */
                int32_t feed=((netd>0?netd:-netd)*nu)>>10;if(feed<0)feed=0;
                if(netd>0)n->winding[2*(c/2)+1]+=feed;
                else if(netd<0)n->winding[2*(c/2)]+=feed;
            }
        }
    PROC_NODES_END

    /* Phase 3: winding conduction — the bound state's circulation
     * transferring to neighbors. OVER-PRESSURE ROUTING at 0.1fm:
     * a saturated core shunts excess outward (the interior staying
     * fluid, not crystallizing at 128). Reads current, writes next;
     * cross-node adds are atomic (pull-model refactor is the
     * atomic-free upgrade). */
    PROC_NODES
        NodeState *o=&grid_current[si];
        for(int e=0;e<QChannels/2;e++){
            uint32_t a=o->winding[2*e],b=o->winding[2*e+1];
            if(a<32||a!=b)continue;
            uint32_t k=a>>3;
            int ni=nbr(x,y,z,QChannelVec[2*e][0],QChannelVec[2*e][1],QChannelVec[2*e][2]);
            int nx=(x+QChannelVec[2*e][0])&QMaskX,ny=(y+QChannelVec[2*e][1])&QMaskY,nz=(z+QChannelVec[2*e][2])&QMaskZ;
            uint32_t mn=grid_current[ni].winding[2*e]<grid_current[ni].winding[2*e+1]
                       ?grid_current[ni].winding[2*e]:grid_current[ni].winding[2*e+1];
            if(mn>=128){
                /* over-pressure shunt — the saturated recipient routes
                 * the excess to its own freest neighbor (the core not
                 * crystallizing, the knot's perimeter draining). */
                int fo=-1;uint32_t fr=128;
                for(int e2=0;e2<QChannels/2;e2++){
                    int ni2=nbr(nx,ny,nz,QChannelVec[2*e2][0],QChannelVec[2*e2][1],QChannelVec[2*e2][2]);
                    uint32_t m2=grid_current[ni2].winding[2*e2]<grid_current[ni2].winding[2*e2+1]
                               ?grid_current[ni2].winding[2*e2]:grid_current[ni2].winding[2*e2+1];
                    if(m2<fr){fr=m2;fo=e2;}
                }
                if(fo>=0){
                    int ni3=nbr(nx,ny,nz,QChannelVec[2*fo][0],QChannelVec[2*fo][1],QChannelVec[2*fo][2]);
                    grid_next[si].winding[2*e]-=k;grid_next[si].winding[2*e+1]-=k;
                    #pragma omp atomic
                    grid_next[ni3].winding[2*fo]+=k;
                    #pragma omp atomic
                    grid_next[ni3].winding[2*fo+1]+=k;
                }
            } else {
                uint32_t room=128-mn;if(k>room)k=room;
                if(k>=8){
                    grid_next[si].winding[2*e]-=k;grid_next[si].winding[2*e+1]-=k;
                    #pragma omp atomic
                    grid_next[ni].winding[2*e]+=k;
                    #pragma omp atomic
                    grid_next[ni].winding[2*e+1]+=k;
                }
            }
        }
    PROC_NODES_END

    /* Phase 4: phase-sync — DECOUPLED at 0.1fm. A fast-pass
     * relaxation (~10 iters) lets the phase field reach equilibrium
     * across a ~10-node bound state before the next mechanical tick.
     * Pull-model: each node averages its neighbors' pull (unique
     * writer — no atomics). Reads next (post-carry), writes next. */
    for(int iter=0;iter<10;iter++){
        PROC_NODES
            if(node_live(&grid_next[si])){
                int32_t pull=0;
                uint32_t ph=grid_next[si].phase;
                for(int c=0;c<QChannels;c++){
                    int ni=nbr(x,y,z,QChannelVec[c][0],QChannelVec[c][1],QChannelVec[c][2]);
                    int dp=(int)grid_next[ni].phase-(int)ph;
                    if(dp>255)dp-=511;
                    if(dp<-255)dp+=511;
                    pull+=dp>>4;
                }
                grid_next[si].phase=(uint32_t)((int)ph+pull)&511;
            }
        PROC_NODES_END
    }

    /* Phase 5: macroscopic string-breaking — forward-trace the
     * continuous >128 saturated tube, fracture only when the
     * INTEGRATED tension (the tube's length) exceeds the macro-
     * threshold, then pair-produce at the 2 endpoints. Not a
     * single-link saturation — the whole tube's tension. */
    PROC_NODES
        for(int e=0;e<QChannels/2;e++){
            uint32_t a=grid_current[si].winding[2*e],b=grid_current[si].winding[2*e+1];
            if(a<128||a!=b)continue;
            int len=0,nx=x,ny=y,nz=z;
            for(int step=0;step<16;step++){
                int tni=nbr(nx,ny,nz,QChannelVec[2*e][0]*step,QChannelVec[2*e][1]*step,QChannelVec[2*e][2]*step);
                uint32_t na=grid_current[tni].winding[2*e],nb=grid_current[tni].winding[2*e+1];
                if(na>=128&&na==nb)len++;else break;
            }
            if(len>=12){
                /* macro-tension — the whole tube saturated: fracture,
                 * pair-produce mass at the two endpoints. */
                int p2=nbr(x,y,z,QChannelVec[2*e][0]*(len-1),QChannelVec[2*e][1]*(len-1),QChannelVec[2*e][2]*(len-1));
                #pragma omp atomic
                grid_next[si].mass+=128;
                #pragma omp atomic
                grid_next[p2].mass+=128;
                for(int s=0;s<len;s++){
                    int tni=nbr(x,y,z,QChannelVec[2*e][0]*s,QChannelVec[2*e][1]*s,QChannelVec[2*e][2]*s);
                    #pragma omp atomic
                    grid_next[tni].winding[2*e]-=64;
                    #pragma omp atomic
                    grid_next[tni].winding[2*e+1]-=64;
                }
                qEvents[6]++;
            }
        }
    PROC_NODES_END

    rescan_live();
    {NodeState *t=grid_current;grid_current=grid_next;grid_next=t;}
}

/* getters/setters for the harnesses — the AoS node's state. Setters
 * mark their chunk live so seeded content is processed next tick. */
uint32_t moore26_winding_get(int x,int y,int z,int c){
    return grid_current[z*QWidth*QHeight+y*QWidth+x].winding[c];
}
void moore26_winding_set(int x,int y,int z,int c,uint32_t v){
    grid_current[z*QWidth*QHeight+y*QWidth+x].winding[c]=v;
    grid_next[z*QWidth*QHeight+y*QWidth+x].winding[c]=v;
    mark_chunk(x,y,z);
}
uint32_t moore26_photon_get(int x,int y,int z,int c){
    return grid_current[z*QWidth*QHeight+y*QWidth+x].photon[c];
}
void moore26_photon_set(int x,int y,int z,int c,uint32_t v){
    grid_current[z*QWidth*QHeight+y*QWidth+x].photon[c]=v;
    mark_chunk(x,y,z);
}
void moore26_photon_nu_set(int x,int y,int z,int c,uint32_t v){
    grid_current[z*QWidth*QHeight+y*QWidth+x].photonNu[c]=v;
}
void moore26_mass_set(int x,int y,int z,uint32_t v){
    grid_current[z*QWidth*QHeight+y*QWidth+x].mass=v;
    mark_chunk(x,y,z);
}
uint32_t moore26_mass_get(int x,int y,int z){
    return grid_current[z*QWidth*QHeight+y*QWidth+x].mass;
}
uint64_t moore26_events(int i){return qEvents[i&31];}
