/* qi3 — transactional substrate ("QI realized").
 * The next engine after link3: CDT lattice + 't Hooft deterministic
 * rules + Kastner TI transactions (offer + confirmation completes
 * the exchange — absorption is the absorber's response, not just
 * photon impact).
 *
 * Inherits link3's proven mechanics: local rules only, c=1 hop/tick,
 * nu multi-role, parked flux, session lifecycle, broadcast emission.
 * Adds absorber-side internal LEVEL STRUCTURE — sites occupy discrete
 * modes, transitions are all-or-nothing at matching gaps.
 *
 * Naming: registers and exported functions are spelled out (long
 * names document the ontology); inner-loop helpers stay shorthand.
 *
 * Registers per site:
 *   qMass            parked mass (structure — stays put)
 *   qWinding[c]      winding / momentum channel population
 *   qLevel           level occupation (integer mode index — internal config)
 *   qCharge          bound charge (deposits from completed transactions)
 *   qMassFlight[c]   in-flight mass per channel (+ _next double-buffer)
 *   qPhoton[c]       photons per channel (the offers) (+ _next)
 *   qPhotonNu[c]     photon nu tag (offer energy) (+ _next)
 *   qConfirm[c]      confirmations armed this tick (responses to offers)
 *   qSessionState[c], qSessionStrength[c]  per-link session registers
 */
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#define EMS_API EMSCRIPTEN_KEEPALIVE
#else
#define EMS_API
#endif

static int QWidth, QHeight, QDepth, QSites;
static int QChannels = 18;
static int8_t QChannelVec[18][3] = {
    { 1, 1,0},{-1,-1,0},{ 1,-1,0},{-1, 1,0},
    { 1,0, 1},{-1,0,-1},{ 1,0,-1},{-1,0, 1},
    {0, 1, 1},{0,-1,-1},{0, 1,-1},{0,-1, 1},
    {2,0,0},{-2,0,0},{0,2,0},{0,-2,0},{0,0,2},{0,0,-2}
};

static uint8_t  *qMass, *qWinding, *qLevel, *qCharge;
static uint8_t  *qMassFlight, *qMassFlight_next;
static uint8_t  *qPhoton, *qPhoton_next, *qPhotonNu, *qPhotonNu_next;
static uint8_t  *qConfirm;
static uint8_t  *qSessionState, *qSessionStrength;
static uint64_t qEvents[18];
static uint64_t qTick, qPhotonLedger;
static uint64_t qRngSeed = 88172645463325252ULL;

static inline int siteIndex(int x,int y,int z){ return (z*QHeight+y)*QWidth+x; }
static inline int wrapCoord(int v,int m){ v%=m; if(v<0)v+=m; return v; }
static inline uint8_t randByte(void){ qRngSeed^=qRngSeed>>12;qRngSeed^=qRngSeed<<25;qRngSeed^=qRngSeed>>27;
    return (uint8_t)((qRngSeed*0x2545F4914F6CDD1DULL)>>56); }

EMS_API int qi3_init(int width,int height,int depth,int mov){
    QWidth=width;QHeight=height;QDepth=depth;QSites=QWidth*QHeight*QDepth;
    if(mov>0&&mov<=18)QChannels=mov;
    qMass           =calloc((size_t)QSites,1);
    qWinding        =calloc((size_t)QSites*QChannels,1);
    qLevel          =calloc((size_t)QSites,1);
    qCharge         =calloc((size_t)QSites,1);
    qMassFlight     =calloc((size_t)QSites*QChannels,1);
    qMassFlight_next=calloc((size_t)QSites*QChannels,1);
    qPhoton         =calloc((size_t)QSites*QChannels,1);
    qPhoton_next    =calloc((size_t)QSites*QChannels,1);
    qPhotonNu       =calloc((size_t)QSites*QChannels,1);
    qPhotonNu_next  =calloc((size_t)QSites*QChannels,1);
    qConfirm        =calloc((size_t)QSites*QChannels,1);
    qSessionState   =calloc((size_t)QSites*QChannels,1);
    qSessionStrength=calloc((size_t)QSites*QChannels,1);
    return (qMass&&qWinding&&qLevel&&qCharge&&qMassFlight&&qMassFlight_next&&
            qPhoton&&qPhoton_next&&qPhotonNu&&qPhotonNu_next&&qConfirm&&
            qSessionState&&qSessionStrength)?0:-1;
}

EMS_API int qi3_channel_count(void){ return QChannels+1; }
EMS_API void qi3_tick(void){
    qTick++;
    memset(qMassFlight_next,0,(size_t)QSites*QChannels);
    memset(qPhoton_next,0,(size_t)QSites*QChannels);
    memset(qConfirm,0,(size_t)QSites*QChannels);

    /* Phase 1 — junction collide: redistribute in-flight mass.
     * Opposing channels annihilate into parked mass + charge. */
    for(int si=0;si<QSites;si++)for(int c=0;c<QChannels;c++){
        int oc=c^1;
        int a=qMassFlight[si*QChannels+c],b=qMassFlight[si*QChannels+oc];
        int hit=a<b?a:b;
        if(hit>0){
            qMassFlight[si*QChannels+c]-=hit;qMassFlight[si*QChannels+oc]-=hit;
            int m=qMass[si]+hit*2;if(m>255)m=255;qMass[si]=m;
            int e=qCharge[si]+hit*2;if(e>255)e=255;qCharge[si]=e;
            qEvents[0]+=hit*2;qEvents[9]+=hit;
        }
    }

    /* Phase 2 — mass stream: parked structure stays put (link3's
     * drest clamp), in-flight mass moves to the facing channel. */
    for(int z=0;z<QDepth;z++)for(int y=0;y<QHeight;y++)for(int x=0;x<QWidth;x++){
        int si=siteIndex(x,y,z);
        for(int c=0;c<QChannels;c++){
            int v=qMassFlight[si*QChannels+c];if(!v)continue;
            int nx=wrapCoord(x+QChannelVec[c][0],QWidth);
            int ny=wrapCoord(y+QChannelVec[c][1],QHeight);
            int nz=wrapCoord(z+QChannelVec[c][2],QDepth);
            qMassFlight_next[siteIndex(nx,ny,nz)*QChannels+c]+=v;
            qMassFlight[si*QChannels+c]-=v;
        }
    }

    /* Phase 3 — photon stream (offers): propagate, transit decay
     * scales with nu (range ~ 1/nu). */
    for(int z=0;z<QDepth;z++)for(int y=0;y<QHeight;y++)for(int x=0;x<QWidth;x++){
        int si=siteIndex(x,y,z);
        for(int c=0;c<QChannels;c++){
            int v=qPhoton[si*QChannels+c];if(!v)continue;
            int nu=qPhotonNu[si*QChannels+c]?qPhotonNu[si*QChannels+c]:1;
            int keep=v;if((qTick%nu)==0)keep=v-1;   /* nu-gated loss */
            qEvents[7]+=v-keep;
            if(!keep){qPhoton[si*QChannels+c]-=v;continue;}
            int nx=wrapCoord(x+QChannelVec[c][0],QWidth);
            int ny=wrapCoord(y+QChannelVec[c][1],QHeight);
            int nz=wrapCoord(z+QChannelVec[c][2],QDepth);
            int ni=siteIndex(nx,ny,nz)*QChannels+c;
            qPhoton_next[ni]+=keep;qPhotonNu_next[ni]=nu;
            qPhoton[si*QChannels+c]-=v;
        }
    }

    /* Phase 4 — transaction pass (the heartbeat): every edge on every
     * node evaluates its offers independently in the same tick — an
     * absorber is a statistical region of absorber-active edges, not
     * a named object; its extent is derived, not assumed. Buffered
     * reads (qPhoton_next) keep all edges simultaneous. */
    for(int si=0;si<QSites;si++){
        int mass=qMass[si];
        for(int c=0;c<QChannels;c++){
            int offer=qPhoton_next[si*QChannels+c];
            if(!offer||!mass)continue;
            int nu=qPhotonNu_next[si*QChannels+c]?qPhotonNu_next[si*QChannels+c]:1;
            /* edge-local line: the channel's own winding + site mass
             * set what this edge can absorb — different edges of the
             * same node may absorb differently. */
            int line=(mass+(qWinding[si*QChannels+c]>>2))>>2;
            if(line<1)line=1;
            if(nu%line==0&&nu>=line){
                int oc=c^1;
                qConfirm[si*QChannels+oc]+=offer;        /* arm reverse */
                int take=offer;qPhoton_next[si*QChannels+c]-=take;
                int e=qCharge[si]+take*nu;if(e>255)e=255;qCharge[si]=e;
                int d=qWinding[si*QChannels+c]+((take*nu)>>3);
                qWinding[si*QChannels+c]=d>255?255:d;    /* nu-weighted recoil */
                qEvents[3]+=take;qEvents[16]+=take*nu;
            }
        }
    }

    /* Phase 5 — session strength: duplex EMA on matching links. */
    for(int si=0;si<QSites;si++)for(int c=0;c<QChannels;c++){
        int flow=qPhoton_next[si*QChannels+c];
        if(flow){
            int s=qSessionStrength[si*QChannels+c];
            qSessionStrength[si*QChannels+c]=s+((flow-s)>>2);
            if(qSessionState[si*QChannels+c]==0&&flow>4)
                {qSessionState[si*QChannels+c]=1;qEvents[10]++;}
            else if(qSessionState[si*QChannels+c]==1&&qSessionStrength[si*QChannels+c]>30)
                {qSessionState[si*QChannels+c]=2;qEvents[11]++;}
        } else if(qSessionState[si*QChannels+c]){
            qSessionState[si*QChannels+c]=0;qSessionStrength[si*QChannels+c]>>=1;qEvents[12]++;
        }
    }

    /* Phase 6 — emission: charged massive sites emit offers at their
     * line nu, broadcast on idle channels or split on live sessions. */
    for(int si=0;si<QSites;si++){
        int mass=qMass[si],e=qCharge[si];
        if(e<32||!mass)continue;
        int line=mass>4?mass>>2:1;
        int emit=e>>3;if(emit<1)continue;
        int nout=0;
        for(int c=0;c<QChannels;c++)if(qSessionState[si*QChannels+c])nout++;
        if(!nout)nout=QChannels;                    /* broadcast before sessions */
        int per=emit/nout;if(per<1)per=1;
        for(int c=0;c<QChannels;c++){
            if(nout!=QChannels&&!qSessionState[si*QChannels+c])continue;
            int ni=si*QChannels+c;
            qPhoton_next[ni]+=per;qPhotonNu_next[ni]=line;
        }
        e-=emit;if(e<0)e=0;qCharge[si]=e;qEvents[4]+=emit;
    }

    /* commit streamed buffers */
    for(int i=0;i<QSites*QChannels;i++){
        uint32_t v=qMassFlight[i]+qMassFlight_next[i];if(v>255)v=255;qMassFlight[i]=v;
        v=qPhoton[i]+qPhoton_next[i];if(v>255)v=255;qPhoton[i]=v;
        if(qPhoton_next[i])qPhotonNu[i]=qPhotonNu_next[i];
    }
}

EMS_API void qi3_photon_set(int x,int y,int z,int c,int v){
    if(c>=QChannels)return;
    int si=siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth));
    qPhoton[si*QChannels+c]=v>255?255:v; qPhotonNu[si*QChannels+c]=32;
}
EMS_API int qi3_photon_get(int x,int y,int z,int c){
    if(c>=QChannels)return 0;
    return qPhoton[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))*QChannels+c];
}
EMS_API void qi3_photon_nu_set(int x,int y,int z,int c,int v){
    if(c<QChannels)
        qPhotonNu[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))*QChannels+c]=v<0?0:v>255?255:v;
}
EMS_API int qi3_photon_nu(int x,int y,int z,int c){
    if(c>=QChannels)return 0;
    return qPhotonNu[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))*QChannels+c];
}
EMS_API void qi3_mass_set(int x,int y,int z,int v){
    qMass[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))]=v>255?255:v;
}
EMS_API int qi3_mass_get(int x,int y,int z){
    return qMass[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))];
}
EMS_API void qi3_charge_set(int x,int y,int z,int v){
    qCharge[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))]=v>255?255:v;
}
EMS_API int qi3_charge_get(int x,int y,int z){
    return qCharge[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))];
}
EMS_API void qi3_level_set(int x,int y,int z,int v){
    qLevel[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))]=v>255?255:v;
}
EMS_API int qi3_level_get(int x,int y,int z){
    return qLevel[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))];
}
EMS_API void qi3_winding_set(int x,int y,int z,int c,int v){
    if(c<QChannels)
        qWinding[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))*QChannels+c]=v<0?0:v>255?255:v;
}
EMS_API int qi3_winding_get(int x,int y,int z,int c){
    if(c>=QChannels)return 0;
    return qWinding[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))*QChannels+c];
}
EMS_API int qi3_session_state(int x,int y,int z,int c){
    if(c>=QChannels)return 0;
    return qSessionState[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))*QChannels+c];
}
EMS_API int qi3_session_strength(int x,int y,int z,int c){
    if(c>=QChannels)return 0;
    return qSessionStrength[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))*QChannels+c];
}
EMS_API uint64_t qi3_event(int i){ return qEvents[i & 31]; }
EMS_API uint64_t qi3_photon_count(void){ uint64_t m=0;
    for(int si=0;si<QSites;si++)for(int c=0;c<QChannels;c++)m+=qPhoton[si*QChannels+c];return m; }
