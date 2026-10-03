# CLI commands

Use Node.js 24 or later. For source checkouts or local release archives, see
[development](development.md).

## Create a project

Run this before installing dependencies in the new folder:

```sh
pnpm dlx @allmaps/slides@beta init my-story
cd my-story
pnpm install
pnpm dev
```

If the CLI is already installed, use `pnpm exec slides init my-story`.
`slides create` is an alias. Omitting the directory initializes the current
folder; relative paths are resolved from your terminal's working directory.

In a terminal, `init` asks for a title and an optional Protomaps API key. Press
Enter to use "My narrative map" and leave the key empty. Both can be changed
later in `slides.config.yml`. The key prompt links to [protomaps.com/api](https://protomaps.com/api)
and explains that the key is included in the public website.

Use `--title` and `--protomaps-key` to supply either answer directly. `--yes`
(or `-y`) skips all prompts and uses defaults for omitted values:

```sh
pnpm exec slides init my-story --yes --title "My narrative map"
```

Piped and other non-interactive runs also use defaults without prompting.
Ctrl+C cancels an interactive setup before files are created.

The command creates `slides.config.yml`, `chapters/01-welcome.md`, `package.json`,
`pnpm-workspace.yaml`, `.gitignore` and a short `README.md`. If you skip the key,
the config includes `protomaps.key: ""` and the starter uses a plain background;
no `map` block is needed. The Slides dependency is pinned to the version running
the command. The pnpm settings keep the project
independent of parent workspaces and allow the native dependencies to build.

No dependencies are installed by `init`. Existing starter filenames, alternative
Slides config files or a `chapters` directory cause it to stop before writing.
Unrelated files, including an existing `.git` directory, are left in place.
Choose a license for your own content; the command does not assign one.

## Work on a project

The following examples run from a content directory containing `slides.config.yml`.

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
