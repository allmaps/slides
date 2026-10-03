---
"@allmaps/slides": patch
---

Show no basemap when no custom map style or Protomaps API key is supplied, in both the application and generated previews. Projects using Protomaps can continue supplying a key in configuration or through `PUBLIC_PROTOMAPS_KEY`. Newly initialized projects no longer need an empty `map.styles` block.
