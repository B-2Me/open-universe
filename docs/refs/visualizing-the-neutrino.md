---
title: visualizing-the-neutrino
audio: /audio/visualizing-the-neutrino.mp3
---

<ClientOnly>
  <StickyAudioPlayer :audioSrc="$frontmatter.audio" />
</ClientOnly>

# Visualizing the Nucleus — Mysteries of the Neutrino

*MIT Department of Physics — transcript of [https://youtu.be/mAClw7r3ETc](https://youtu.be/mAClw7r3ETc)*

<iframe width="560" height="315" src="https://www.youtube.com/embed/mAClw7r3ETc?si=6nZF_mjM_93MJzx8" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

Neutrinos play an important role in atomic nuclei. They appear as byproducts in one of the most common nuclear processes encountered in nature, beta decay. They're also special in that they may explain why the cosmos that formed in the big bang was not annihilated by equal parts antimatter, but instead resulted in a universe dominated by matter.

Atomic nuclei contain not only positively charged protons but neutrally charged neutrons. Now while a proton can exist by itself in a stable form, neutrons on their own are unstable and will quickly decay into a proton, electron and anti-neutrino. This process is called beta decay as an electron or beta particle gets emitted. Neutrons remain stable when bound to a proton by the strong force in nuclei. The process of beta decay can also occur in a nucleus. For example, a neutron can decay in a tritium nucleus, turning it into helium-3 — a process that powers our exit signs. Other notable uses of beta decay include carbon-14 that is used to date our earth, world history, and art, and technetium-99 that is widely used in nuclear medical imaging. Beta decay is also essential to the fusion process in the sun that is responsible for the creation of the lighter elements in stars.

Neutrinos have a low probability of interaction, making them very difficult to detect. Groundbreaking experiments have shown that a large fraction of neutrinos emitted from the sun transform into other types of neutrinos. This can only be possible if neutrinos have mass. Observations of neutrino transformations in earth-based experiments show the amazing impact of quantum mechanics at the macroscopic scale.

In a nucleus with multiple neutrons, the beta decay process can double. Double beta decay occurs in nuclei who cannot undergo a single beta decay as the required energy is unavailable. But it is energetically advantageous for them to decay into a more stable nucleus by simultaneous emission of two electrons — turning two neutrons into two protons. Here the sum of two electrons will give a continuous energy spectrum as energy is carried away by the unmeasured anti-neutrinos. Double beta decay was first calculated by Maria Goeppert Mayer in 1935. It was first observed in a laboratory in 1987 by the group of Michael Moe at UC Irvine in a sample of selenium-82 where two neutrons turned into two protons which transformed the atom into krypton-82. Double beta decay is the rarest known kind of radioactive decay with a lifetime of more than 10 to the power of 18 years. To date, it has been observed in 14 nuclei, the lightest being calcium-48.

Einstein pointed out that energy can convert to mass by simultaneously creating particles and antiparticles. Conversely, a particle can meet its own antiparticle and they annihilate and convert to energy. In 1937, Ettore Majorana demonstrated that all results of beta decay theory remain unchanged if the neutrino were its own antiparticle. But can a particle also be its own anti-particle? Yes — for example, this is true for a photon. But what about neutrinos? If a neutrino is its own anti-particle, then two neutrinos can annihilate each other. In the double beta decay process, both anti-neutrinos are created with the same helical spin direction. However, if the neutrinos have a nonzero mass, there's a tiny possibility for a different helical direction and then this neutrino can be reabsorbed in a double beta decay process. No neutrinos appear. This trick is called neutrinoless double beta decay. This quantum sleight of hand has produced two electrons with nothing else to balance the decays. This violates an assumed truth in nature — that one cannot create electrons without associated anti-particles. So this would be shocking since there are no more neutrinos to carry away the energy. The sum of the electron energies must become unity due to the conservation of energy. The telltale signature would thus be a small increase in probability at unit energy. The probability for this is very very tiny. Why is this so? The best known upper limit of neutrino mass is less than 1 millionth of that of an electron as extracted from precise measurements of the energy spectrum of tritium beta decay. Neutrinos can only change their spin because of this mass. Now that their mass is so tiny, it reduces an already rare double beta decay process even more. In a nucleus, the neutrinoless double beta decay process may only happen once every 10 to the power of 26 years, dwarfing the 14-billion-year age of the universe itself. For each ton of material, scientists look for one decay event per year. Tons-scale experiments are envisioned requiring vast amounts of designer nuclei in order to observe a single double beta decay event.

If neutrinoless double beta decay can create electrons without antiparticles, it points to a mechanism that creates matter but not antimatter. This could lead to a deeper understanding of how our universe exists in the first place. Scientists have assumed that equal amounts of matter and antimatter were created after the Big Bang, which would have annihilated each other, leaving a universe empty of matter and filled only with energy. But clearly, our universe is made of matter with no sign of a parallel antimatter universe. Why we survive the annihilation is a cosmological mystery. Can the observation of neutrinoless double beta decay point to an explanation of the matter-antimatter asymmetry that we see in our cosmos?

## Substrate mappings (moore26)

- **Neutrino = the off-band flux** — our off-resonance packets
  that carry energy away and *never arm*: the `nu%line` reject is
  literally neutrino transparency. The arm gate is our
  interaction cross-section — tunable from photon-like (arms) to
  neutrino-like (flies through).
- **Helicity = `packetPar`** — the neutrino's helical spin
  direction is exactly our parity currency; "same helical
  direction" emission is our `PAR_SIGN` stamping.
- **Mass enables helicity flip** — a near-massless quantum can
  only flip spin *because* of its mass → a parity-flip channel
  (tiny probability of `packetPar` inversion in flight) would let
  an emitted quantum *reabsorb* — the neutrinoless double-beta
  mechanism: same-helicity emissions normally can't be eaten
  back, a flipped one can.
- **The spectral signature** — our emission `nu` spectrum already
  shows a soft endpoint (shed-rung quantization); a parity-flip
  reabsorption channel would put a unit-energy spike on it —
  same telltale.
- **Matter/antimatter asymmetry** — `charge` register is signed;
  the asymmetry question maps to whether `±`-charged knot species
  have equal stability/abundance in the species census.
