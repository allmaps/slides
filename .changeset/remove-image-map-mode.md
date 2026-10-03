---
"@allmaps/slides": minor
---

Remove `warpedMaps[].type: Image`, its `region` and `wiggle` options, the
`model/map/image` export and the unused `imageLayer` label.
Move non-georeferenced images to [zoomable IIIF figures](https://github.com/allmaps/slides/blob/main/docs/images.md#iiif-figures)
in slide Markdown; use `data-region` to retain a crop and `hideBasemap: true` on
the slide when needed.
