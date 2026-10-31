# qi3 — the transactional substrate

The next engine after `link3`: a lattice whose only rules are local
causality and transactions — CDT-style discrete spacetime, 't Hooft's
deterministic cellular automaton interpretation, and Kastner's
Transactional Interpretation made mechanical.

## The ontology

Everything is an edge. Nine duplex edges per site carry the structural
state (bonds, sessions, confirmations); eighteen directional channels
carry transport (photons, mass flight). A site's *internal state is
constituted by its edges* — closed circulations of winding across
channel pairs, not hidden registers. Levels are derived, never
enumerated.

## The heartbeat (the TI made mechanical)

Emission and absorption are a mutual transaction, not photon impact:

1. **Offer** — a photon (energy tag `nu`, birth tick) transits an edge
2. **Incipient** — a matching offer is *held* on the edge: the
   absorber reacts first, without absorbing yet
3. **Resolution** — next tick, a weighted lottery
   (`count*nu*(1+bond)`) actualizes ONE incipient per site;
   declined offers rejoin the stream
4. **Confirm** — the actualization spawns an ACK that walks back
   `ttl=tau` hops and delivers `qBondDist = 2*tau` — a retarded
   round-trip, no advanced waves; the transaction completes at
   BOTH endpoints with a measured distance

Stimulated emission competes in the same lottery (one clone per
trigger — one atom, one transition).

## Structure from circulation

- `qWinding` = closed loops on edges (matched antipodal pairs);
  `siteLevel` = `1 + loopWinding>>8` — read off the pattern
- **Quantization is dynamical**: only complete winding bands are
  stable; sub-quantum circulation evaporates as photons
- **Emission is a transition**: one quantum per `n->n-1` drop, at
  the actual gap — a cascade produces a real multi-line series
- **Charge** = bound energy that *thermalizes into winding*

## The `E_n` candidates (falsifiable)

`gap_mode` 0–5: harmonic comb, `E0/n^2`, `E0/n`, `E0*n`, `E0*n^2`,
and **mode 5 — geometric**: the gap derives from the loop's actual
edge mix and *measured* reach (`qBondDist`, `E~w/L^2`). Same level,
different circulation geometry, different emitted `nu` — the
spectrum IS the structure.

## Measured results

- **Converging absorption series** (`E0(1-1/n^2)`-family) — the shape
  `link3`'s diverging bands couldn't express
- **Stimulated emission** — `91` clones at the `n=2->1` gap vs `0`
  off-line; the signature `link3` lacked
- **Exact kinematic wall** — fusion requires `nu_a+nu_b >= 256`
  (each gamma needs ~`mc^2`): `nu<=127` ignites `0/6`, `>=128` `6/6`
- **Nucleation sigmoid** — `P(ignite)` climbs `0.33->1.00` across
  `rho=0.005->0.016` — stochastic ignition, real nucleation
- **Back-to-back annihilation** — antipodal winding decays to equal
  `15=15` photon populations
- **RTT distance** — `distA=4` hops on the axis edge = the 8-cell
  gap at 2 cells/hop, exactly measured
- **Lossiness ~0.45** — 't Hooft's metric: nearly half the tick is
  irreversible, the scale where emergence lives
- **Level distribution peaks at n=5** — the universe thermalizes
  into a characteristic excitation, not the ground

## Conservation

`uint32` registers throughout — no caps, no silent evaporation.
Emission deposits energy (`dumpE/nu` photons), stim clones are
afford-gated, transit loss has a charge sink. The ledger is sealed.

## Honest status

`qi3` is a candidate substrate, not a validated theory. Its
mechanics are measured, its conservation is audited, its claims
are ratios and shapes — never retrofits. The `E_n` table's
functional form and the `256`-winding band quantum remain
parameterized constants awaiting deeper derivation.
