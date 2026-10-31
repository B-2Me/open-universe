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
 * Registers per site:
 *   qM    parked mass (structure — stays put, like link3 drest clamp)
 *   qW[c] winding / momentum channel population
 *   qLV   level occupation (integer mode index — internal config)
 *   qIE   bound charge (deposits from completed transactions)
 *   qUP[c]  in-flight mass per channel
 *   qPH[c]  photons per channel (the offers)
 *   qPHNU[c] photon nu tag (offer energy)
 *   qCF[c]  confirmations armed this tick (responses to offers)
 *   qSST[c], qSESS[c] session state/strength per link (inherited)
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

static int QW, QH, QD, QN;
static int QMOV = 18;
static int8_t QCV[18][3] = {
    { 1, 1,0},{-1,-1,0},{ 1,-1,0},{-1, 1,0},
    { 1,0, 1},{-1,0,-1},{ 1,0,-1},{-1,0, 1},
    {0, 1, 1},{0,-1,-1},{0, 1,-1},{0,-1, 1},
    {2,0,0},{-2,0,0},{0,2,0},{0,-2,0},{0,0,2},{0,0,-2}
};

static uint8_t  *qM, *qW_, *qLV, *qIE;
static uint8_t  *qUP, *qUPd, *qPH, *qPHd, *qPHNU, *qPHNUd;
static uint8_t  *qCF;
static uint8_t  *qSST, *qSESS;
static uint64_t QEV[18];
static uint64_t QTICK, QIPH;
static uint32_t QSEED = 88172645463325252ULL;

static inline int qiidx(int x,int y,int z){ return (z*QH+y)*QW+x; }
static inline int qiwrap(int v,int m){ v%=m; if(v<0)v+=m; return v; }
static inline uint8_t qrnd(void){ QSEED^=QSEED>>12;QSEED^=QSEED<<25;QSEED^=QSEED>>27;
    return (uint8_t)((QSEED*0x2545F4914F6CDD1DULL)>>56); }

EMS_API int qi3_init(int w,int h,int d,int mov){
    QW=w;QH=h;QD=d;QN=QW*QH*QD;
    if(mov>0&&mov<=18)QMOV=mov;
    qM   =calloc((size_t)QN,1); qW_  =calloc((size_t)QN*QMOV,1);
    qLV  =calloc((size_t)QN,1); qIE  =calloc((size_t)QN,1);
    qUP  =calloc((size_t)QN*QMOV,1); qUPd=calloc((size_t)QN*QMOV,1);
    qPH  =calloc((size_t)QN*QMOV,1); qPHd=calloc((size_t)QN*QMOV,1);
    qPHNU=calloc((size_t)QN*QMOV,1); qPHNUd=calloc((size_t)QN*QMOV,1);
    qCF  =calloc((size_t)QN*QMOV,1);
    qSST =calloc((size_t)QN*QMOV,1); qSESS=calloc((size_t)QN*QMOV,1);
    return (qM&&qW_&&qLV&&qIE&&qUP&&qUPd&&qPH&&qPHd&&qPHNU&&qPHNUd&&qCF&&qSST&&qSESS)?0:-1;
}

EMS_API int qi3_nch(void){ return QMOV+1; }
EMS_API void qi3_tick(void){
    QTICK++;
    memset(qUPd,0,(size_t)QN*QMOV);
    memset(qPHd,0,(size_t)QN*QMOV);
    /* phases land here — junction collide, mass stream, photon
     * stream (offers), transaction pass (confirmations), sessions,
     * emission (level drops). Skeleton first: registers + tick
     * structure, mechanics land one pass at a time. */
    for (int i = 0; i < QN * QMOV; i++) {
        uint32_t v = qPH[i] + qPHd[i];
        if (v > 255) v = 255;
        qPH[i] = v;
        if (qPHd[i]) qPHNU[i] = qPHNUd[i];
    }
}

EMS_API void qi3_phset(int x,int y,int z,int c,int v){
    if(c>=QMOV)return; int si=qiidx(qiwrap(x,QW),qiwrap(y,QH),qiwrap(z,QD));
    qPH[si*QMOV+c]=v>255?255:v; qPHNU[si*QMOV+c]=32;
}
EMS_API int  qi3_phget(int x,int y,int z,int c){
    return c<QMOV?qPH[qiidx(qiwrap(x,QW),qiwrap(y,QH),qiwrap(z,QD))*QMOV+c]:0; }
EMS_API void qi3_phnu_set(int x,int y,int z,int c,int v){
    if(c<QMOV)qPHNU[qiidx(qiwrap(x,QW),qiwrap(y,QH),qiwrap(z,QD))*QMOV+c]=v<0?0:v>255?255:v; }
EMS_API int  qi3_phnu(int x,int y,int z,int c){
    return c<QMOV?qPHNU[qiidx(qiwrap(x,QW),qiwrap(y,QH),qiwrap(z,QD))*QMOV+c]:0; }
EMS_API void qi3_set(int x,int y,int z,int reg,int v){
    int si=qiidx(qiwrap(x,QW),qiwrap(y,QH),qiwrap(z,QD));
    if(reg==QMOV)qM[si]=v>255?255:v; }
EMS_API int  qi3_rest(int x,int y,int z){
    return qM[qiidx(qiwrap(x,QW),qiwrap(y,QH),qiwrap(z,QD))]; }
EMS_API void qi3_eset(int x,int y,int z,int v){
    qIE[qiidx(qiwrap(x,QW),qiwrap(y,QH),qiwrap(z,QD))]=v>255?255:v; }
EMS_API int  qi3_eget(int x,int y,int z){
    return qIE[qiidx(qiwrap(x,QW),qiwrap(y,QH),qiwrap(z,QD))]; }
EMS_API void qi3_rset(int x,int y,int z,int c,int v){
    if(c<QMOV)qW_[qiidx(qiwrap(x,QW),qiwrap(y,QH),qiwrap(z,QD))*QMOV+c]=v<0?0:v>255?255:v; }
EMS_API int  qi3_drest(int x,int y,int z,int c){
    return c<QMOV?qW_[qiidx(qiwrap(x,QW),qiwrap(y,QH),qiwrap(z,QD))*QMOV+c]:0; }
EMS_API uint64_t qi3_ev(int i){ return QEV[i & 31]; }
EMS_API uint64_t qi3_photons(void){ uint64_t m=0;
    for(int si=0;si<QN;si++)for(int c=0;c<QMOV;c++)m+=qPH[si*QMOV+c];return m; }
