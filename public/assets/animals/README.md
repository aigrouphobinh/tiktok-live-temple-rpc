# Bundled animal devotee models

These two rigged GLB files are used by the optional Three.js sanctuary scene.

| File | Source | Use |
|---|---|---|
| `Corgi.glb` | [Gobkit Free Animal Pack Vol.1](https://gobkit.itch.io/gobkit-free-animal-pack) | Lead devotee and main crowd variant |
| `Duck.glb` | [Gobkit Free Animal Pack Vol.1](https://gobkit.itch.io/gobkit-free-animal-pack) | Secondary crowd variant |

**License:** CC0 1.0 Universal. The source pack manifest identifies both individual models as rigged GLB assets under CC0 1.0. The source-provider licence notice is in [LICENSE](./LICENSE); the full legal text is linked there.

**Runtime:** assets are served from this repository's `public/assets/animals/` directory. The game does not request the models from Gobkit at runtime.

**Animation:** the GLBs contain separately named `idle`, `attack`, `dead`, and `walk` clips. The game uses `idle` and `walk` for visitor movement. Copies are made with Three.js `SkeletonUtils.clone` so their skinned rigs remain independent.

Source manifest: https://gobkit.com/api/free
Source repository: https://github.com/Ariescar/gobkit-free-assets
