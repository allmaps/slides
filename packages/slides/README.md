# @allmaps/slides

Create interactive narrative maps from Markdown, images and georeferenced maps.
The `slides` CLI previews your story locally and builds a static website.
It includes the application, image tools and map thumbnail renderer.

## Quick start

Use **Node.js 24 or later** and pnpm 10. Create a project, install its dependencies
and start the preview:

```sh
pnpm dlx @allmaps/slides@beta init my-story
cd my-story
pnpm install
pnpm dev
```

`init` asks for a title and an optional Protomaps key; you can change both later
in `slides.config.yml`. Press Enter to keep the defaults and use a plain
background. Use `--yes` to skip prompts. `create` is an alias for `init`;
neither overwrites existing files.

Open the preview URL printed in your terminal and edit `chapters/01-welcome.md`.

Slides is currently in beta. The starter pins your Slides version; commit your
lockfile to keep builds reproducible. For a source checkout or a local package
archive, see [development setup](https://github.com/allmaps/slides/blob/main/docs/development.md).

For an example with historical maps,
use the [Slides template](https://github.com/allmaps/slides-template). To add a
background map, follow [basemap setup](https://github.com/allmaps/slides/blob/main/docs/configuration.md#basemaps).

## Check and build

```sh
pnpm exec slides validate
pnpm exec slides build
pnpm exec slides preview
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
