---
title: Yarkovsky's Ember
description: A live 3D window into the friction substrate — matter condensed from congestion, ticking in your browser.
outline: false
layout: page
pageClass: ember-page
---

<ClientOnly>
  <div class="ember-stage">
    <EmberSimulator />
  </div>
</ClientOnly>

<div class="ember-doc vp-doc">

# Yarkovsky's Ember

*Matter gathered from friction — accreting, freezing, and walking under light, live in your browser.*

> **Milestone instrument.** This is the first browser build of the `meso3i` engine (44³, drive + beam + rock tool). The full instrument — directional rest, photon coupling modes, pair rules, latency, scene presets — is **[Joule's Mill](/mill-demo)**.

What you're looking at is the **friction ecology** measured in the [Friction Substrate](/interference/meso-monograph) campaign: a True-FCC lattice of 42,592 live cells, each holding 19 integer channels of real quanta. The cyan streams are moving flux; the amber glow is **parked heat** — rest-channel mass that transit drag pulled out of circulation. This is the same engine that produced milestones M33–M38, compiled to WebAssembly and ticking inside your tab. Nothing is animated or replayed.

It opens with the **convergent feed on** — 18 spokes pouring flux into the core — so you can watch an ember accrete from empty space: kinetic quanta cross congested nodes, shed momentum into rest channels, and a glowing core gathers while excess vents back out. Cut the feed and the core doesn't die — it *freezes*, because heat here only radiates while a carrier is transiting. Shine the one-sided beam and the ember wakes, ablates on its far face, and physically **walks toward the light** — the comet-drift locomotion of M36.

## Play with it

- **Drag** to orbit; **two-finger drag** pans, pinch zooms (or the **Zoom** slider). It slowly rotates on its own if you leave it alone.
- **☀ feed** — the convergent 18-spoke drive. Toggle it on, watch the ember gather; toggle it off, watch it freeze in vacuum.
- **➤ beam** — a one-sided carrier stream (+x only). Turn it on while a lump sits frozen and it will re-ignite, then start creeping *toward* the beam — the leading edge eats, the trailing edge evaporates.
- **⌖ (rock tool)** — tap it, then tap the lattice to drop a cold lump of parked heat (~2,000 quanta). The classic trick: drop a rock in empty space, hit it with the beam, and watch it migrate.
- **⧉ / ⤺** — snapshot the universe, wreck it, rewind.
- **View menu** — *ember* (default) shows the whole story: cyan flux feeding amber heat. *heat* is parked mass only, *flux* is moving mass only, *macro* is total occupancy (the shape of the lump with the populations hidden).
- **Tuning** — **Slice** + **Width** turn the lump into a living MRI scan: drop Width to 4 and scrub through the mid-plane to see the heat halo's shells.

## What it is (honestly)

Every behavior here is **measured, not scripted**. The engine is `src/meso3i.c` — integer-occupancy lattice gas on the even-parity True-FCC sublattice, mass- and momentum-conserving collisions, plus the two flag-gated friction rules the campaign validated: transit drag parks moving quanta as rest heat (`friction 8`), and rest heat radiates only while carriers transit (`fricmode -4`). What it is *not*: permanent self-bound matter (unconditional radiation drains it — that was the M33 correction), conservative gravity (M37→M47b: the apparent attraction is transient mutual ablation between self-radiating lumps — passive lumps don't pull each other), or structured matter (M38 — circulation thermalizes in ~25 ticks; directional rest later crossed that boundary — see Joule's Mill). The HUD tracks the ember's rest mass and its real centroid as it moves.

::: details 🔬 Under the Hood

- **Substrate:** 44×44×44 grid; only even-parity cells are live (True-FCC sublattice, 42,592 of 85,184 cells). D3Q19 — 18 moving channels + 1 rest channel, `uint8_t` occupancy each.
- **Pipeline:** `meso3i_rg_refresh()` packs {moving, rest} into an RG8 buffer inside the Wasm heap; `texSubImage3D` uploads it to the GPU once per frame; one instanced draw renders all cells as soft billboards — the same zero-copy path as Hopf's Loom.
- **Feed/beam/rock** are thin JS injectors calling `meso3i_set` — the exact spoke pattern (`RAY=3`, `RATE=4`) used by the headless harnesses `test_accrete`/`test_replay`, so the exhibit reproduces the measured runs rather than an approximation of them.
- **Milestone map:** accrete+vent = M33, freeze-in-vacuum = M35, beam reactivation + migration = M36, circulation dying = M38. (The earlier "two rocks pulling together" reading of M37 did not survive the audit — with carrier-gated radiation, cold lumps don't emit carriers at all, and under the ☀ drive apparent convergence is drive-centric infall, not attraction. The real coupling lives in self-radiating lumps — see M47b.)

:::
</div>
