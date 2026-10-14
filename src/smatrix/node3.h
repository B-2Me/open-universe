/*
 * node3.h — shared constants + node layout for the smatrix CUDA port.
 *
 * Physics constants are verbatim from planck3.c — this binary targets
 * g_sync semantics only (deferred pushes, mass-conserving publish).
 * The one intentional deviation: planck3's rng_next() is a global
 * serial stream consumed in scan order; on GPU it becomes a
 * deterministic per-(node,tick) hash. The stream only fires when
 * nh2 < HEAT_FLOOR and hshare3(1..3) == 0, so the substitution is
 * observationally identical — register values may differ in dead
 * cells but no mass/heat channel that propagates ever sees it.
 */
#pragma once
#include <stdint.h>

// ---- physics constants (planck3.c, canonical) ----
#define SM_DEADLOCK      200
#define SM_HEAT_MAX      65535
#define SM_KINETIC_BASE  1
#define SM_KINETIC_SHUNT 5
#define SM_KINETIC_BP    10
#define SM_QUANTA_HEAT   15
#define SM_TEMP_DIV      200
#define SM_HEAT_FLOOR    2
#define SM_FLOW_CAP      160
#define SM_BUFDECAY      4
#define SM_FCC_BW        440
#define SM_T_EMIT        4
#define SM_T_EMIT_MIN    200
#define SM_T_DECAY       5
#define SM_T_PULL        4
#define SM_T_RATE        0      // canonical — hash gate never passes
#define SM_T_DIVERT      4

// GPU node: same register set as Node3 (u8 q, u8 spin, u16 heat,
// u8 buffer, u8 tension) padded to 8B for aligned access. The two
// pad bytes are unused — kept zeroed.
struct __align__(8) SmNode {
    uint8_t  quanta;
    uint8_t  spin;
    uint16_t heat;
    uint8_t  buffer;
    uint8_t  tension;
    uint8_t  _pad[2];
};

// ---- job file format (little-endian, produced by script/smatrix_pack.mjs)
//   u32  magic      'SMX1' = 0x31584D53
//   u32  version    = 1
//   u32  batch      number of stacked sub-grids
//   u32  w,h,d      sub-grid dims
//   u32  ticks      run length
//   u32  dumpEvery  write a state snapshot every N ticks (0 = final only)
//   u32  nForce     sparse force-list entries total (0 = none)
//   u32  absorb_margin   sponge shell thickness (0 = periodic x/y + z wall,
//                        legacy physics; >0 = drain q/buf + damp heat on
//                        every batch's outer shell each tick — the open-
//                        boundary fix for wraparound spray contamination.
//                        Absorbed mass accumulates in counter slot 2 —
//                        the missing-transverse-energy channel.)
//   header tail: i32 diss, i32 limit (appended after reserved — v1.1 fields)
//   per batch:  { u8 axis; u8 pad; int16 impact_milli; f32 phase; u8 name[32] } = 40B
//   force list:  nForce × { u32 gidx (GLOBAL: batch-local index + batch*N3);
//                u8 spin; u8 tension; u8 quanta; u8 pad } = 8B
//   states:      batch × n*6 planes, NO P3ST header:
//                q[n] s[n] heat16le[2n] buf[n] tn[n]
// Force entries re-apply every tick BEFORE the tick kernel (the pinch
// wall analogue: persistently pinned registers).
#define SMX_MAGIC   0x31584D53u
#define SMX_VERSION 1u
