# Project configuration

Settings live in `slides.config.yml` in your content directory. Start with the
[authoring guide](authoring.md), then copy the settings you need below.
The template's [annotated YAML references](https://github.com/allmaps/slides-template/tree/main/reference)
list accepted options and their defaults, including slide frontmatter and interface text.

Paths in configuration are relative to the content directory. Environment
placeholders are expanded before validation:

```yaml
site:
  basePath: ${SLIDES_BASE_PATH}
  publicUrl: ${SLIDES_PUBLIC_URL}
protomaps:
  key: ${PUBLIC_PROTOMAPS_KEY}
```

An unset environment variable becomes an empty string. Public provider keys are
included in the browser application. See [deployment](deployment.md) for public
URLs and [generation](generation.md) for IIIF and thumbnail settings.

## Basemaps

The quick-start example uses an empty MapLibre style. To use the default
Protomaps basemap, remove that `map.styles` block and supply your public key:

```sh
PUBLIC_PROTOMAPS_KEY=your-key pnpm exec slides dev .
```

Use the same key for builds and thumbnails, and allow your deployment origin
in the provider's settings. Alternatively, point `map.styles.light` and
`map.styles.dark` to your own MapLibre style URLs or files under
`assets/map-styles/`. Protomaps color overrides below apply to generated basemaps,
not custom styles.

## Start-screen maps

Each slideshow can define a start-screen map using the same map fields as slide
frontmatter. When `start` is omitted, the start screen uses the first slide's map
settings:

```yml
slideshows:
  - id: main
    path: slideshows/00-main
    title: Gravity Expeditions at Sea
    start:
      location:
        center: [4.9, 52.37]
        zoom: 11
      warpedMaps:
        - url: https://annotations.allmaps.org/maps/example
```

## Overall titles, descriptions and sharing images

An overall `title` or `description` can be a string, or short and long variants:

```yaml
title:
  short: Kattenburg Atlas
  long: Kattenburg Atlas — four centuries of maritime history
description:
  short: A maritime and military microcosm
  long: Explore the history of Kattenburg through maps, images and stories.
```

If only one variant is supplied, it is used for both. Existing strings also
serve both purposes. The app title, start modal and sharing image use the short
text. The overall description takes priority over the main slideshow's
description in the start modal and on the main route. If it is absent, the
main slideshow description remains a fallback.

Page titles, Open Graph/Twitter metadata and structured data use the long
overall text. Subslideshow page titles append the subslideshow title; their
descriptions use the slideshow/first chapter description, falling back to the
long overall description.

Sharing images are separate 1200 × 630 JPEGs, without text by default.
Enable the title/subtitle overlay and optionally adjust its size:

```yaml
socialImage:
  textOverlay: true
  textSize: 76
```

`textOverlay` defaults to `false`. When enabled, the overall short title appears
over the first slide's map scene, with the overall short description below it.
Subslideshow images use the same overall title and the subslideshow title as
their subtitle. `textSize` is the title size in pixels at 1200 × 630 (default:
`76`, greater than zero and at most `512`). The subtitle scales proportionally
(34 pixels at the default size); long text still shrinks to fit.

These settings only affect sharing images; in-app chapter cards, hover previews
and map buttons always omit text. Disabled overlays do not load a font file.

The default sharing font is the app's bundled League Spartan. To use another
font, supply its family name and a local TTF/OTF path relative to the content
directory (outside the IIIF image folder):

```yaml
socialImage:
  textOverlay: true
  font:
    family: My Display Font
    path: assets/fonts/display.ttf
```

Omitting `path` uses a font already installed on the rendering machine; include
the file for consistent local and CI output. Font files are passed to the
generic renderer as inputs, not embedded in its package. A custom app selected
with `app.directory` should provide the default font or configure its own here.

Run `slides thumbnails .` to refresh sharing images, or build the site. Changes
to the text, its size or its font reuse cached map scenes and only regenerate the text
composition and JPEG. Ordinary development edits still do not start rendering.

## Warped maps in light and dark mode

Each `warpedMaps` entry can provide `options` and `darkOptions`. The app and
preview builder merge app defaults, `options`, then `darkOptions` when the
interface is dark. Omitted dark settings keep their regular values. Switching
back to light mode restores regular options and removes dark-only overrides.

```yaml
warpedMaps:
  - url: https://annotations.allmaps.org/maps/example
    options:
      removeColor: true
      removeColorColor: "#ffffff"
      saturation: 0
      colorize: true
      colorizeColor: "#000000"
    darkOptions:
      colorizeColor: "#ffffff"
```

Use this in slide frontmatter or a slideshow's `start.warpedMaps`. Dark overrides
follow the interface theme even if the basemap has its own fixed theme. Slide
and map-layer previews use the appropriate options and geometry for each theme;
sharing images use the light options. Regenerate previews after changing them.

The layers panel's **Show full map** button toggles the selected map's mask off,
hides the basemap and fits the entire image. **Restore slide view** restores the
authored mask, background and camera. Selecting a different slide clears this
temporary mode and layer visibility changes.

## Interface colors

Choose an Allmaps palette in `slides.config.yml`:

```yaml
theme: purple
```

Available themes are `green` (the default), `purple`, `red`, `yellow`, `orange`,
`pink` and `blue`. Alternatively, supply both accent colors as quoted, opaque
hex values (`#RGB` or `#RRGGBB`):

```yaml
theme:
  fg: "#c552b5"
  bg: "#e8bae1"
```

To choose different colors when dark mode is active, set `light` and `dark`.
Each accepts a palette name or a complete `fg`/`bg` pair:

```yaml
theme:
  light:
    fg: "#c552b5"
    bg: "#e8bae1"
  dark:
    fg: "#e8bae1"
    bg: "#c552b5"
```

For named palettes, for example, use `theme: { light: purple, dark: blue }`.
The colors update with the app's mode switch, saved preference and system mode.
Omitting `dark` reuses `light`; omitting `light` uses the default green palette.
The original palette name and flat `fg`/`bg` forms still apply to both modes.

`fg` colors links, accents, progress and the Start button; `bg` colors the
navigator and overlays. Hover/selected states blend the pair. In dark mode,
the background is mixed with the app's dark neutral. Overlay icons use the
same neutral color as their text. Start-button text stays white for every theme.

Only these two accent colors are configurable. Reading panels, body text,
muted controls and shadows keep their existing light/dark neutral colors.
The UI palette is independent of `map.theme`, map styles and GeoJSON colors.

## Protomaps colors

Use `protomaps.overrides` in `slides.config.yml` to customize the default basemap
with [Protomaps flavor properties](https://docs.protomaps.com/basemaps/flavors):

```yaml
protomaps:
  overrides:
    water: "#D2E1E6"
    park_b: "#D0B8BC"
    wood_b: "#D0B8BC"
    scrub_b: "#D0B8BC"
    zoo: "#D0B8BC"
    landcover:
      farmland: "#D0B8BC"
      forest: "#D0B8BC"
      grassland: "#D0B8BC"
      scrub: "#D0B8BC"
    pois:
      green: "#D0B8BC"
```

These overrides merge with the default flavor in both light and dark mode.
For different palettes, put the flavor properties under `overrides.light`
and `overrides.dark` instead. `water` covers oceans, lakes, rivers and streams;
landcover colors apply at wider zooms, while park/wood/scrub colors apply closer
in. POI colors change label text; sprite icons have their own baked-in colors.

The same settings apply to thumbnail generation. Regenerate existing previews
with `slides thumbnails .`. Overrides can also be scoped to a slideshow or
slide under `map.protomaps`; they do not modify custom `map.styles` files.

## Shared GeoJSON overlays

Declare GeoJSON sources in the content configuration to show them throughout
the project, in both the interactive map and slide/social thumbnails:

```yaml
sources:
  route:
    type: geojson
    path: assets/geojson/route.geojson
```

Feature properties control the appearance using SimpleStyle: `stroke`,
`stroke-width`, `stroke-opacity`, `fill`, `fill-opacity`, `marker-color` and
`marker-size`. Omitted properties use the shared default style. For example,
`{"stroke":"#64c18f","stroke-width":8}` draws a green route. Regenerate
thumbnails after changing the geometry or style with `slides thumbnails .`.

## Credits and chapter numbering

All slides are included in chapter numbering and totals. The start screen shows
the overall title and description, the Start button and the Allmaps credit.
Chapters start at 1. Sections in one subslideshow use `1.1`, `1.2`,
and so on; multiple subslideshows under a chapter add a level: `1.1.1`, `1.2.1`.

Configure one shared Markdown credits document at the top level. A slideshow can
also specify its own document, which is appended after the shared credits:

```yaml
credits: credits.md
slideshows:
  - id: main
    path: chapters
  - id: history
    path: history
    credits: history/credits.md
```

The info panel takes its title from the shared document's frontmatter (or the
slideshow document when no shared document exists). Additional documents use their
own frontmatter titles as section headings:

```md
---
title: Acknowledgements
---

Created by our contributors. [Sources](https://example.org).
```

Paths are relative to the content directory and must name existing `.md` files
inside it. Frontmatter is optional; the configured interface label is the fallback
title. Referenced credits files are excluded from chapter lists and update live.

The credits panel always ends with the Slides version and software notices, even
when no credits document is configured. Clean packaged builds also link to the
matching source commit and release notes. Local software changes are labeled as
modified builds. These details describe the software; your content license and
attribution belong in your own credits document.

If you use a custom application, give visitors access to its matching source:

```yaml
app:
  directory: ../custom-slides-app
  sourceUrl: https://github.com/example/custom-slides-app/tree/COMMIT
```

`app.sourceUrl` is an optional HTTP or HTTPS URL, used only with `app.directory`.
Replace `COMMIT` with the deployed app's commit. Without it, the custom app has no
automatic source link. See [software licensing](licensing.md#distributing-a-site).

## Interface text

English defaults, including accessibility labels and image viewer controls, live
in [the interface settings source](../apps/slides/src/lib/shared/interface-settings.ts). Override any key under
`interface.text` in your content repository. Keep the named placeholders:

```yaml
interface:
  text:
    chapters: Hoofdstukken
    mapLayers: Kaarten
    chapterPosition: "Hoofdstuk {current} van {total}"
    backToTitle: "Terug naar {title}"
    readMore: Lees meer
```

Unspecified keys use English. Existing `interface.startScreen` settings remain
supported; `interface.text` takes precedence. Kattenburg Atlas includes the full
Dutch translation in its `slides.config.yml`.

Start-screen text can be translated from the project configuration. Use
`{count}` where the number of chapters should appear:

```yml
interface:
  startScreen:
    startButton: Start
    chapterCountSingular: "{count} hoofdstuk in deze presentatie"
    chapterCountPlural: "{count} hoofdstukken in deze presentatie"
    madeWith: Gemaakt met
```
