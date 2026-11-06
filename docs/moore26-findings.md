# moore26 findings

Measured behavior of the 26-register Moore-neighborhood substrate:
26 registers per node, 12 transporting FCC edge channels (`ch6–17`
on the even-parity sublattice), face `0–5` and corner `18–25`
channels as structure-only registers. All numbers are empirical
outputs of `script/moore/*.mjs` headless harnesses — candidate
substrate mechanics, not claims about nature.

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
- Species-inverse balance: `mass ≈ committed/6` equilibrium;
  massless sites radiate only (nucleation seed required)

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
- Accretion physics: sustained flux → `mass`+`dd` growth at
  plateaued `heat ~7.4M` — driven `E→m` + `E→L` conversion

## Radiation

- Bend luminosity: threshold onset `<rate 2`, scales `326→1787`
  at `rate 2→8`, saturates `1853` with `dd` washout at `rate 16`
- Overdrive doesn't break the knot — it bloats (`vol +100%`),
  direction washes out, structure survives

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
