# Allmaps Slides documentation

For installation and a small working example, start with the
[@allmaps/slides README](../packages/slides/README.md).

## Create and maintain a slideshow

| Guide | What it covers |
| --- | --- |
| [Authoring](authoring.md) | Files, frontmatter, maps, linked slideshows and callouts. |
| [Images and captions](images.md) | Local images, IIIF figures, crops, annotations and logos. |
| [Configuration](configuration.md) | Titles, colors, basemaps, overlays, credits and interface text. |
| [Commands](commands.md) | CLI commands, paths and project selection. |
| [Generation](generation.md) | IIIF, thumbnails, overview pages and cache management. |
| [Deployment](deployment.md) | Static builds, public URLs, hosting and search metadata. |
| [Licensing](licensing.md) | MIT tooling, the GPL app and independently licensed content. |

The [template repository](https://github.com/allmaps/slides-template) includes a
small English example and [annotated configuration references](https://github.com/allmaps/slides-template/tree/main/reference).

## Develop Slides

| Reference | What it covers |
| --- | --- |
| [Development](development.md) | Source setup, bundling and package checks. |
| [Releases](releases.md) | Versions, npm publication, GitHub releases and content upgrades. |
| [Architecture](architecture.md) | Workspace boundaries, data flow, caches and watching. |
| [Slides API](api.md) | Public JavaScript exports and a build example. |
| [Interface behavior](interface.md) | Navigation, mobile layouts and viewer integration. |
| [IIIF API](iiif.md) | Image generation, catalogs and adapters. |
| [Static renderer](static-render.md) | Render plans, Linux setup, Docker and supported effects. |
| [Thumbnail generation](thumbnail-generation.md) | Planning, caching and build integration. |
| [Canvas panel](canvas-panel.md) | Component props, styling, lifecycle and packaging. |

[Architecture migration notes](architecture-migration.md) record an earlier
implementation milestone; they are historical, not the current release guide.
