---
"@allmaps/slides": minor
---

Add top-level `layers` configuration for shared visibility, opacity and transition defaults. Entries with `layer` customize generated GeoJSON layers; full MapLibre definitions with `id`, `type`, `source`, `layout` and `paint` add custom layers, including text labels from GeoJSON properties.

Resolve each slide and start screen against these defaults in both the live map and thumbnails. Slide changes no longer leak opacity, visibility or transitions into other slides, regardless of navigation order. Custom layers draw above generated layers in authored order; fill, line and point layers follow normal MapLibre drawing order. Text overlays also receive a glyph endpoint when no basemap is configured.

Use native MapLibre opacity transitions for user GeoJSON layers when slide visibility changes (300 ms by default). Preserve authored opacity and delay hiding until fade-out completes. Whole-layer opacity lets lines and fills fade while retaining feature styling. Feature-dependent circle and symbol opacity may switch abruptly; use constant opacity for smooth fades. Remove custom animation and opacity-expression rewriting. Initial rendering, reduced-motion preferences and entering full-map mode bypass transitions. No configuration changes are needed.

Fix the duplicate internal `user-` prefix. Use `<source>-line`, `<source>-fill`, `<source>-point-circle`, `<source>-point-symbol`, or a custom layer's `id` in authored overrides. Remove the extra `user-` from any overrides that worked around the old bug.
