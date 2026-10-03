# @allmaps/slides

## 0.1.0-beta.2

### Minor Changes

- ef67504: Add `slides init [directory]` (alias `slides create`) to create a minimal English
  project. Prompts ask for a title and optional Protomaps key; use `--title`,
  `--protomaps-key` and `--yes` for automation. Existing files are never overwritten.
- ef67504: Add global `layers` defaults and custom MapLibre layers, including GeoJSON labels.
  Each slide resolves its overrides independently in the viewer and previews.
  GeoJSON layers fade using native transitions; feature-dependent circle and symbol
  opacity may switch abruptly.
  
  Fix duplicate layer prefixes. Remove any workaround `user-` prefix from authored
  overrides: use `<source>-line`, `<source>-fill`, `<source>-point-circle`,
  `<source>-point-symbol`, or a custom layer's `id`.
- ef67504: Remove `warpedMaps[].type: Image`, its `region` and `wiggle` options, the
  `model/map/image` export and the unused `imageLayer` label.
  Move non-georeferenced images to [zoomable IIIF figures](https://github.com/allmaps/slides/blob/main/docs/images.md#iiif-figures)
  in slide Markdown; use `data-region` to retain a crop and `hideBasemap: true` on
  the slide when needed.
- ef67504: Support `fit: contain` (default), `cover` and `equal` on slides and start screens,
  in both the viewer and previews. Set `padding` for a uniform inner margin without
  changing the space reserved by the interface. Use `fit: cover` with `padding: 0`
  for edge-to-edge fitting, or negative padding for extra cropping.
  
  Remove unused chapter fields `caption`, `freeze` and `contain`, and interface
  labels `chapterCountSingular`, `chapterCountPlural` and `noCredits`.
  Per-map `warpedMaps[].caption` remains supported.

### Patch Changes

- ef67504: Root development commands now accept a content directory instead of selecting
  one automatically, for example `pnpm dev ./content/slides-template`.
  Remove unused app code and dependencies.
- ef67504: Show no basemap when no custom style or Protomaps key is supplied, including in
  previews. An empty `map.styles` block is no longer needed. Keys can still come
  from configuration or `PUBLIC_PROTOMAPS_KEY`.
- ef67504: Fix the missing base `tsconfig.json` warning when starting development, build or
  preview commands.
- ef67504: Hold Space to hide warped maps for comparison with the basemap; release it to
  restore them. This replaces the backtick shortcut. Fix shortcuts after map
  interaction and text-panel scrolling, and make both Space and layers-panel
  hide/show controls redraw immediately after zooming.

## 0.1.0-beta.1

Initial public beta.

- Build and preview map slideshows from Markdown and declarative configuration.
- Install the CLI, application, IIIF generator, renderer and canvas components
  through one package.
- Show the Slides version, source and software licenses automatically in credits.
- Keep independent presentation content under its authors' chosen licenses.
