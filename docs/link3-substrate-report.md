# link3 Substrate Report — What the First Candidate Proved

A mechanics-honest accounting of what the `link3` engine (links, sessions, `ν`
spectrum) produced, what it couldn't produce, and what the next substrate
candidate needs. Everything below was measured on `64³–256×20×20` WASM grids.

## The physics program this validates

The substrate's discipline: **only local rules** — a cell reads its own
registers and channel neighbors, moves at most `c` per tick, no global state,
no action at a distance. Then **let the measurements decide** — which features
of effective physics are forced by the causal layer itself, vs which are
contingent. The bridge (`cell = ℓP` or `0.8` fm) is a label, not a mechanic;
`c` is a causal rate (`1 hop/tick`), not a dimensional constant.

## What survived the ratio tests

| Measured ratio | Substrate | Nature | Honest read |
|---|---|---|---|
| Isotropic dilution | `1/r²` mid-range | `1/r²` | ✓ exact — dimensionless |
| `ν ∝ iE` | linear | `E=hν` | ✓ right proportionality |
| Mediator range ∝ `1/ν` | `λ` halves per `2ν` | `ℏ/mc` Compton | ✓ the strongest match |
| Fusion yield ∝ `ν` | `E`-weighted `drest` | `E=mc²` | ✓ energy-conserving |
| `p/E` on absorption | `∝ ν` recoil | `p=E/c` | ✓ momentum ∝ energy |
| Back-to-back annihilation | `5120=5120` antipodal | `e⁺e⁻→2γ` | ✓ perfect balance |
| Beam divergence | linear cone, emission-set | diffraction | ✓ structure matches |
| Binding/cluster trend | defect/lump grows `N=2→6` | binding/nucleon rises | ✓ trend only |
| Hub saturation | per-client declines, total plateaus | capacity limits | ✓ shape matches |
| Time dilation | `6%` absorb drop when moving | rate dilution | ✓ small but real |
| Exchange correlator | `⟨φ₊·φ₋⟩ = −0.81` | two-point signal | ✓ real volley measured |

## What failed or is missing

| Quantum signature | Result | Honest diagnosis |
|---|---|---|
| Stimulated emission | `1944` regardless of drive `ν` | ✗ no laser condition — pure spontaneous decay |
| Photoelectric threshold | noisy plateau, no cutoff | ✗ absorption is graded, not quantum-gated |
| `1/n²` spectral series | lines diverge `8,12,20`, cascade `~2/3` steps | ✗ linear/geometric, not quadratic levels |
| Bond distance falloff | flat to `gap=80+` | wire = lossless channel — no field falloff until transit loss added |
| Lump self-propulsion | now `0` — parked flux | fixed the `drest` leak; lumps are pinned |

## The architecture that worked

- **Registers**: `lREST` (parked mass), `lDR` (winding/momentum),
  `lIE` (charge), `lPH`/`lPHNU` (photons + energy tag), `lSST`/`lSESS`
  (session state), `lBOND` (depth register)
- **`ν` is the multi-role register**: energy (`E=hν`), mediator mass
  (range `∝1/ν`), momentum (`p=E/c`), production value (fusion `∝ν`) —
  exactly how photon frequency works in nature
- **Sessions**: `UDP→LISTEN→SYN→ESTAB→CLOSED` — the bond is a
  transaction protocol, not a force field
- **Bonding**: antipodal complementarity (facing windings exchange) +
  broadcast announcement (nodes emit on all ports until a peer answers)
- **Parking**: wound mass is structure, not transport — `meso3i`'s
  "parked flux stays put" was the retention fix that made bound states stable

## What the next candidate needs

1. **Internal level structure** — `1/n²` needs multiple stable
   *configurations* of a bound pair, not a bigger charge bank. The lump
   needs discrete excitation modes, not just `iE`
2. **Stimulated emission** — a photon of matching `ν` should trigger
   emission (coherent amplification). Requires state-occupancy mechanics,
   not just decay rules
3. **A sharper work function** — `compat=0` rejection exists but isn't a
   clean threshold; the absorb path needs quantum gating
4. **Channel loss for bond range** — the wire is lossless; a real
   short-range force needs mediator persistence to limit the range
   (`ν`-decay does this — keep it)
5. **Keep everything that works** — the conservation ledger, `ν`
   multi-role, session lifecycle, parked mass, broadcast announcement.
   These are proven mechanics, not guesses

## The honest verdict

`link3` isn't the final substrate — it's the proof that *a* substrate
can produce real emergent physics from local causal rules. Its
contribution is the mechanics inventory: which rules force real
structure (conservation, `ν`, exchange, parking) vs which gaps need
different dynamics (quantum statistics, level structure). The next
candidate inherits the proven mechanics and tries a different internal
structure where the quantum signatures live.
