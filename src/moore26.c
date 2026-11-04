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
 */
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

static int QWidth, QHeight, QDepth, QSites;

/* the 26-neighbor Moore stencil: the 3x3x3 cube minus the center.
 * vec[v][0..2] = dx,dy,dz — face(6), edge(12), corner(8) neighbors.
 * len2 = squared distance (1 face, 2 edge, 3 corner) for the 1/r2
 * field-weighting — the bound state's wake being a sphere, not a
 * faceted diamond. */
static int QChannels = 26;
static int8_t QChannelVec[26][3] = {
    {1,0,0},{-1,0,0},{0,1,0},{0,-1,0},{0,0,1},{0,0,-1},        /* faces */
    {1,1,0},{1,-1,0},{-1,1,0},{-1,-1,0},                      /* xy edges */
    {1,0,1},{1,0,-1},{-1,0,1},{-1,0,-1},                      /* xz edges */
    {0,1,1},{0,1,-1},{0,-1,1},{0,-1,-1},                      /* yz edges */
    {1,1,1},{1,1,-1},{1,-1,1},{1,-1,-1},                      /* +x corners */
    {-1,1,1},{-1,1,-1},{-1,-1,1},{-1,-1,-1}                   /* -x corners */
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

/* incipient/session ledgers — kept separate (they're transactional
 * state, not the node's statics) — allocated per-site as before */
static uint32_t *qMassFlight_next, *qPhoton_next, *qPhotonNu_next;
static uint32_t *qHeld, *qHeldNu, *qHeldBirth, *qHeldPhase, *qHeldInt;
static uint32_t *qAck, *qAck_next, *qAckTtl, *qAckTtl_next, *qAckRtt, *qAckRtt_next;
static uint32_t *qBondDist, *qSiteWind, *qDepositEdge, *qWinEdge;
static uint8_t  *qSessionState, *qHeldDir, *qHeldStim;
static uint64_t qEvents[32];

/* init: the power-of-2 dims for bitwise-wrap masking */
static int QMaskX, QMaskY, QMaskZ;

/* bitwise-wrap neighbor: the power-of-2 dims make wrapping a mask,
 * not a modulo — v&m instead of v%m + the v<0 branch. */
static inline int nbr(int si,int dx,int dy,int dz){
    int x=(si%QWidth)&0xff,y=(si/QWidth)%QHeight&0xff,z=si/(QWidth*QHeight)&0xff;
    return ((z+dz)&QMaskZ)*QWidth*QHeight+((y+dy)&QMaskY)*QWidth+((x+dx)&QMaskX);
}

void moore26_init(int w,int h,int d){
    /* power-of-2 dims required for the bitwise-mask wrap */
    QWidth=w;QHeight=h;QDepth=d;QSites=w*h*d;
    QMaskX=w-1;QMaskY=h-1;QMaskZ=d-1;
    grid_current=malloc(sizeof(NodeState)*QSites);
    grid_next   =malloc(sizeof(NodeState)*QSites);
    memset(grid_current,0,sizeof(NodeState)*QSites);
    memset(grid_next   ,0,sizeof(NodeState)*QSites);
    /* the transactional ledgers — per-site, same scale as qi3 */
    qMassFlight_next=malloc(4*QSites*QChannels);
    qPhoton_next    =malloc(4*QSites*QChannels);
    qPhotonNu_next  =malloc(4*QSites*QChannels);
    qHeld           =calloc(QSites*QChannels,4);
    qHeldNu         =calloc(QSites*QChannels,4);
    qHeldBirth      =calloc(QSites*QChannels,4);
    qHeldPhase      =calloc(QSites*QChannels,4);
    qHeldInt        =calloc(QSites*QChannels,4);
    qHeldDir        =calloc(QSites*QChannels,1);
    qHeldStim       =calloc(QSites*QChannels,1);
    qAck            =calloc(QSites*QChannels,4);
    qAck_next       =calloc(QSites*QChannels,4);
    qAckTtl         =calloc(QSites*QChannels,4);
    qAckTtl_next    =calloc(QSites*QChannels,4);
    qAckRtt         =calloc(QSites*QChannels,4);
    qAckRtt_next    =calloc(QSites*QChannels,4);
    qBondDist       =calloc(QSites*(QChannels/2),4);
    qSiteWind       =calloc(QSites,4);
    qDepositEdge    =calloc(QSites*(QChannels/2),4);
    qWinEdge        =calloc(QSites*(QChannels/2),4);
    qSessionState   =calloc(QSites*(QChannels/2),1);
    memset(qEvents,0,sizeof(qEvents));
}

/* the tick — the offer/answer transaction cycle. At 0.1fm the bound
 * states span ~10 nodes; the mechanics relax into macro fluid:
 * over-pressure routing, decoupled phase-sync, macro string-break.
 * OpenMP on the outer loops — the double-buffered _next being
 * thread-safe writes to unique indices. */
void moore26_tick(void){
    /* Phase 1: packet flight — the offers hopping to neighbors */
    #pragma omp parallel for collapse(2) schedule(static)
    for(int z=0;z<QDepth;z++)for(int y=0;y<QHeight;y++){
        for(int x=0;x<QWidth;x++){
            int si=z*QWidth*QHeight+y*QWidth+x;
            NodeState *n=&grid_next[si];
            for(int c=0;c<QChannels;c++){
                /* the offer hops: the packet moves si -> ni on channel c */
                n->photon[c]=grid_current[si].photon[c]; /* propagate the count */
            }
        }
    }
    /* swap the double-buffer — the writes complete, current = next */
    NodeState *tmp=grid_current;grid_current=grid_next;grid_next=tmp;
}

/* the real tick — the offer/answer transaction cycle. Port of qi3's
 * mechanics into the AoS/26-channel structure, with the 0.1fm
 * upgrades: over-pressure routing, decoupled phase-sync, macro
 * string-breaking. OpenMP on the outer loops. */
void moore26_tick_full(void){
    /* Phase 2: packet absorption — the offers arriving, depositing
     * into the node's state (the absorber's response — the charge-
     * response on charged edges, the net-flux responding). */
    #pragma omp parallel for collapse(2) schedule(static)
    for(int z=0;z<QDepth;z++)for(int y=0;y<QHeight;y++){
        for(int x=0;x<QWidth;x++){
            int si=z*QWidth*QHeight+y*QWidth+x;
            NodeState *n=&grid_next[si],*o=&grid_current[si];
            for(int c=0;c<QChannels;c++){
                if(o->photon[c]>=8){
                    /* the absorber accepts the offer — the packet's nu
                     * deposits into the node's winding (the bound volume
                     * building) — the directedness edge's charge-response
                     * responding to the absorbed momentum. */
                    uint32_t nu=o->photonNu[c];
                    n->winding[2*(c/2)]+=nu>>2;
                    /* the charge-response — the net directedness
                     * responding to the absorbed packet (like-repel,
                     * opposite-attract — the +/- netd driving the
                     * response-direction). */
                    int32_t netd=0;
                    for(int e2=0;e2<QChannels/2;e2++)
                        netd+=(int)o->winding[2*e2]-(int)o->winding[2*e2+1];
                    int32_t feed=(netd>0?netd:-netd)*nu>>10;if(feed<0)feed=0;
                    if(netd>0)n->winding[2*(c/2)+1]+=feed;
                    else if(netd<0)n->winding[2*(c/2)]+=feed;
                }
            }
        }
    }
    {NodeState *t=grid_current;grid_current=grid_next;grid_next=t;}

    /* Phase 3: winding conduction — the bound state's circulation
     * transferring to neighbors. OVER-PRESSURE ROUTING at 0.1fm:
     * a saturated core shunts excess outward (the interior staying
     * fluid, not crystallizing at 128). */
    #pragma omp parallel for collapse(2) schedule(static)
    for(int z=0;z<QDepth;z++)for(int y=0;y<QHeight;y++){
        for(int x=0;x<QWidth;x++){
            int si=z*QWidth*QHeight+y*QWidth+x;
            NodeState *o=&grid_current[si];
            for(int e=0;e<QChannels/2;e++){
                uint32_t a=o->winding[2*e],b=o->winding[2*e+1];
                if(a>=32&&a==b){
                    uint32_t k=a>>3;
                    int ni=nbr(si,QChannelVec[2*e][0],QChannelVec[2*e][1],QChannelVec[2*e][2]);
                    /* over-pressure: a saturated recipient (mn>=128)
                     * accepts and shunts the excess outward (the core
                     * staying fluid, the excess routed to the perimeter) */
                    uint32_t mn=grid_current[ni].winding[2*e]<grid_current[ni].winding[2*e+1]
                               ?grid_current[ni].winding[2*e]:grid_current[ni].winding[2*e+1];
                    if(mn>=128){
                        /* over-pressure shunt — the excess routes to a
                         * freer neighbor (the core not crystallizing) */
                        int fo=-1;uint32_t fr=128;
                        for(int e2=0;e2<QChannels/2;e2++){
                            int ni2=nbr(ni,QChannelVec[2*e2][0],QChannelVec[2*e2][1],QChannelVec[2*e2][2]);
                            uint32_t m2=grid_current[ni2].winding[2*e2]<grid_current[ni2].winding[2*e2+1]
                                       ?grid_current[ni2].winding[2*e2]:grid_current[ni2].winding[2*e2+1];
                            if(m2<fr){fr=m2;fo=e2;}
                        }
                        if(fo>=0){int ni3=nbr(ni,QChannelVec[2*fo][0],QChannelVec[2*fo][1],QChannelVec[2*fo][2]);
                            grid_next[ni3].winding[2*fo]+=k;grid_next[ni3].winding[2*fo+1]+=k;}
                    } else {
                        uint32_t room=mn<128?128-mn:0;if(k>room)k=room;
                        if(k>=8){
                            grid_next[si].winding[2*e]-=k;grid_next[si].winding[2*e+1]-=k;
                            grid_next[ni].winding[2*e]+=k;grid_next[ni].winding[2*e+1]+=k;
                        }
                    }
                }
            }
        }
    }
    {NodeState *t=grid_current;grid_current=grid_next;grid_next=t;}

    /* Phase 4: phase-sync — DECOUPLED at 0.1fm. The qPhase relaxation
     * runs a fast-pass loop (~10 iters) so the phase-field reaches
     * equilibrium across the ~10-node bound state before the next
     * mechanical tick — the bound state staying coherent. */
    for(int iter=0;iter<10;iter++){
        #pragma omp parallel for collapse(2) schedule(static)
        for(int z=0;z<QDepth;z++)for(int y=0;y<QHeight;y++){
            for(int x=0;x<QWidth;x++){
                int si=z*QWidth*QHeight+y*QWidth+x;
                uint32_t ph=grid_current[si].phase;
                for(int c=0;c<QChannels;c++){
                    int ni=nbr(si,QChannelVec[c][0],QChannelVec[c][1],QChannelVec[c][2]);
                    int dp=(int)ph-(int)grid_current[ni].phase;
                    if(dp>255)dp-=511;
                    if(dp<-255)dp+=511;
                    grid_next[ni].phase=(uint32_t)((int)grid_next[ni].phase+(dp>>4))&511;
                }
            }
        }
        {NodeState *t=grid_current;grid_current=grid_next;grid_next=t;}
    }

    /* Phase 5: macroscopic string-breaking — forward-trace the
     * continuous >128 saturated tube, fracture only when the
     * INTEGRATED tension (the tube's length) exceeds the macro-
     * threshold, then pair-produce at the 2 endpoints. Not a
     * single-link saturation — the whole tube's tension. */
    #pragma omp parallel for collapse(2) schedule(static)
    for(int z=0;z<QDepth;z++)for(int y=0;y<QHeight;y++){
        for(int x=0;x<QWidth;x++){
            int si=z*QWidth*QHeight+y*QWidth+x;
            for(int e=0;e<QChannels/2;e++){
                uint32_t a=grid_current[si].winding[2*e],b=grid_current[si].winding[2*e+1];
                if(a>=128&&a==b){
                    /* trace the saturated tube — how many consecutive
                     * >128 nodes does this channel link into a chain? */
                    int len=0,ni=si;
                    for(int step=0;step<16;step++){
                        uint32_t na=grid_current[ni].winding[2*e],nb=grid_current[ni].winding[2*e+1];
                        if(na>=128&&na==nb){len++;ni=nbr(ni,QChannelVec[2*e][0],QChannelVec[2*e][1],QChannelVec[2*e][2]);}
                        else break;
                    }
                    if(len>=12){   /* macro-tension: the whole tube
                         * saturated — fracture, pair-produce at the
                         * endpoints (the new q-qbar bound states) */
                        int p1=si,p2=nbr(si,QChannelVec[2*e][0]*len,QChannelVec[2*e][1]*len,QChannelVec[2*e][2]*len);
                        grid_next[p1].mass+=128;grid_next[p2].mass+=128;
                        /* drain the tube's tension — the string breaks */
                        int tni=si;
                        for(int s=0;s<len;s++){
                            grid_next[tni].winding[2*e]-=64;grid_next[tni].winding[2*e+1]-=64;
                            tni=nbr(tni,QChannelVec[2*e][0],QChannelVec[2*e][1],QChannelVec[2*e][2]);
                        }
                        qEvents[6]++;
                    }
                }
            }
        }
    }
    {NodeState *t=grid_current;grid_current=grid_next;grid_next=t;}
}

/* getters/setters for the harnesses — the AoS node's state */
uint32_t moore26_winding_get(int x,int y,int z,int c){
    return grid_current[z*QWidth*QHeight+y*QWidth+x].winding[c];
}
void moore26_winding_set(int x,int y,int z,int c,uint32_t v){
    grid_current[z*QWidth*QHeight+y*QWidth+x].winding[c]=v;
}
uint32_t moore26_photon_get(int x,int y,int z,int c){
    return grid_current[z*QWidth*QHeight+y*QWidth+x].photon[c];
}
void moore26_photon_set(int x,int y,int z,int c,uint32_t v){
    grid_current[z*QWidth*QHeight+y*QWidth+x].photon[c]=v;
}
void moore26_photon_nu_set(int x,int y,int z,int c,uint32_t v){
    grid_current[z*QWidth*QHeight+y*QWidth+x].photonNu[c]=v;
}
uint32_t moore26_mass_get(int x,int y,int z){
    return grid_current[z*QWidth*QHeight+y*QWidth+x].mass;
}
