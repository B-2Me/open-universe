# moore26 target observables — the 0.1–10 fm measurement contract

What nature actually measures at this scale, and what the substrate
must reproduce to claim it. Native units stay native (ticks, links,
nu, winding, counts); the fm mapping is aspirational until the scale
is over-constrained by independent measurements. Status legend:
**done** = measured and documented; **partial** = measured once,
needs curve/systematics; **open** = not yet attempted.

## A. Structure observables (what the bound object IS)

| nature observable | how nature measures it | substrate analog | status |
|---|---|---|---|
| charge/mass radius (~0.84 fm proton) | elastic e-p form factor slope | bound-object radial profile (packet cloud + committed skeleton) | **done**: bound ring r≈3–4 links ≈0.3–0.4 fm |
| form factor F(q²), diffraction minima | angular distribution of elastic scattering | probe scattering vs momentum transfer q (b ↔ q via uncertainty) | open — needs σ(b) curve then Fourier map |
| constituent count (3 quarks) | DIS, baryon counting | bound-cloud clump census | **done (null)**: congestion artifact, no fixed count |
| constituent composition | parton distribution functions | nu-inventory of bound cloud | **done**: mixed-nu inventory persists 60+t |
| mass:structure ratio (binding) | mass defect | loop_winding/mass equilibrium in the 4m–8m capacitor band | **done**: self-tunes into band; ratio measurable |
| internal angular momentum (spin ½) | polarization, sum rules | bound-ring net L (persistent circulation) | **done**: L_z≈−3900 sustained; isotropy→coherent L |

## B. Spectral observables (what the object radiates)

| nature observable | nature's method | substrate analog | status |
|---|---|---|---|
| gamma line energies | Ge detectors | emitted packetNu = geo_gap | **done**: prediction-verified line=structure |
| level scheme (multi-line) | cascade coincidences | multi-rung spectrum on one object | open — geo_gap emits weakest bond only |
| spectral species ID | isotope identification by lines | two-source resolved lines | **done**: 36–40 + 48 resolved |
| evaporation spectrum (T) | neutron spectra from hot nuclei | soft emitted tail at low excitation | **done**: h=1000 → nu~4–5 tail |
| characteristic emission | gamma lines vs excitation | line-dominated emission at high drive | **done**: h=3000 → nu=16–18 line |
| absorption spectrum | transmission dips | resonant capture vs off-resonant | **done**: nu=line captures whole |

## C. Reaction observables (what objects DO to each other)

| nature observable | nature's method | substrate analog | status |
|---|---|---|---|
| total cross-section σ_tot | transmission vs target thickness | interaction probability vs impact parameter b | **partial**: capture disk on bare mass; bound-object σ(b) = current chase |
| elastic σ / dσ/dΩ | scattering at fixed E | probe survives, deflected — channel-resolved | open — xsec harness |
| absorption σ_abs | transmission loss | probe deposits into structure (resonant whole-capture) | **done** once: nu=34 → 100% capture |
| inelastic/fragmentation σ | shower products, missing energy | above-gap shattering → soft shower | **done** once: nu=150 → ~119×nu≈5 |
| excitation function σ(E) | beam-energy sweep, resonances | σ(nu) sweep → absorption peak at nu=line | open — the resonance curve (predicted peak) |
| threshold behavior | σ onset vs E | capture vs shatter vs transmit boundary in nu | partial — qualitative only |
| multiplicity ⟨n⟩ vs E | shower counting | emitted-shower quanta per absorbed probe | partial — one point (150→119) |
| fusion/merge σ | compound-nucleus formation | two bound objects at overlapping wells → merger | open — needs object-object collision |
| elastic differential dσ/dΩ | angular scans | outgoing channel/angle vs b | open — channel census per event |

## D. Medium/transport observables (what flight THROUGH matter does)

| nature observable | nature's method | substrate analog | status |
|---|---|---|---|
| nuclear attenuation length | beam dump depth | beam survival vs penetration depth | **done**: capture disk + density-tax profiles |
| stopping power dE/dx | energy loss per length | packet nu decrement per hop through structure | open |
| refraction/lensing | phase shifts | qLens deflection vs b | **done** post-fix: 273 bends, sign-correct |
| Cherenkov/wake | radiation at superluminal passage | packet faster than local v_g? | open — v_g=1 is the ceiling |

## E. What success looks like (the contract)

1. **σ(nu) resonance curve**: absorption probability vs probe nu
   shows a peak at nu≈line — the substrate's Δ-resonance analog.
   Width Γ from the curve = the object's natural linewidth.
2. **σ(b) profile**: interaction probability vs impact parameter —
   gives effective σ_eff = ∫P(b)2πb db and an interaction radius
   comparable to the cloud radius (~3–4 links), not the skeleton.
3. **Channel decomposition**: elastic / capture / shatter
   fractions vs (nu, b) — the reaction matrix, not just totals.
4. **Multiplicity curve**: ⟨shower quanta⟩ vs nu — should scale
   ~linearly above the shatter threshold (deep-inelastic analog).
5. **Conservation**: every event closes — energy in = survivor +
   shower + Δmass + Δwinding + Δheat.

Cross-section unit: native σ in links² (per-node probability×area).
At the aspirational scale, 1 link² = 0.01 fm² = 100 mb — the same
order as nucleon-nucleon σ_tot (~40 mb). The match is suggestive,
not claimed.
