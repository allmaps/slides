---
"@allmaps/slides": minor
---

Remove `warpedMaps[].type: Image` and its image-only `region` and `wiggle` options. Warped maps now always load georeference annotations. Remove the generated georeferencing helper, the `model/map/image` export, its Turf dependency, image-specific layer controls and the unused `imageLayer` label. Images no longer trigger automatic basemap hiding or immediate camera transitions.

Move non-georeferenced images from `warpedMaps` into zoomable IIIF figures in the slide's Markdown:

```html
<figure data-image="https://example.org/iiif/image" aria-label="Image description">
  <figcaption>Image caption</figcaption>
</figure>
```

Use `data-region="x,y,width,height"` on the figure to keep a crop and `data-rotation` for rotation. Set slide-level `hideBasemap: true` when needed. Zoomable text images and their IIIF services are unchanged. Remove the obsolete options and label from the docs and template references.
