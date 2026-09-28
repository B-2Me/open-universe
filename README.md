# The Open Universe

Reality is a continuously actualizing, zero-storage substrate. 

This repository contains the source code for **The Open Universe** framework, including the VitePress documentation site and the bare-metal thermodynamic cellular automata engine (`planck.c`).

🌐 **Live Site & Engine Sandbox:** [planckfield.site](https://planckfield.site)

## Repository Structure

*   `/docs` - The VitePress site containing the ontological framework, theoretical audits, and generated Kokoro TTS audio.
*   `/src` - The C source code for the Planck Field physics engine.
*   `/script` - The automated Node.js pipeline for generating TTS audio and sync maps.

## The Planck Field Engine (`planck.c`)
The engine is not a standard web canvas rendering geometric shapes. It is a strictly deterministic, 160,000-node physics grid written in C. It calculates fundamental relational friction, topological unwinding (E=mc²), and entropic gravity, mapping the thermal data directly to the browser via a zero-copy WebAssembly memory bridge.

To compile the WebAssembly engine locally, you need [Emscripten](https://emscripten.org/) installed:
```bash
cd src
chmod +x build.sh
./build.sh
```

## Local Development (VitePress)
To run the documentation site and UI locally:
```bash
npm install
npm run docs:dev
```

## License and Copyright
*   **The Framework & Written Content:** © 2026 Nathan / btwo.me. All rights reserved.
*   **The C/WASM Engine Source Code:** Released under the MIT License.
