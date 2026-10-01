# CLI commands

Use Node.js 24 or later. Install the published package in your content repository
with `pnpm add -D @allmaps/slides@beta`. For source checkouts or local release archives,
see [development](development.md).

All examples below run from a content directory containing `slides.config.yml`.

| Command | Purpose |
| --- | --- |
| `pnpm exec slides --version` | Show the installed Slides version. |
| `pnpm exec slides dev .` | Validate content and start a development server. |
| `pnpm exec slides validate .` | Check configuration, frontmatter and references. |
| `pnpm exec slides check .` | Validate content and run Svelte checks. |
| `pnpm exec slides iiif .` | Generate local image services, manifests and collections. |
| `pnpm exec slides thumbnails .` | Generate map previews and sharing images. |
| `pnpm exec slides build .` | Generate images and export a static site. |
| `pnpm exec slides preview .` | Serve the completed static build locally. |
| `pnpm exec slides cache purge . --dry-run` | List generated caches without deleting them. |

Use `pnpm exec slides --help` or `pnpm exec slides <command> --help` for options.

## Select a project

A path selects an independent site. An installed or workspace content package
name also works; its package manifest only needs to locate the directory.
With no content argument, the current directory is selected.

```sh
pnpm exec slides dev ../my-story --port 5174
pnpm exec slides build ../my-story --outDir ./public-site
pnpm exec slides build ../my-story --config ../my-story/alternate.config.yml
```

Configuration paths and assets are relative to the content directory.
CLI paths such as `--config`, `--cacheDir` and `--outDir` are relative to the
invoking working directory. Output defaults to `<content>/dist`.
Vite options such as `--port` pass through to `dev` and `preview`.

Use the same content directory, configuration, cache directory and deployment
settings when running generation, development and preview commands for a site.
Different sites can run at once on separate ports.

See [generation and cache options](generation.md) for IIIF flags, optional
generators and cache purging, and [deployment](deployment.md) for public URLs
and Linux rendering setup.
