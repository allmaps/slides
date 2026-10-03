---
"@allmaps/slides": minor
---

Use a single slide/start-screen `fit` option for automatic map fitting in the live viewer and generated previews. It uses the same sizing logic as Allmaps' `getMapCenterZoomBearing`: `contain` (the default) shows all map bounds, `cover` fills the available viewport with cropping, and `equal` gives the map bounds the same area as the available viewport. Maps marked `useZoom` still determine resource-scale zoom, and an explicit `location.zoom` takes priority over both. Per-map layer thumbnails and the temporary "Show full map" view continue to show the entire map.

Make slide/start-screen `padding` a uniform inner margin in pixels, separate from the space reserved by the interface. `fit: cover` with `padding: 0` fills the available layout area without an extra margin. Negative values enlarge the fitting area for extra cropping without moving the layout center. The reading panel's reserved space and camera offset remain controlled by the app. Explicit padding applies to both the live view and generated slide/sharing images. Omitting it preserves the existing margins: 25 pixels live, 20 in slide previews and 32 in sharing images. Per-map layer thumbnails retain their own margin, and the temporary "Show full map" view always uses the normal 25-pixel margin.

Remove the unused chapter-level `caption`, `freeze` and `contain` declarations from the schema and public types. They had no effect in the bundled app. Per-map `warpedMaps[].caption` remains supported. Custom metadata is still allowed, so old unused keys do not prevent existing slides from loading.

Remove the unused interface labels `chapterCountSingular`, `chapterCountPlural` and `noCredits`, including the chapter-count keys in `interface.startScreen`. Keep `startButton` and `madeWith` as supported legacy fallbacks, with `interface.text` taking precedence. Remove the obsolete fields, labels and `readMore` example from the documentation and template references.
