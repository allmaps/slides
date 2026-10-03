---
"@allmaps/slides": minor
---

Add global `layers` defaults and custom MapLibre layers, including GeoJSON labels.
Each slide resolves its overrides independently in the viewer and previews.
GeoJSON layers fade using native transitions; feature-dependent circle and symbol
opacity may switch abruptly.

Fix duplicate layer prefixes. Remove any workaround `user-` prefix from authored
overrides: use `<source>-line`, `<source>-fill`, `<source>-point-circle`,
`<source>-point-symbol`, or a custom layer's `id`.
