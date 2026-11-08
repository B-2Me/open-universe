---
title: Cartan's Cascade
description: A live 3D window into the 0.1fm causal substrate. Knots form, radiate, thermalize, and fracture, ticking in your browser.
outline: false
layout: page
pageClass: cascade-page
---

<ClientOnly>
  <div class="cascade-stage">
    <CascadeSimulator />
  </div>
</ClientOnly>

<div class="cascade-doc vp-doc">

# Cartan's Cascade

*The 0.1-femtometer substrate: transactions, not objects — live in your browser.*

What you're looking at is **`moore26`**, the `0.1 fm/node` successor to `qi3`: a `64³` cubic lattice where every node carries `26` channels of quanta on the `3×3×3` Moore neighborhood — the geometric upgrade over the old `18`-channel stencil. At this resolution a nucleon-scale knot spans ~`8` nodes across (~`500` volumetric sites) — enough interior structure for over-pressure routing, decoupled phase coherence, and macroscopic string-breaking to live as *spatial* phenomena rather than abstractions.

The four layers, as painted by the engine itself:

- **structure** (`winding`/`mass`) — deep indigo → brilliant cyan: the bound circulation and parked rest-mass of knots and flux tubes
- **wake** (`phase`) — translucent green → yellow: the Jacobi-relaxed double-cover field, the magnetic-routing background
- **thermal** (`heat`) — glowing red → orange: the per-node reservoir where absorbed flux thermalizes — the vacuum's temperature
- **pol** (`charge`) — deep blue (−q) → magenta (+q): the signed charge ledger — induced dipoles and separating pair-production fragments
- **current** (`packets`) — white-gold: quanta in flight — watch rail streams ride a waveguide without decay
- **handed** (`dd` sign) — indigo (−dd) → amber (+dd): the circulation handedness of every site — the substrate's intrinsic chirality

It opens with the **convergent feed on**: `26` photon spokes pouring at the core. Photons arrive, negotiate the offer→incipient→confirm handshake (max `13` concurrent transactions — saturated nodes deflect rather than stack), deposit into winding, thermalize into heat, and — when a saturated tube exceeds `12` nodes — fracture into charged recoil fragments that fly apart. Cut the feed and the core starves: emission keeps shedding rungs until the knot drains to its ground-state floor.

## Play with it

- **Drag** to orbit; pinch/scroll or the **Zoom** slider zooms. Auto-rotates when idle.
- **☀ feed**: the convergent `26`-spoke photon drive. Toggle off to watch the knot starve and radiate itself down.
- **➤ beam**: a one-sided `+x` photon stream — the hexbuckle probe. Aim it at a wound lump to watch absorption, deflection, and thermalization.
- **⌖ (lump tool)**: tap, then tap the lattice to drop a bound wound knot (mass core + `3` face-edge wound pairs). It radiates from its surface only — interior density stalls decay.
- **⧉ / ⤺**: snapshot the universe, wreck it, rewind.
- **Scenarios**: *flux tube* fractures past `12` saturated nodes (pair-production, charged recoil) · *ring* is a closed `{111}` waveguide carrying a **persistent current** — packets circulate loss-free (view: *current*) · *wound lump* is the spinning condenser species · *chiral pair* seeds one knot of each handedness — they accrete symmetrically (view: *handed* to see the coils) · *meson* binds two condensers with a heavy flux tube — the strong-force demo · *charge attract/repel* runs a `+par` stream at a charged wall — same-sign declines, opposite-sign binds · *quark/proton* are the accreting bound-state line.
- **View menu**: *composite* (default) layers everything; *structure*/*wake*/*thermal*/*pol*/*current*/*handed* isolate each field. **Slice** + **Width** give a tomographic slab — drop Width to `4` and scrub through the knot's mid-plane.

## What it is (honestly)

Every behavior is **measured, not scripted**. The engine is `src/moore26.c`: an AoS `NodeState` lattice with a `Σ(winding + mass + flight + photon·nu + heat ± charge)` ledger that now audits within ~0.1% across every mechanic — the ledger hunt sealed the heat drain, offer-expiry, minting, truncation, and parity-debit leaks to per-phase zero — photon absorption, rung-shed emission (nu = shed/2, recapture restores it exactly), junction-collide annihilation, photon-photon fusion (γ+γ → +q/−q pair, energy threshold `256`), and conserving string-break (endpoint mass + recoil = drained tension). The heat reservoir is a true thermal floor: hot vacuum stochastically re-radiates photons instead of being a one-way sink.

What it is *not*: a simulation of literal Planck cubes. Nodes are coarse-grained causal units; `c` is one local hop per tick *in the representation*. It's a candidate local-causal substrate being characterized — the harnesses measure what it actually does rather than what it should resemble. The known modeling gaps: mass-anchored winding doesn't coherently follow parked mass (knots crawl, not fly), and phase-sync is a relaxation field, not a conserved quantity.

::: details 🔬 Under the Hood

- **Substrate:** `64³` sites, `26`-channel Moore stencil (`6` faces + `12` edges + `8` corners, `edgeLen²` inverse-square weighting), power-of-2 dims with bitmask wrap.
- **Node:** ~`392`B `NodeState` — `winding[26]`, `massFlight[26]`, `photon[26]`/`nu`, incipient transaction fields, ACK/bondDist measurement ledger, `mass`, signed `charge`, `heat`, `localDensity`.
- **Phases per tick:** photon pull-flight + vacuum decay → mass stream/collide/launch → offer/incipient arm → confirm/deposit + ACK → conduction + over-pressure → `10×` Jacobi phase-sync → emission → macroscopic string-break (`≥12`-node tube heads).
- **Vacuum-skip:** `8³` chunk ledger — dead regions cost nothing; only live chunks + a `1`-chunk halo tick.
- **Pipeline:** `moore26_rg_refresh()` packs {structure, phase, heat, charge} into an RGBA8 buffer in the wasm heap → `texSubImage3D` → one instanced draw, same zero-copy path as the ember visualizer.

:::
</div>
