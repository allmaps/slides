---
"@allmaps/slides": patch
---

Show no basemap when no custom style or Protomaps key is supplied, including in
previews. An empty `map.styles` block is no longer needed. Keys can still come
from configuration or `PUBLIC_PROTOMAPS_KEY`.
