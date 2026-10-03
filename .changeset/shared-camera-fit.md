---
"@allmaps/slides": minor
---

Support `fit: contain` (default), `cover` and `equal` on slides and start screens,
in both the viewer and previews. Set `padding` for a uniform inner margin without
changing the space reserved by the interface. Use `fit: cover` with `padding: 0`
for edge-to-edge fitting, or negative padding for extra cropping.

Remove unused chapter fields `caption`, `freeze` and `contain`, and interface
labels `chapterCountSingular`, `chapterCountPlural` and `noCredits`.
Per-map `warpedMaps[].caption` remains supported.
