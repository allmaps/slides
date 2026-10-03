# Write a slideshow

A project is a directory containing `slides.config.yml`, Markdown slides and
optional assets. No JavaScript entry point or Vite configuration is needed.
Follow the [package quick start](../packages/slides/README.md) for installation,
or use the [Slides template](https://github.com/allmaps/slides-template).

## Files and routes

```text
my-story/
  slides.config.yml
  credits.md
  slideshows/
    main/
      01-introduction.md
      02-the-map.md
    history/
      01-background.md
  assets/
    images/
    annotations/
    geojson/
    logos/
```

List each slideshow in the configuration. Paths are relative to the project:

```yaml
title: My story
main: main
credits: credits.md
slideshows:
  - id: main
    path: slideshows/main
  - id: history
    path: slideshows/history
```

The main slideshow appears at `/`; other slideshows appear at their IDs, such as
`/history`. Numeric filename prefixes set the order: `01-introduction.md`
becomes the `introduction` slide anchor. The `/iiif/` and `/thumbnails/` routes
are reserved. A credits file is optional; omit its configuration entry if you
do not create it.

## Slide frontmatter

Put a YAML block between `---` lines at the top of each Markdown file.
`title` is required. Write the body below it:

```md
---
title: The old city
location:
  center: [4.4924, 52.1590]
  zoom: 15
---

Explore the streets around the old city center.

[Read more about Leiden](https://en.wikipedia.org/wiki/Leiden).
```

`center` uses `[longitude, latitude]`. Use `bearing` for clockwise rotation.
The [frontmatter reference](https://github.com/allmaps/slides-template/blob/main/reference/slide.yml)
lists optional fields, inheritance rules and defaults.

## Historical maps

Add an Allmaps georeference annotation to the slide's frontmatter:

```yaml
warpedMaps:
  - url: https://annotations.allmaps.org/maps/18db05c7aa4e7554
```

For a local annotation, use `path: assets/annotations/map.json` instead of `url`.
To show an original image without georeferencing, add a
[zoomable IIIF figure](images.md#iiif-figures) to the slide's text.

Each slide supplies its own maps; repeat an entry to retain it on the next slide.
Omit `location` to fit the maps automatically, or supply a center and zoom.
Set `fit: contain` (the default) to show all map bounds, `fit: cover` to fill the
available map area with some cropping, or `fit: equal` to give the map bounds
the same area as the available viewport. This applies to the live view and
generated previews, and also works under `slideshows[].start`. `useZoom: true`
overrides the fitted zoom with the map's resource scale; an explicit
`location.zoom` takes priority over both.

Use `padding` to set a uniform inner margin in pixels, inside the area left by
the reading panel and other layout reservations. Positive values add space;
negative values enlarge the fitting area, zooming in for extra cropping.
For edge-to-edge fitting within that area:

```yaml
fit: cover
padding: 0
```

For extra cropping, try `padding: -20`. The interface still controls the reserved
space and camera offset. An explicit
padding also applies to generated slide previews and sharing images. When
omitted, the existing margins remain: 25 pixels in the live view, 20 in slide
previews and 32 in sharing images. This also works under `slideshows[].start`.
The temporary "Show full map" view always uses the normal 25-pixel margin.

Use [configuration](configuration.md) for basemaps, dark-mode map options and
shared GeoJSON overlays. Use [images and captions](images.md) for images inside
the reading panel and [generation](generation.md) for local image services.

## Link another slideshow

Add an existing slideshow ID to a slide's frontmatter:

```yaml
subslideshows:
  - history
```

This adds a link to the slideshow registered as `history` in the configuration.

## Callouts

Use a semantic `aside` with the `callout` class. Keep blank lines around
Markdown content inside the HTML element so links, emphasis, and other Markdown
continue to work:

```md
<aside class="callout">

<h2>About this story</h2>

This short note can include [links](https://example.org) and *emphasis*.

</aside>
```

The heading and body follow the green callout style used in the slide design.
