# Allmaps Slides

Create interactive narrative maps from Markdown, historical maps and images.
Allmaps Slides combines Allmaps, MapLibre and Protomaps, and exports a static
website you can host yourself.

Principles of the project:

- Ready for academic environments. This project has been tested in the classroom, and was developed in collaboration with groups of students from various disciplines, with the aim to make them familiar with digital humanities workflows and open formats.
- Flexibility between self-contained and API-driven. Allmaps annotations, IIIF resources, map styles and GeoJSON data, additional imagery, and even map tiles can be called from remote APIs or integrated in the repository directly.
- Reusable, openly licensed software. The CLI and libraries use MIT; the app uses GPL-3.0-or-later with a [content permission](docs/licensing.md) that lets authors choose licenses such as CC BY for their own material.

## Create a slideshow

Start with the [package quick start](packages/slides/README.md) or the
[GitHub template repository](https://github.com/allmaps/slides-template), which includes
a small example and annotated configuration files.

The [documentation](docs/README.md) covers writing slides, adding images,
configuration and deployment.

## Work on Slides

Use Node.js 24 or later and pnpm 10. From this checkout:

```sh
pnpm install
git submodule update --init content/slides-template
pnpm exec slides dev ./content/slides-template
```

Open the URL printed by the server. The template uses a plain background and
remote images, so no basemap API key is needed.

- [Development and releases](docs/development.md): source setup, checks and npm bundles.
- [Architecture](docs/architecture.md): application, package and content boundaries.
- [Content examples](content): independent repositories included as Git submodules.

`pnpm bundle` builds the npm package. `pnpm build` builds the Gravity at Sea
site after its content submodule has been initialized.

## Inspiration and previous versions

- [Reuzenarbeid](https://tu-delft-heritage.github.io/reuzenarbeid/) was originally a Jekyll site and the first narrative map made with Allmaps. It was inspired by Bert Spaan's [The Changing Shoreline of New York City](https://github.com/nypl-spacetime/the-changing-shoreline-of-nyc), which was in turn inspired by [Travel the path of the solar eclipse](https://www.washingtonpost.com/graphics/national/mapping-the-2017-eclipse/).
- [City Atlas](https://cityatlas.theberlage.nl/), one of three atlases made with the postmaster's programme of the [The Berlage Center for Advanced Studies in Architecture and Urban Design](https://theberlage.nl/) at TU Delft, in collaboration with Allmaps.
- Existing templates for storytelling applications using MapLibre such as [Interactive Storytelling with MapLibre](https://github.com/digidem/maplibre-storymap/).
