# @allmaps/slides

Create interactive map stories from Markdown, images and georeferenced maps.
The `slides` CLI previews your story locally and builds a static website.
It includes the application, image tools and map thumbnail renderer.

## Quick start

Use **Node.js 24 or later**. Install the npm package in a new directory:

```sh
mkdir my-story
cd my-story
pnpm add -D @allmaps/slides@beta
mkdir chapters
```

Slides is currently in beta. Commit your lockfile to keep builds reproducible.
For a source checkout or a local package archive, see
[development setup](https://github.com/allmaps/slides/blob/main/docs/development.md).

Create `slides.config.yml`:

```yaml
title: My first map story
slideshows:
  - id: main
    path: chapters
map:
  styles:
    light: &plain
      version: 8
      sources: {}
      layers: []
    dark: *plain
```

This uses a plain background, so the example needs no basemap API key.
Create `chapters/01-welcome.md`:

```md
---
title: Welcome
location:
  center: [4.4924, 52.1590]
  zoom: 14
---

Every map has a story. This is the first chapter of mine.
```

Start the preview and open the URL printed in your terminal:

```sh
pnpm exec slides dev .
```

Edit the Markdown file to see your changes. For an example with historical maps,
use the [Slides template](https://github.com/allmaps/slides-template). To add a
background map, follow [basemap setup](https://github.com/allmaps/slides/blob/main/docs/configuration.md#basemaps).

## Check and build

```sh
pnpm exec slides validate .
pnpm exec slides build .
pnpm exec slides preview .
```

The build writes a static site to `dist/` and generates image derivatives and
map previews. Set your public URL before [deployment](https://github.com/allmaps/slides/blob/main/docs/deployment.md).
Linux thumbnail generation needs [graphics libraries and Xvfb](https://github.com/allmaps/slides/blob/main/docs/static-render.md#linux-setup);
development and validation do not run the renderer.

During development, refresh local image services with `pnpm exec slides iiif .`
and map previews with `pnpm exec slides thumbnails .`.
Dependencies install through your package manager; you do not need to install
the other Slides workspace packages separately.

## Guides

- [Write slides and add maps](https://github.com/allmaps/slides/blob/main/docs/authoring.md)
- [Images and captions](https://github.com/allmaps/slides/blob/main/docs/images.md)
- [Configuration](https://github.com/allmaps/slides/blob/main/docs/configuration.md)
- [CLI commands](https://github.com/allmaps/slides/blob/main/docs/commands.md)
- [JavaScript API](https://github.com/allmaps/slides/blob/main/docs/api.md)
- [All documentation](https://github.com/allmaps/slides/blob/main/docs/README.md)

## License

The CLI and libraries use MIT. The included app uses GPL-3.0-or-later with a
content permission, so independently authored slides and assets can retain their
own licenses. See [licensing](https://github.com/allmaps/slides/blob/main/docs/licensing.md).
