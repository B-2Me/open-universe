# The FCC substrate — our flavor

`moore26` runs on the 26-neighbor Moore grid, but its transport
layer is deliberately *not* cubic: only 12 of the 26 channels
carry packets — the **face-diagonal FCC edges** — and only on the
even-parity sublattice. The result is a local causal unit that is
geometrically a rhombic dodecahedron, not a cube.

## Channel layout

| Registers | Channels | Role |
|---|---|---|
| faces | `0–5` | structure only (no transport) |
| **edges** | **`6–17`** | **the 12 FCC transport channels** |
| corners | `18–25` | structure only |

The 12 transporting directions are the FCC edge vectors —
every `{±1,±1,0}`, `{±1,0,±1}`, `{0,±1,±1}` combination:

```
(1,1,0) (-1,-1,0) (1,-1,0) (-1,1,0)
(1,0,1) (-1,0,-1) (1,0,-1) (-1,0,1)
(0,1,1) (0,-1,-1) (0,1,-1) (0,-1,1)
```

All 12 have length `√2`; adjacent directions have dot product `1`
(`cos 60° = 1/2` — the bend-handoff projection weight).

## The parity lock

Transport runs only on **even-parity cells**
(`(x+y+z) & 1 == 0`). Edge hops preserve parity: a `(1,1,0)`
hop sums to `+2`, so even cells map to even cells. The odd
sublattice is dead space for packets — the vacuum's transport
graph is the FCC even-sublattice, not the full cubic grid.
Packets arm only on even cells; odd cells still hold winding
and structure.

## The geometry

- **Voronoi cell**: the FCC lattice's Wigner-Seitz cell is the
  **rhombic dodecahedron** — 12 rhombic faces, each facing one
  nearest neighbor = one transport channel. Face-transitive:
  every channel is symmetry-equivalent (which is *why* transport
  is isotropic — the fairness is geometric, not a rule).
- **Neighbor shell**: the 12 nearest neighbors sit at the
  vertices of a **cuboctahedron** (the rhombic dodecahedron's
  dual — an Archimedean solid).
- **Symmetry**: full **octahedral `Oh`** (`*432`, order 48).
  The distinguished axes are `⟨100⟩` and `⟨111⟩` — the same
  easy axes real cubic magnets pick.
- **{111} planes**: cross-sections perpendicular to body
  diagonals are perfect **hexagons** — the 6-edge ring where
  two counter-rotating slipstreams coexist (the geometric
  Pauli pair) and a third is refused.
- **Hexagon hop sequence**: `ch8,12,16,9,13,15` — the six
  edges `⊥(1,1,1)`, each a `60°` turn.

## Why not cubes?

The plain Moore-26 grid would let packets move on axis
`(±1,0,0)` edges and corners `(±1,±1,±1)` — unequal hop
lengths, anisotropic timing, and the parity check fails.
Restricting transport to the 12 `√2` edges on one parity
sublattice gives a graph where **every hop is identical**:
same length, same tick, same cost. `v = 1 hop/tick` is
isotropic by construction, measured `1.00` on all 12 axes
with zero dispersion over `nu = 1–255`.

The cubic grid is still there underneath — faces and corners
hold structure (winding registers live on all 26 channels) —
but the causal traffic runs on the FCC skeleton inside it.

## Registers per node (392B)

`winding[26]`, `packet[26]`, `packetNu[26]`, `packetBorn[26]`,
`mass`, `massFlight[26]`, `charge`, `chargeFlight[26]`,
`incip`, `incipNu`, `incipBorn`, `phase` (0–511, currently
vestigial — `phase_sync` kill-switch verified phantom),
`heat`, `ack`, `bondDist`, `localDensity`.

The `winding` pair split (`2e`/`2e+1`) carries direction as
`dd = a − b` imbalance — stored angular momentum, sticky and
structural. Slipstreams are `dd` on a channel; the {111}
hexagon hosts exactly two (CW + CCW) = the Pauli pair.
