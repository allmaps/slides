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
To show an original image without georeferencing, use an IIIF Image API service:

```yaml
warpedMaps:
  - type: Image
    url: https://elo.memorix.io/resources/iiif/3/c5cc0a2c-df58-4d69-8a25-fe8d6024ddc7
```

For `type: Image`, use the service URL without `/info.json`.
Each slide supplies its own maps; repeat an entry to retain it on the next slide.
Omit `location` to fit the maps automatically, or supply a center and zoom.

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
