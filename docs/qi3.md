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

## Authored boundaries ledger (as of the thermal-equilibrium arc)

**Every constant we wrote in — vs what the substrate derives.** The
falsification discipline: authored is chosen, derived is measured.

### AUTHORED (hardcoded constants — physical guesses, not derived)

| Constant | Value | What it represents |
|---|---|---|
| Loop quantum | `128` winding | one complete cycle's amplitude |
| Fusion wall | `256` | `2×` quantum — pair-production threshold |
| Thermalization floor | `288` | survival `32` + one quantum `256` |
| Drain floor | `32` | metastable partial-loop threshold |
| Level threshold | `64` | weakened cycles still count as structure |
| `qUnwindShift` | `2` | rung spacing — `1/4` loop per emission |
| `qCycleShift` | `0` (test `2`) | internal-cycle rate vs transit `c` |
| `qTempShift` | `6` | global vacuum-heat target `~96` (rest temperature) |
| Photon channel cap | `255` | field finite state space (`'t Hooft` bound) |
| External held cap | `9` edges | node receptive capacity (the boundary) |
| Internal held cap | `vol/128` quanta | intra-node capacity from bound volume |
| Emission lifetime | `randByte()&3` | stochastic `~1/4` gate — the radiative lifetime |
| Bent-deposit odds | `50/50` | straight vs corner-loop split (needs density-emergence) |
| Channels/edges | `18/9` | the lattice's interface geometry |
| Photon transit | `1` hop/tick | `c` at transit scale |

### DERIVED (emergent — measured, not written)

- **Level** = occupancy volume (bound circulation / quantum)
- **The `256` band** — emerged from the drain's shedding, not authored
- **Level histogram** — thermal distribution `n=4-7` under bent loops
- **Attractor winding** `~1464` median (`~5.7` loops/site)
- **Line ratios** — edge-geometry `L²` classes (`64/85/128`)
- **Selection rules** — topological mode `6`: the ladder filters offers
- **Void fraction** `~0.1-0.4%`, occupancy uniform across edges
- **Absorb/stim counts** — real transaction volume post-transaction-units

### TUNABLES (knobs for sweeps)

`qGapMode` (0-6), `qGapScale`, `qPhaseMode`, `qUnwindShift`, `qCycleShift`, `qTempShift`

### THE RUNAWAY ARC (what the flood taught)

The photon-field flood was a stacked-mechanics issue, fixed in layers:
1. `qHeld+=offer` counted population as one incipient → transaction units (`+=1`)
2. `qPhoton[cc]+=h+1` stim clone multiplication → `+=1`
3. uncapped stim-arm path → receptive-capacity bound
4. emission running at transit rate → `qCycleShift` internal clock
5. unbounded photon population → channel cap `255` + vacuum-heat sink

**Remaining unbound**: emission source rate vs all sinks — production
still wins at high injection. The field equilibrium is contended
(dips + recovers) but not closed.

## The bootstrap deadlock — how the medium learned to assemble itself

The most instructive arc in the substrate's development: a cascade of
~8 mechanism layers chasing a "cold medium" that turned out to be a
single structural gate.

### The symptom

After the flood fixes (presence-model photons, unlocked edges, density
opacity, self-driving re-emission), the medium was stable but nearly
dead: ~47 massive sites, ~1 absorb per 150 ticks, ~300 photons.

### The wrong diagnoses (all tried, all instructive)

1. **Rate imbalance** — `cycle=4` helped the flood but froze structure
2. **Missing sink** — vacuum decay + heat reservoir: correct physics,
   didn't wake the medium
3. **Self-driving needed** — thermal re-emission closes the cycle:
   real physics, still cold
4. **Two-channel competition** — decay vs absorb branching ratio:
   correct model of opacity, still cold
5. **Temperature coupling** — heat should melt structure: REAL physics
   but applied to the WRONG problem — the medium had no structure to
   melt yet. Reverted.
6. **Coverage/density** — sweeps showed structure saturates at ~2.3%
   regardless of photon flux: self-limiting, not flux-limited

### The actual diagnosis — a bootstrap deadlock

The resonant-seed test exposed it: photons at rung-scale `nu`
(32..128) still gave `absorbs=0`. Walking the path:

- `absorb` requires `mass != 0` (line 588: `if(!offer||!mass)continue`)
- `mass` forms only via fusion (`nua+nub >= 256`)
- fusion needs high-nu photons -> resonant photons can't fuse
- -> no mass -> no absorption -> no structure -> no mass. Deadlock.

**The physics error**: `mass` was a *prerequisite* for absorption when
it should be a *consequence* of bound structure. In TI, any region can
be an absorber — a bare site should hold an incipient; the deposit
CREATES the winding that becomes the mass-equivalent.

### The fix — rare bare-site catch

```c
if(!offer)continue;
if(!mass&&(randByte()&15))continue;   /* 15/16 pass through */
```

Bare sites arm incipients at 1/16 rate — weak-vacuum absorber, not
strong. Mass derives from structure, not the other way around.

### The result — the medium ignites

```
resonant: 1164 absorbs, 1687 loops, photons consumed to 101
mixed:    4 absorbs, 6 loops
off:      0 absorbs, 0 loops  (correct: off-resonance streams past)
```

The substrate does honest spectroscopy — resonant photons bootstrap
structure, off-resonance free-stream. The medium is self-assembling.

### What the arc teaches (methodology)

- **Diagnose UPSTREAM first**: the dead medium wasn't cold, it was
  gated — every rate-tuning attempt treated a healthy gate as a bug
- **Falsifiable predictions first**: the resonant-seed test was the
  FIRST test that could fail cleanly — and it did, pointing at the
  real gate instead of another rate
- **Mass is derived, not given**: the occupancy model already said
  this — the arm gate contradicting it was the actual bug
- **The substrate tells you its physics**: "cold medium" was really
  "frequency-selective medium" — honest spectroscopy we mistook for
  a frozen state

## The two-regime structure — and its map onto nature

The recalibration exposed the substrate's honest working model:

| Substrate regime | Nature analog | Mechanism |
|---|---|---|
| **Dilute loop-medium** (`nu <= 128`, resonant) | Atomic/bound-state physics | photons -> winding -> bound circulation; accessible at ordinary energies |
| **Massive phase** (`nu-pairs >= 256`) | Particle/nuclear physics | fusion -> qMass; our `256` wall is the analog of `1.022 MeV` pair-production |

**The honest consequence**: the "cold medium" IS the correct working
regime — the loop-medium is where bound-structure physics lives, same
as ordinary matter lives in the atomic regime, not the pair-production
regime. `0` massive sites in a resonant bath isn't a failure — it's
the substrate correctly saying mass-creation happens in the hot sector.

**The amplitude split**: `64`-amplitude (bent `64+64` deposits) is
the majority bound state over full `128` loops — the substrate's real
"iron" is the partial loop, not the full one.

**For future probes**: study the loop-medium for bound-state physics
(the main regime); mass-creation needs a hot-injection sector —
don't confuse the two.

## The mass-as-consequence fixes — completing the cycle

The substrate's ontology was right; two gates contradicted it. Both
treated `qMass` as a *prerequisite* when the occupancy model already
said mass is a *consequence* of bound circulation:

1. **Absorption gate** (`if(!offer||!mass)continue`): bare sites
   couldn't hold incipients — no first structure could ever form.
   Fix: rare bare-vacuum catch (`1/16`) — mass derives from the
   deposit's winding, not the other way around. Medium ignites:
   `1687` loops from cold start.

2. **Emission gate** (`if(!mass)continue`): level-2 loop-sites with
   `mass=0` couldn't emit — the recirculation was blocked, the
   medium crystallized. Fix: `siteLevel(si)` derives the emission
   condition (winding -> level -> can radiate). Emits climb
   `204->1491`, the structure->emit->photon cycle closes.

**The methodology lesson**: when a "cold medium" resists every rate
fix, look for a *gate* not a *rate* — the substrate's ontology was
self-consistent (mass derives from structure); the `!mass` checks
contradicted it. Diagnosing upstream (what blocks the FIRST event)
beat tuning downstream (rates on events that never fire).

**The substrate's measured identity** (post-unblock):
- Absorption band: `nu=32..128` (rung ladder = resonance window)
- Emission line: `nu=32` (monochromatic ground transition)
- Amp ratio `64:128` = `1.79` (bent half-loops dominate)
- Edge-class `L2=2` bias = `1.31` (diagonal wells preferred)
- Bootstrap: `1/16` bare-vacuum catch rate
- The cycle: `photon -> absorb -> loop -> emit -> photon` — closed
