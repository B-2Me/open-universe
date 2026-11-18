---
title: Moore26 Calibration — Units, Ratios, and the 0.1fm Question
audio: /audio/moore26-calibration.mp3
---

<ClientOnly>
  <StickyAudioPlayer :audioSrc="$frontmatter.audio" />
</ClientOnly>

# Units, Ratios, and the 0.1fm Question

*The honest bookkeeping behind "what does one cell mean in nature's
units" — which constants are real structure, which are conventions,
and what would have to be true for the aspirational scale to stop
being aspirational.*

Companion to the [substrate overview](moore26-substrate), the
[plain-language tour](moore26-tour), and the
[constants catalog](moore26-constants).

## The unit ledger

Everything the engine measures is in four substrate-native
denominations: **links** (cell spacing), **ticks** (update rounds),
**register units** (mass `m`, heat `h`, charge `q`, packet quantum
`nu`, winding `w`, momentum `p`, strain `fluxV`), and pure
**counts** (channels, phases mod 256). There is no fifth currency
and no outside meter stick — instruments are themselves substrate.

The one already-fixed dimensional relation:

```
c = 1 link / tick          (measured, exact, all packets)
```

That pins the space–time ratio. One equation, two unknowns —
link length and tick duration remain jointly free until a second
independent measurement lands. `0.1 fm/link` is the aspirational
guess, not a derived value.

## The substrate's action quantum — hiding in plain sight

The offer-phase law is measured exactly (interferometer harness):

```
op = nu · age   (mod 256)        →  λ = 256/nu links
```

Rearranged: `E · λ = 256 nu·link`. In nature, `E·λ = hc`. So the
substrate already possesses a measured action constant — not
authored, read off an interference law:

```
h_sub · c = 256 nu·links         →  h_sub = 256 nu·ticks
ħ_sub     = 256/2π ≈ 40.74 nu·ticks
```

This is the substrate's Planck constant in the *packet* sector, and
it is the single most important number on this page: every other
calibration hangs off it.

## If link = 0.1fm, everything else follows — with one input

Assume the aspirational scale and watch what falls out:

```
ℏc = 197.3 MeV·fm = 1973 MeV·link
→ 1 nu ≈ 7.7 MeV          (256 nu·link = 1973 MeV·link)
→ proton rest energy (938 MeV) ≈ 122 nu
```

A proton is a ~122-nu packet — comfortably inside the `nu ≤ 255`
register. The tick: `0.1 fm/c ≈ 3.3×10⁻²⁵ s`. These are
*consequences of one guess*, not independent confirmations. The
point of writing them down: **one clean dimensionless match would
make all of them real at once.**

## Temperature at wavelength scale — resolved three ways

The worry: "how can temperature mean anything when size is measured
in wavelengths?" Three answers, each measured, not asserted.

**1. The Kelvin test — already passed.** Absolute temperature is
*defined* by the Carnot relation: T is whatever variable makes
`η = 1 − Tc/Th` true for the best possible engine. The substrate's
heat pump computed `η = 1 − hc/hp` **exactly** from locally-read
registers and stalled when the sink filled — the heat register `h`
passes the defining test of thermodynamic temperature. Temperature
is real in this universe; what remains open is its *size*.

**2. The substrate already has a thermal wavelength — it IS the
size.** Vacuum re-emission mints `nu = h>>3` packets (authored
rule), and the phase law converts `nu` to wavelength. Composite:

```
λ_emit = 256/(h>>3) ≈ 2048/h links
```

A hot cell emits quanta whose wavelength *is set by its
temperature*. "Size in wavelengths" is not a problem here — it is
the mechanism. The Wien product `λ·T ≈ 2048` is a genuine constant
of this substrate.

**3. The honest mismatch.** Nature's blackbody peaks where photon
energy ≈ 2.8·kT — on the *hard* side of kT (λ ≈ 0.36·hc/kT). The
substrate mints `nu = h/8` — emitted quanta carry **T/8**, on the
*soft* side. In dimensionless form:

```
nature:    E_peak/(k_B·T) ≈ 2.82        λ_peak ≈ 0.3·λ_T
substrate: E_emit/(k_B·T) = 0.125       λ_emit = 8·λ_T
```

The substrate's emitter behaves like a classical antenna radiating
*below* the thermal energy, not a quantum blackbody. The `>>3`
authored shift *is* this number — it is the single most
nature-addressable authored constant in the engine. Related gap:
radiated power is `P ∝ T` (mint rate constant, quantum ∝ h),
not `σT⁴`. The Wien displacement direction is right; the power law
and peak position are not — both live in one shift and one rate.

## Structural ratios — the only honest comparisons

Dimensionless, measured, and therefore comparable across unit
systems without assuming the scale. Ranked by how load-bearing a
match would be.

### Tier 1 — matches already on the record

| ratio | substrate | nature | status |
|---|---|---|---|
| Carnot bound | η = 1−Tc/Th exact | identical | measured (rule is authored; the stall dynamics are emergent) |
| Kirchhoff Y-split | t = 2/3 exactly (50/50 split, amp 0.66) | 2/3 | **emergent** |
| Bennett pinch | force ∝ I², log-log slope 2.00 | I² | **emergent** |
| Ohm's law | I ∝ V to <0.5%, R ∝ L exact | linear | **emergent** |
| Cherenkov angle | ~30° vs arcsin(v/c)=25.5° | arcsin law | analog, ~18% lattice inflation |
| HBT comb spacing | multiples of λ = 256/nu | source-size relation | analog, measured |
| slipstream capacity | **exactly 2** counter-rotating lanes | spin-½ degeneracy | structural echo |

These prove the substrate reproduces *relationships*, not just
shapes. None yet pins the scale — they are all self-ratios.

### Tier 2 — measurable now, would carry real weight

**Knot compactness `R·m`.** Nature's sharpest dimensionless
statement about a proton: its rms radius is ~4× its reduced
Compton wavelength — `R·m ≈ 4.2` (in ℏ=c=1). Nuclear matter scales
differently: `R ∝ m^(1/3)` (constant density), so `R·m ∝ m^(4/3)`.
The substrate's mass behaves like packed matter (92% exclusion
equilibrium, ~0 packing penalty), which predicts the *nuclear*
branch — but bound states (the 519-winding dimer, string-tension
tubes) might obey `R·m = const` instead. **Measure R(m) for stable
knots.** Three outcomes, all interesting: `const` → Compton-like
hadron analog; `m^(1/3)` → packed nuclear matter (already
suspected); neither → new physics to characterize. This is the
single best next calibration experiment — pure geometry × mass,
no authored constants involved.

**Dimensionless charge coupling `α_sub`.** At 1-link range the
charge force delivers impulse `≈ min|q|>>4`. Define
`α_sub(q) = F·L²/(h_sub·c) = (q>>4)/256` — the coupling *runs with
charge magnitude* (linearly, not q² as in nature). Setting
`α_sub = 1/137` lands at `q ≈ 31` — a candidate "elementary
charge" calibration point *if* the substrate's charge sector ever
maps to electromagnetism. Contextual today; it becomes load-bearing
the moment a charge-to-charge force law is measured at range.

**Emission-spectrum location `E_peak/k_BT`.** 0.125 (authored)
vs nature's ~2.8 — see above. Tunable; a match here plus a T⁴
power law would give the substrate a real blackbody law.

### Tier 3 — internal consistency checks (no nature needed)

**The two-action test.** Packet sector: `ħ_sub = 40.7 nu·tick`.
Mass sector: proper time accrues at `τ ∝ 1440·m` (mass-scaled tick
rate, Compton ansatz). If mass and `nu` are the same energy
(c=1), a body's de Broglie rate should satisfy `ω = m/ħ` — i.e.
the mass clock and the packet phase should reduce to one action.
Measured: they don't obviously (factor ~4–56 depending on window
convention, and the mass clock is documented as a *congestion tax*,
not a phase). Either mass doesn't yet oscillate (no de Broglie
sector — honest current answer) or there's a hidden factor of
2π-ish. **Worth one dedicated harness** — it's the cleanest
internal test of whether wave-particle duality is actually unified
in this engine or still two separate laws wearing each other's
vocabulary.

**Binding fraction.** String-break mints +128 mass/endpoint;
production yield is 62.5–64% of scar→mass. Nature's nuclear
binding is ~0.1–1% of rest mass (deuteron 0.12%). If substrate
bound states hold ~10³× deeper fractional binding, that's a real
structural difference to document, not hide.

## What would actually pin 0.1fm

Ordered by evidential weight if it landed:

1. **`R·m ≈ 4`** for a stable bound knot — would be a dimensionless
   match nobody tuned, against nature's most concrete fm-scale fact.
2. **A force law measured at range** — if anything in the substrate
   falls as `1/L²` (charge, routing-gravity, or pressure), its
   dimensionless strength is immediately comparable.
3. **A second action** agreeing with `h_sub = 256` from an
   independent sector (mass de Broglie, or energy·period of a bound
   oscillation) — internal consistency that makes the first one
   load-bearing.
4. **A mass ratio between two stable species** — the substrate's
   m_p/m_e equivalent. Needs a second particle species first.
5. **The T⁴ blackbody law emerging** from mint statistics rather
   than an authored rate.

Any *one* landing is interesting; any *two agreeing on the same
link length* is the moment the scale stops being aspirational.

## What's contextual (and stays labeled that way)

| constant | nature of it |
|---|---|
| 65535 mass/cell page | register width — sets exclusion scale, not physics |
| 256 phase ring | byte arithmetic — sets ħ_sub |
| `h>>3` mint shift | **is** `E_peak/T = 0.125` — authored, tunable |
| `h>>7` drain | entropy-export rate convention |
| all `>>shift` rates | authored timescales |
| 26-stencil, 12 transport | lattice topology — real structure (FCC kissing number *is* 12), but chosen |
| 1/128, 1/64 floors | authored rates |
| 47:161 accretion | measured but mechanism-specific |
| ~92% exclusion density | geometric consequence of page cap |

The rule the whole table obeys: **shifts and register widths are
unit conventions; ratios between measured outputs are physics.**

## Next measurements, ranked

| # | measurement | harness cost | payoff |
|---|---|---|---|
| 1 | knot R(m) curve — Compton vs packed scaling | small (census on existing knot fixtures) | the leading 0.1fm candidate |
| 2 | mass-sector de Broglie: does a mass `m` cell carry a phase clock at `m/ħ_sub`? | medium (new probe on localTime/phase) | unifies or splits the two actions |
| 3 | emission P(h) power law + spectrum shape | small (seeded-bath sweep on ev51) | characterizes the blackbody gap precisely |
| 4 | charge force vs separation at L>1 | medium | first candidate 1/L² law |
| 5 | second stable species mass ratio | large (needs spectroscopy first) | m_p/m_e analog |

*Written after the qPackPress / Carnot / gravRad arc (rev ~2123426).
Every number traced to `docs/moore26-constants.md`; every claim is
labeled measured, authored, emergent, contextual, or open.*
