---
title: Discrete Quantum Optics
---

# Discrete Quantum Optics on the Planck Substrate

*Consolidated synthesis of the grounded-measurement campaign (M1–M14) against `src/planck3.c`. Every claim below is backed by a committed headless harness; the full narrative detail lives in [The Open Frontier](./frontier.md). This document states the verified mechanics, the measured phase diagram, the emergent-species census, and the proven-absent channels — no speculation.*

## The Substrate

`planck3.c` is a deterministic, integer-only cellular automaton on a 12-port FCC-like lattice. Each cell is a 6-byte node: quanta `q∈[0,255]`, spin `s` (one of 12 ports or 0), buffer `b`, heat `h`, tension `tn`. Dynamics is receiver-pull: a cell pulls quanta from any neighbor whose spin points at it, subject to occupancy gates. Sync mode (`planck3_set_sync(1)`) is the canonical operator; all measurements below use it.

**Everything the engine does decomposes into three mechanisms:**

1. **Ballistic v=1 transport** — a packet advances exactly one lattice link per tick, unconditionally, while uncongested. Isotropic, non-dispersive, no inertia.
2. **Occupancy-gated channels** — `FLOW_CAP=160` caps per-tick emission (excess stalls as residue); `DEADLOCK=200` gates pull acceptance (a fuller receiver refuses).
3. **Congestion capture** — a cell seeing a neighbor with `160 < occupancy ≤ 200` re-aims its spin toward that neighbor. Over 200 the neighbor is *invisible* to this gate — the single rule that both binds oscillators and kills them.

## Milestone Index

| # | Harness | Result |
|---|---------|--------|
| M1 | — | Canonical baseline: RFC knobs dormant, `-Wall` clean |
| M2 | `test_conservation.c` | Sync transport is exactly mass-conserving (residual 0 / 10⁴ ticks); heat is a driven-dissipative sector, not conserved |
| M3 | `test_cavity.c` | Cavity equilibrates to classical equipartition + lattice BZ cutoff + low-k condensation; no Planck spectrum |
| M4 | `test_tof.c` | v=1 link/tick on all ports, zero dispersion, elastic REV3 wall reflection |
| M5 | `test_doubleslit.c` | Two-slit detection exactly additive (181+181=362); disjoint streamlines can't interact |
| M6 | `test_beams.c` | Converging-beam S-matrix: shared-cell co-arrival fuses + vector-sum steers; adjacent meeting swaps elastically; equal head-on deposits a permanent lump |
| M7 | `test_lump.c` | Probe-vs-lump phase diagram: pickup / bound oscillator / ablation / reflection, selected by DEADLOCK gate; no radiation pressure |
| M8 | `test_bath.c` | Dilute collision law is scale-invariant; static media transparent at n=1 (beam eats medium); opacity is self-induced choking at FLOW_CAP |
| M9 | `test_detector.c` | Metastable avalanche: q=199 prime + q=3 trigger → 160-quantum directional discharge; primes need ≥2-cell isolation |
| M10 | `test_slitapd.c` | APD double-slit: additive for disjoint paths; 127° crossing at dt=0 fuses → third stripe (non-additive, corpuscular); dt≥1 additive |
| M11 | `test_slitapd.c` | Discrete Mach–Zehnder: `dt mod τ ≡ ΔL mod λ`; fusion channel is a periodic Dirac comb, not cos² |
| M12 | `test_osc.c` | Bound oscillator = 4-state two-lobe breather; arrival phase mod 4 selects among 4 scattering outcome classes — a phase-sensitive junction |
| M13 | `test_oscarray.c` | Phase-graded breather array → spatial transmission comb (D,B,D,B…) on the APD wall; fringe lives in transmission, not clicks |
| M14 | `test_ecology.c` | Thermal bath spontaneously nucleates the same breather species — substrate is fertile |

## The Measured Phase Diagram

All matter–radiation interaction is a finite state machine on occupancy:

| Regime | Gate | Channel |
|--------|------|---------|
| `q_target + q_probe ≤ 160` | pull admitted, sub-cap | **accretion**: lump revives, merged mass departs at v=1 |
| `160 < merged ≤ 200` | congestion-visible | **bound cycle**: ejecta re-aims home, limit cycle forms |
| `merged > 200` | congestion-invisible | **leak**: ejecta escapes, anchor degrades |
| `q_target > 200` | pull refused | **reflection**: probe REV3-reverses intact |

The same three gates explain cavity condensation (M3), media transparency/choking (M8), detector avalanching (M9), collision outcomes (M6), and breather binding/death (M12/M14).

## Emergent Species Census (M14, thermalized cavity, t=2000)

| Species | Cells | Mass share | Nature |
|---------|-------|-----------|--------|
| Dead lumps | 815 | ~85% | s=0 momentum traps — inert condensate |
| τ=4 two-lobe breathers | ~39 | ~11% | 3-cell limit cycles (core+2 lobes); axes 1↔4, 2↔5, 3↔6, 8↔12, 9↔10 |
| τ=1 stalled-spinner filaments | ~56 | low | 1-D deadlock-frozen queues, spin-locked |
| τ=2 shuttles | ~7 | trace | mostly boundary-adjacent |
| Free vapor | ~9 | ~1% | radiation nearly extinct at equilibrium |

Spontaneous — no seeding, canonical tension ON. The universe makes its own atoms: two-species condensate of frozen mass + ticking mass.

## Proven-Absent Channels

| Channel | Status | Evidence |
|---------|--------|----------|
| Wave superposition / interference (cos²) | absent | M5, M10, M11 — only Dirac-comb coincidence |
| Continuous phase register (ψ∈ℂ) | absent by construction | no such field exists; phase = scheduling (M11) or discrete lobe-state (M12) |
| Refractive index n>1 | absent | M8 — v=1 unconditional while transparent |
| Radiation pressure / continuous force | absent | M7 — momentum transfers in whole-cell quanta |
| Inertia (threshold to motion) | absent | M7 — any nonzero probe mobilizes an admissible lump |
| Energy conservation | absent | M2 — driven-dissipative heat sector; mass, not energy, is conserved |
| Reusable single-pixel detector | absent | M10 — APD pixels and oscillator pixels are single-shot |

## What "Phase" Means Here (the three-layer taxonomy)

1. **Scheduling phase** — arrival-time difference mod train period; produces the temporal comb (M11). Real but lives in the protocol, not the field.
2. **Structural phase** — which lobe of a breather holds mass; a stored 4-state register (M12). Real, discrete, consequential — gates scattering outcomes.
3. **Amplitude phase** — continuous complex amplitude. Provably inexpressible — no field for it to live in.

## Apparatus Pitfalls (for future experiments)

- Emitters must stay `q ≤ 160` — denser sources self-scatter via their own congestion field.
- A q=255 s=0 plane is a deadlock wall; set `P3_TEMIT=300` to make barriers pure geometry (live tension captures slit-mouth packets).
- APD primes need ≥2-cell spacing in *every* direction — ejecta divert-capture makes avalanches contagious through z-adjacent rows too.
- Detector pixels (APD or oscillator) are single-shot — histograms need fresh pixels per event.
- Mass, not identity, is trackable — the 6-byte node has no ID register; attribution needs spatial isolation or explicit bookkeeping.

## The Two Layers (repo hygiene)

- **Grounded engine** (`src/planck3.c` + `src/test_*.c`): the validated physics substrate — this document's subject.
- **Hopfion Zoo / Hopf's Loom** (`script/`, `docs/.vitepress/` viewers): parked interactive 3D visualizer of FCC geometry. Preserved as a visualization demo, deliberately outside the measurement campaign.
