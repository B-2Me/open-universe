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
- **Census metrics — two axes of handedness**: a *closed*
  circulation has zero net `dd` by symmetry (loop forward
  channels alternate +90/−90 across even/odd members → global
  sum cancels). Species need TWO measures: net `dd` (stick
  polarization — wound ball reads −100,415) and path `curl`/
  `ringdd` (closed circulation — live ring holds 540 at 3000t).
  A loop reading `dd=0` is not relaxed — it's circulating.
- **Species census (corrected seeds, 3000t)**: ball
  `mass=3,846 ratio=0.020`; static ring `comm=2,340` (survives,
  no nucleation); nucleated ring `mass=60` (spark held —
  rings CAN carry mass); live ring `stream=12, ringdd=540`
  (current + winding both persistent); **wound ball**
  `mass=35,618 ratio=0.239 dd=−100,415` — 9× plain-ball mass,
  polarized winding, the spinning-knot species.
- **Untested**: `PAR_SIGN`-selective absorption — a coil that
  arms parity-*matched* offers and declines mismatched ones
  self-selects its charging spectrum (positive feedback:
  aligned flux grows `dd` → stronger selectivity). The inverted
  version (reject matched) is a `dd` stabilizer. One-line gate
  at the arm path; untested.
  **Observational anchors**: optical pumping (a vapor absorbs
  circularly polarized light → becomes spin-polarized → prefer-
  entially transmits that polarization — the feedback loop
  itself, measured since the 1950s); circular dichroism
  (differential `Δε` absorption of L/R circular light by
  chiral media); spin-valve GMR (a magnetized contact passes
  same-spin carriers preferentially).

## Strong-force mechanics — the full checklist

- **Tube exists** ✅ — `winding=200` zigzag rail carries a seeded
  stream loss-free through `6` turns (waveguide exemption +
  rail bypass). Packets re-channel onto each node's dominant
  member, riding the curve.
- **Tube mediates force** ✅ — the stream's confirmed deposits
  write `massFlight` on the **arrival channel** (`ch6=+x`)
  while the knot's intrinsic crawl writes its own `dd` axis
  (`ch7`). Per-channel anisotropy isolates extrinsic force
  from intrinsic churn — `ch6:1` vs `ch7:839` on the receiver.
- **Confinement** ✅ — `Phase 7` string-break: a continuous
  `≥128`-balanced saturated pair `≥12` nodes fractures,
  pair-produces endpoint mass (`1,792` minted, `ev6=1`),
  and recoils the fragments apart with opposite `chargeFlight`.
  The tube's job is to store tension and snap — not to heal.
  (A manually-severed gap does NOT re-pave: paving requires
  traffic, and traffic requires the tube — self-consistent stall.)
- **Motion** ✅ — `massFlight` launch rides the dominant `|dd|`
  member (fixed a sign-bias that motion-locked `−dd` knots —
  both handednesses now crawl; `−dd` drifted `+0.46`,
  `+dd` drifted `−0.20` over `3,000t`, handedness-dependent
  direction).
- **Radiation pressure** — `massFlight[c]+=1` per confirmed
  deposit wires absorbed momentum → recoil. Real but weak
  against `38k`-mass knots (needs focused flux or long runs).

## Substrate chirality — RETRACTED (bookkeeping bug)

The `1.7:1` accretion asymmetry reported here was **a parity-tag
bug**, not substrate physics. `PAR_SIGN(n,c)` was channel-relative
(`winding[c] > winding[c^1]`), so a packet emitted on the dominant
channel always minted `+Par` — a `−dd` knot therefore debited its
*even minority* member (`p_>0 → (c&~1)`), collapsing its structural
`min` and starving accretion. Member-relative `PAR_SIGN`
(even-dominant = `+`, odd = `−` — the convention the rest of the
engine already used) restores symmetry: `+dd 41,741` vs `−dd
46,763` (`0.89`, within run variance).

The residual `0.89` is worth a longer-run check — a mild second-
order asymmetry or plain seed noise, not the runaway.

## The Meissner lock — committed structure stops bleeding

Phase 4 gradient descent used to drain **any** balanced pair
`>=32` at `a>>3` per tick — rails and tubes dissolved into the
vacuum (the visible dim-out) while dust below `32` sat frozen.
The rule was inverted relative to nature: it froze the noise and
bled the structure.

The lock: balanced pairs in `[commit_min, 128)` skip conduction
entirely — committed structure is *structure*, not field.
Pairs `>=128` bleed only the over-pressure excess `(a-127)>>3`.

Measured (32³, seeded `200/200` on `ch6/7`):
- **before**: `200 → 105 → 69 → 68` and still falling
- **after**: `200 → 154 → 143`, then `t50 = t400 = 1572` — frozen

Regressions: wound-ball accretion unaffected (`25k` mass —
unbalanced pairs take the `a!=b` directional path); ring rail
holds `630/660` dominant winding (was dimming).

Calibration notes: tubes floor at `~143`, not exactly `128` —
`(a-127)>>3` falls under the `k>=8` transfer gate early. Dust
`<64` is still effectively frozen (`k<8` never transfers), so
the "vacuum expels field" half of the Meissner story is inert —
committed structure persists, but the medium doesn't actively
push flux back onto rails. Nature's tube persistence is now
matched on the structure side only.

Consequence: over-pressured tubes relax toward the `128`
fracture band — `Phase 7` stays armed on any tube that parked
just over the gate.

Post-lock hexbuckle (64³, n=12/scen): `flat=63,785±6,873`,
`dip0=57,602±5,852`, `dip32=53,755±6,485` — the bend sits within
`~1.5σ` of flat. **No flexoelectric dipole** — the `charge+=cq`
transfers that would polarize are the same transfers the lock
froze. But the probe now leaves `~60k` trapped polarization vs
`~0` pre-lock: deposited charge persists once conduction stops —
**charge memory**, not strain-induced dipole.


## Genealogy

`meso3i (IDREST/IANNIH/DWELL) → link3 (lDR/lDW/lUP) → qi3
(winding/held) → moore26 (winding pairs/massFlight/incip)`

Same knot regime across four engines — committed circulation,
directed rest, dwell parking, annihilation-on-collision.

## Conservation audit arc (ledger sealed to ~0.1%)

Per-phase delta counters (`-DM26_AUDIT`, `moore26_audit(p)`)
attribute every ledger change to a tick phase. The hunt, in order:

| leak | fix |
|---|---|
| `h>>7` silent heat drain | booked to `ev44` (tracked bath) |
| incip expiry booked `h` not `h·nu` | `h*nu` thermalizes |
| annihilation `nu=hit` mint (`hit²` out) | `nu=1` per quantum — exact |
| register-cap truncations (flight/annih/chain-share/emit) | excess → `heat` everywhere |
| `incipNu` scalar overwrite on shared channel | weighted `nu` mixing at arming |
| spin-flip debit deleted 1 winding/emission | debited rung → `heat` (parity costs angular momentum, not free energy) |
| stale `grid_next` resurrected ghosts | `rescan_live` memsets dead chunks before swap |

Result: every transactional phase audits `ΔL=0`; `P7-break`
carries `−63` string-break bookkeeping; the `5%` void is now a
`~0.1%` documented seam. Mid-tick `grid_next` sampling in the
audit shows a `+957` P0 artifact (buffer-staging ghosts, not
minting) — tick-end `grid_current` sampling is the honest read.

## Mass spectrum — calibrated (Prigogine dissipative structure)

`qEvapShift` mass tax: per-tick evaporation probability
`(mass>>shift)&1023`, emitting `nu=1` packets on the knot's
dominant circulation edge (spin-aligned radiation, `ev43`).

- **Closed box**: plateau `~40k`, *supply-bound* — the knot
  eats until the vacuum starves; tax sets only the residual
  split (41k/39k/39k for shift 3/4/5)
- **Open box + sustained flux**: plateau `≈ flux × 2^shift` —
  measured `467/906/1244` (shift 5 still converging toward
  `4×` when sampled). Mass is an emergent `supply/friction`
  value — a real tunable spectrum, not an input

## Charge law — measured field behavior

`charge` (int16) is dynamic — absorption re-charges a node
(`charge += nu` can flip sign). Sign-aware binding: same-sign
offers cap at `4`, opposite-sign at `13−|q|>>3`. Measured:
`ev45=331` same-sign declines vs `35` baseline on a `+104`
target — repulsion real; `−q` knots decline `+par` ~12% less
(attraction). Knots also **repolarize** under sustained
opposite flux — a `−q` node fed `+par` packets flips `+`.

## Absorbing boundary

`qAbsorbWall` (`moore26_absorb_set`) zeroes the outer shell of
`grid_next` each tick — open-box conditions for emitter
demos; the x/y torus wrap no longer recirculates pumped
streams into the measurement.

## Runtime tuners (all exported, `build.sh` synced)

`fusion_wall`, `commit_min`, `ground_floor`, `confirm_cap`,
`catch_gate`, `dir_bias`, `deflect_align`, `dd_shift`,
`bend_shift`, `rad_shift`, `phase_gate`, `phase_sync`,
`evap_shift`, `absorb`, `charge_set`, `packet_par_set`,
`chargeflight_get`, `audit`

## Deviation audit — verified vs nature

**Where the substrate matches (measured, not asserted):**

| claim | status |
|---|---|
| Rest mass exists | ✓ Prigogine equilibrium — `~42k` plateau, `M ∝ 2^shift` spectrum |
| Radiative decay | ✓ spin-aligned `nu=1` emission on the circulation axis |
| Charge sign matters | ✓ `ev45=331` same-sign declines, `~12%` attraction asymmetry — *local* |
| Pair production | ✓ fusion wall `256` → `±q` fragments, net-zero charge |
| String break | ✓ `≥12`-node tubes fracture + charged endpoints — confinement analog |
| Persistent current | ✓ loss-free rail circulation on rings |
| Ledger | ✓ `~0.1%` residual, every phase audited |

**Where it deviates — the honest list** *(observational
measurements only — what nature's instruments actually record;
inferred rules like Pauli exclusion are excluded by definition):*

1. **Charge isn't a field** — nature measures `1/r²` attraction
   and repulsion at range; ours fires only under offer congestion
   (`armed≥4`) — a traffic jam, not a field.
2. **Parity is symmetric** — `0.89-1.0` `dd` ratio; the weak
   sector's `P`-violation is a measured observation we don't
   reproduce.
3. **Knots don't fly** — measured particles translate
   ballistically; mass-anchored winding doesn't follow parked
   mass — ours crawl.
4. **No Lorentz structure** — time dilation and contraction are
   measured (muon lifetime, GPS); `c` here is a lattice constant,
   not emergent invariance.
5. **Decay isn't a lifetime** — nature measures an exponential
   decay curve per species; ours is a friction tax, not a
   quantized lifetime.
6. **Mass spectrum is approximate** — `~3.4-3.9×` not clean `4×`
   (finite pump, not an ideal bath); nature's particle masses are
   measured constants.
7. **Gravity absent** — gravitational attraction is measured;
   routing asymmetry is proposed, not implemented.
8. **Ledger `~0.1%`** — exact conservation is measured; `P7-break
   −63` and the audit's mid-tick artifacts remain documented
   seams.

**Verdict**: local transaction physics is honest (conservation,
charge-sign, pair production, confinement); **field-level and
relativistic physics is the open frontier** — charge range,
knots-in-motion, and Lorentz structure are the next deviations.
