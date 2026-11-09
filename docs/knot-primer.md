---
title: knot-primer
audio: /audio/knot-primer.mp3
---

<ClientOnly>
  <StickyAudioPlayer :audioSrc="$frontmatter.audio" />
</ClientOnly>

# Knot Primer — Closed Flux Paths on the Substrate

Process ontology: a knot is not a *thing* — it is a **self-
sustaining transaction loop**. Flux that closes on itself. Every
node in the loop is mid-handshake with its neighbors; the
"structure" is a process that keeps re-establishing itself, not
a shape. Not surfaces all the way down — **transport all the
way through**.

## The component inventory

A **knot** is one closed curve (1 component). A **link** is 2+
closed curves. "How many strings can we start with" = how many
independent closed flux paths can a bound state support:

| Components | Name | Substrate version |
|---|---|---|
| 1 | unknot | `{111}` ring — 6-cell closed hexagon on edge channels |
| 1 | trefoil | loop crossing itself 3× — needs over/under |
|   |          | ordering on shared nodes (unprobed) |
| 2 | Hopf link | two rings linked once — each cell of ring A |
|   |          | passes "through" ring B (planck3 found linked |
|   |          | windings inside Hopfions) |
| 3 | Borromean | 3 loops, pairwise unlinked, collectively bound |
|   |          | — cut one, all fall apart |
| k | T(p,q) | torus knot — p turns through the hole, q around |
|   |          | — a 2-integer-indexed species family |

## Seed recipes (moore26)

The `{111}` ring — verified `dd=540` stable over 2,000t in
isolation:

```js
// 6 edge-channel hops forming a closed {111} hexagon
// ENGINE channel vectors — ch6={1,1,0}, ch12={1,0,-1},
// ch16={0,1,-1}, ch7={-1,-1,0}, ch13={-1,0,1}, ch17={0,-1,1}
const vec = [[1,1,0],[1,0,-1],[0,1,-1],[-1,-1,0],[-1,0,1],[0,-1,1]];
const ch  = [6,12,16,7,13,17];
// each cell: base ~30 both members on all pairs,
// forward member boosted +90 (circulation bias)
// CAUTION: an earlier vec array used {1,0,1} for ch12 — wrong:
// ch12 in the engine is {1,0,-1}. The mislabeled seed painted an
// OPEN ARC (persistent winding, no closure) — a packet stream
// flew straight off it. With true vectors the loop closes AND
// carries a persistent current (verified: 12 packets, 2000t,
// zero arms/decay at rail_gate=64).
```

- **1-component**: the recipe above at any center
- **2-link (Hopf)**: two rings offset so ring A's cells pass
  through ring B's interior — earlier orthogonal-ring probes
  showed transparent coexistence at intersections (parallel/
  antiparallel dd preserved per-member)
- **Borromean**: three orthogonal rings, pairwise
  non-intersecting, arranged so each pair clears the others —
  no direct contact but mutual confinement
- **T(p,q)**: scale up — a ring wound twice around (through the
  hole p times, around the torus q times)

## Measured persistence so far

- `{111}` ring isolated: `dd=540` stable over 2,000t
- `{111}` ring near a live knot: dissolved — the host's flux
  economy eats the loop (conduction + self-absorbed emission)
- Ring inside a knot interior: survives but self-absorbs — its
  parity never reaches the surface ("escape depth" problem)
- Orthogonal rings: transparent coexistence — channels carry
  independent directional traffic at shared nodes

## The brittleness problem

Loops are stable in isolation and fragile near structure — they
are ensemble phenomena, not Planck-scale processes. At
0.1 fm/node a 6-cell loop is at the resolution floor: conduction
eats circulation as fast as it forms. The stable loops in
`planck3` (Hopfions, 1.6M mass) were spin-cycles the rewrite
process *found* — emergent at ensemble scale, not painted seeds.

The open hunt: **the regime where circulation self-organizes** —
the charge/deflect/vol_share-driven configuration where bulk `dd`
closes on itself without being seeded. If the knot's own routing
spontaneously winds into a persistent loop, that's the
"electrical" regime — coherence as a rate equilibrium, not a
fixture.
