# moore26 findings

Measured behavior of the 26-register Moore-neighborhood substrate:
26 registers per node, 12 transporting FCC edge channels (`ch6–17`
on the even-parity sublattice), face `0–5` and corner `18–25`
channels as structure-only registers. All numbers are empirical
outputs of `script/moore/*.mjs` headless harnesses — candidate
substrate mechanics, not claims about nature.

## Scale context

The engine's node spacing is `0.1 fm` — the sub-nucleon regime
where quark confinement and string-breaking live. This MIT scale
tour is a good intuition pump for where the lattice sits:

<iframe width="560" height="315" src="https://www.youtube.com/embed/ach9JLGs2Yc?si=UFIMZu2kkgWW1zoC" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

## Transport

- `v/c = 1.00` on all 12 FCC edge directions — isotropic, one
  hop/tick (the operational `c`)
- Dispersion-free for `nu = 1–255`
- Power-of-two dims only — chunk masks `(w-1)` corrupt on `N=40`

## Pair production + annihilation

- Fusion wall exact: `nu_a + nu_b >= 256` → `ev23` pair mint
- Yield ≈ `mass = pair × Σν >> 5` (≈ Σν/32)
- Signed `±q` recoils on `chargeFlight`, net charge `0`
- `e⁺e⁻→γγ`: opposing `massFlight` arrivals annihilate at the
  meeting node → back-to-back `255+255` packet jets, `heat=0` in
  sparse vacuum. Same mechanic as meso3i's `IANNIH` (opposing
  drest → antipodal photons) — third-generation implementation

## Knot regime (nucleon candidate)

- `comm ≈ 120` → RMS ≈ 4.7, ~10-node diameter (the `1 fm` analog)
- Kinematic ceiling `~0.033c` — routing friction, NOT inertia:
  - `4.4×` absorbed energy → no faster (routing-bandwidth bound)
  - `3×` mass → `+14%` (wrong direction for `a ∝ F/m`)
  - ceiling set by pattern re-formation cadence, not volume
- **The ceiling is the knot's SOUND SPEED**: bulk translation
  requires a structural deformation to cross the pattern — the
  emission→flight→re-arm cadence IS mechanical information
  propagating through the medium. `0.033c` = the rate phonons
  move through bound topology. Evidence: `comm 40→120` gives
  ceiling `0.027→0.031c` — it RISES with density (tighter
  coupling → faster sound), the opposite of inertia. Pushing
  harder doesn't help because you can't outrun your own phonons.
  Maps to `v_s ≪ c` in real materials — bound structures can
  only translate as fast as their internal coupling carries
  the deformation.
- Immortal against compression: flux, counter-flux, `massFlight`
  strikes, and knot overlap all accrete — never rupture
- String-break under TENSION only: `≥12`-node saturated tube
  fractures → `768+768` endpoint mass + `±8` charged recoil,
  exact ledger (`2×768 + 128 = 1664` drained)
- Species-inverse balance: `mass ≈ committed/3.4` equilibrium
  (`0.292`, flat 1000→5000t under locked rules; the rule's 1:8
  floor is a nucleation trigger, not the setpoint — competing
  radiation/condensation rates settle it higher). Massless
  sites radiate only (nucleation seed required)

## Directional memory (the `dd` stack)

`dd` = `winding[2e] − winding[2e+1]` pair imbalance — stored
angular momentum, thermodynamically irreversible:

- `dir_bias` transduction: offer's direction bit survives
  confirm → `dd=314` written from flux (vs `~1` symmetric)
- `dd_shift` conduction: imbalance pushes along its own channel
- `bend_shift` impedance-gated rotation: fires only when forward
  pair saturates (`≥128`), rotates `dd` onto `dot=1` edges
- `rad_shift` radiation tax: un-rotated fraction sheds as
  forward packets (`ev33`) — discrete synchrotron
- Retention: `125%` over `800t` beam at `dir_bias=0` (grows!);
  `+12,000%` spin-up at `dir_bias=256` — beam is a `dd` pump
  *(pre-toll measurement — the surplus toll now bounds this:
  `chain_share` re-offers pay from the uncommitted margin,
  killing the runaway while preserving the `dd=519` dimer bond)*
- Accretion physics: sustained flux → `mass`+`dd` growth at
  plateaued `heat ~7.4M` — driven `E→m` + `E→L` conversion

## Radiation

- Bend luminosity: threshold onset `<rate 2`, scales `326→1787`
  at `rate 2→8`, saturates `1853` with `dd` washout at `rate 16`
- Overdrive doesn't break the knot — it bloats (`vol +100%`),
  direction washes out, structure survives

## Holographic finding — interiors are bookkeeping

Measured: a `dd` pulse injected on the knot's surface stays pinned
at the surface (`west=3520, mid=0, east=0` across `300t`) — the
directional deformation never propagates through the interior.
The knot is sound-opaque: `dd` conducts along surfaces and
channels (tubes, legs) but the dense interior doesn't carry it.

Implication: everything the knot *does* happens at its boundary —
emission, absorption, arm/confirm, leading-edge re-formation
(the `0.033c` translation mechanism is a surface process, not a
bulk propagation). The interior is archived state; no clock
ticks there. The holographic principle (degrees of freedom on
the boundary, not the volume) appears here as a measured
property of a cellular substrate — "inside a knot" is the same
kind of question as "inside a black hole." The interior is
bookkeeping, not dynamics.

*Update — `chain_share` volumetric routing:* with chained offers
enabled, the interior isn't dead space — confirmed transactions
re-offer on the dominant `dd` rail, hopping signal node-to-node
through dense structure (far-side packets `9→173`, `dd`
`−4.8k→+76.7k` across a knot wall; U-tube `dd` reaches `leg4=2145`
through three bends). "Surfaces all the way down" becomes
"relays all the way through" — the interior conducts via
transaction forwarding, not packet flight or scalar residue.

Density probe: `8` packed knots retain `1.028×` isolated volume —
no density penalty; mutual emission recapture slightly favors
packing. "Mass is spaced far apart" does not drop out of
knot-level stability; it lives in transport instead — dense
regions are stable but *causally dark* (unverified on larger
clusters).

## Dead registers / phantoms

- `phase` register + 10-iter Jacobi sync: pure overhead —
  `phase_sync=0` is `0.09%` different (noise). Vortices unwind
  in `50t` — no topological protection in the scalar field
- `phase_gate` (qi3 `effPhase` port) works but doesn't gate
  `massFlight` parking
- Inert on standard scenario: `fusion_wall`, `commit_min`,
  `ground_floor`

## Geometric Pauli / two-slipstream

- Tilted `{111}`-plane hexagon: tangent rotates through 6 edge
  axes — supports two counter-rotating slipstreams (`a`/`b`)
- One stream: `150/30` holds at 100% (net handedness protected)
- Two streams: `150/150 → 62/62` — coexist but shed `~59%`
  (the annihilation-shed analog; energy goes mostly to heat)
- Third stream: refused — the hexagon has exactly 2 routing lanes

## Interactions at range — radiative torque transfer

Two `comm=120` knots at `sep=16` and `sep=12` show **no centroid
drift** (frozen at seed positions over 1500–3000t — null for
linear force), but they exchange angular momentum through
radiation: each knot's emission grazes the other's facing flank
and `dir_bias` writes bound circulation:

```
sep=12, chain=128:  ddL: +1 → +11 → +16 → +23   (t=0→2000)
                    ddR: +5 → −6  → −9  → −15
```

Opposite signs — each knot sees the other's flux arriving from
the opposite direction, so the deposition torques them
counter-rotating, like gears coupled by the medium. This is the
`meso3i` YORP mechanism (grazing light writes spin via absorbed
flank deposition) running on the conserved engine: a real
action-at-a-distance interaction living in the **angular** ledger,
not the linear one.

The wound `dd` circulation is literally a persistent current loop
on the transport edges — a candidate magnetic-dipole register.
Open questions before claiming dipole magnetism: orientation
sign-rule (does a pre-seeded `dd` preferentially anti-align a
neighbor?) and distance falloff (dipole-dipole ∝ `1/r³`).

*Substrate artifact fixed en route:* a `+x` lattice wind (+1.13
node drift/knot over 750t) traced to the conduction `k`-transfer
always pushing the pair's `+` member direction plus
first-tie-wins scans defaulting to channel `0`. Fixed via
gradient-descent conduction, per-node `sent[]` clamps against
`grid_current`, and rotated scan order — vacuum now measured
still at all separations.

## Virtual layer & rails (post-ledger mechanics)

- **Standing offers**: `nu%line` moved to confirm — off-shell
  arming, ~6-tick lifetimes, Landauer dust to `heat` on expiry.
  Armed-but-unconfirmed offers steer every dominance pick via
  `eff_dd` (committed `dd` + parity-weighted incipients) —
  influence without answer.
- **Parity currency**: `packetPar`/`incipPar` carry ±1 helicity
  through transport (majority-merge). Deposit direction reads
  carried parity; emission debits the emitter's `dd` by 1 —
  spin-flip ledger. Sign-rule verified: receiver flips with
  source (+54/−6 perpendicular).
- **Rails** (`rail_gate`): saturated dominant member = waveguide —
  packets skip arm AND decay, re-channeled onto the rail (turns
  with it). Confirmed transactions pave rails: ack return lays 1
  committed unit on the return pair (conserved transfer).
- **Persistent current**: `12` packets on a closed `{111}` rail,
  `2000`t, zero arms/decay — live circulating current on a
  static coil. (Seed caveat: use ENGINE channel vectors — a
  mislabeled vec[] paints an open arc.)
- **Untested**: `PAR_SIGN`-selective absorption — a coil that
  arms parity-*matched* offers and declines mismatched ones
  self-selects its charging spectrum (positive feedback:
  aligned flux grows `dd` → stronger selectivity). The inverted
  version (reject matched) is a `dd` stabilizer. One-line gate
  at the arm path; untested.

## Runtime tuners (all exported, `build.sh` synced)

`fusion_wall`, `commit_min`, `ground_floor`, `confirm_cap`,
`catch_gate`, `dir_bias`, `deflect_align`, `dd_shift`,
`bend_shift`, `rad_shift`, `phase_gate`, `phase_sync`,
`chargeflight_get`

## Genealogy

`meso3i (IDREST/IANNIH/DWELL) → link3 (lDR/lDW/lUP) → qi3
(winding/held) → moore26 (winding pairs/massFlight/incip)`

Same knot regime across four engines — committed circulation,
directed rest, dwell parking, annihilation-on-collision.
