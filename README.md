# Allmaps Slides

Create interactive narrative maps from Markdown, historical maps and images.
Allmaps Slides combines Allmaps, MapLibre and Protomaps, and exports a static
website you can host yourself.

Principles of the project:

- Developed for academic use. Tested in the classroom and developed with students from various disciplines, Allmaps Slides helps students become familiar with digital humanities workflows and open data formats.
- Shared software, independent content. A centrally maintained codebase lets presentations benefit from shared improvements without each project maintaining its own software. Authors manage their content in separate repositories and choose when to update. The [license structure](docs/licensing.md) supports this independence, allowing authors to choose their own content license.
- Combine local and remote resources. Annotations, IIIF resources, map styles, GeoJSON, images and map tiles can be loaded from remote services or included in the content repository. Authors choose which resources to keep locally and which services to depend on.

View in action:

- [Gravity at Sea](https://tu-delft-heritage.github.io/gravity-expeditions-app)
- [Kattenburg Atlas](https://kattenburg.amsterdamtimemachine.nl/) (Dutch only)
- [Reuzenarbeid](https://tu-delft-heritage.github.io/reuzenarbeid/) (Dutch only)
- [From Image to Map](http://pages.allmaps.org/slides-template) (GitHub template)

_Allmaps Slides is currently in beta. Try it out and share your feedback, ideas or bug reports through [GitHub issues](https://github.com/allmaps/slides/issues)._

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

Open the URL printed by the server. The template uses remote images and a
Protomaps basemap. Follow its [API key setup](content/slides-template/README.md#preview)
when copying or forking it.

- [Development and releases](docs/development.md): source setup, checks and npm bundles.
- [Architecture](docs/architecture.md): application, package and content boundaries.
- [Content examples](content): independent repositories included as Git submodules.

`pnpm bundle` builds the npm package. `pnpm build` builds the Gravity at Sea
site after its content submodule has been initialized.

## Inspiration and previous versions

- [Reuzenarbeid](https://tu-delft-heritage.github.io/reuzenarbeid/) was originally a Jekyll site and the first narrative map made with Allmaps. It was inspired by Bert Spaan's [The Changing Shoreline of New York City](https://github.com/nypl-spacetime/the-changing-shoreline-of-nyc), which was in turn inspired by [Travel the path of the solar eclipse](https://www.washingtonpost.com/graphics/national/mapping-the-2017-eclipse/).
- [City Atlas](https://cityatlas.theberlage.nl/), one of three atlases made with the postmaster's programme of the [The Berlage Center for Advanced Studies in Architecture and Urban Design](https://theberlage.nl/) at TU Delft, in collaboration with Allmaps.
- Existing templates for storytelling applications using MapLibre such as [Interactive Storytelling with MapLibre](https://github.com/digidem/maplibre-storymap/).

_The development of Allmaps Slides was financially supported by the [Samenwerkende Maritieme Fondsen](https://www.samenwerkendemaritiemefondsen.nl/) for the publication of [Kattenburg Atlas](https://kattenburg.amsterdamtimemachine.nl/)._
