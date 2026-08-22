# Allmaps Slides

Application to create map stories using MapLibre, Protomaps and Allmaps.

## Inspired by

- [Reuzenarbeid](https://tu-delft-heritage.github.io/reuzenarbeid/)
- [City Atlas](https://cityatlas.theberlage.nl/)
- [Interactive Storytelling with MapLibre](https://github.com/digidem/maplibre-storymap/)

## Developing

This repository is a pnpm workspace:

- `apps/slides` contains the SvelteKit application.
- `content` is the `@allmaps/slides-content` workspace package. It contains
  one or more story-map projects and exports their markdown, config, and assets.
- `packages/cli` validates content and starts/builds the app.

The root `slides.config.yml` tells the CLI which public settings to pass to
SvelteKit. The content itself is resolved through the
`@allmaps/slides-content` workspace package, the same package imported by the
app.

Install dependencies with `pnpm install`, start a development server:

```sh
pnpm run dev

# or start the server and open the app in a new browser tab
pnpm run dev -- --open
```

During development, the app imports content directly from
`@allmaps/slides-content`. The CLI resolves and watches that same package and
reports validation errors, but it no longer copies markdown or assets into the
app.

The content package has a small entry point:

```txt
content/
  package.json
  index.ts
  gravity-at-sea/
    project.yml
    slideshows/
    assets/
```

`content/index.ts` exports Vite glob imports for project config, markdown slides,
and project assets. Asset paths in markdown/frontmatter are resolved relative to
the current project folder.

## Building

To create a production version of your app:

```sh
pnpm run build
```

You can preview the production build with `pnpm run preview`.

Use another config file by calling the CLI directly:

```sh
pnpm exec slides build --config slides.production.yml
```

## Routing

By default, the root route shows a project overview, project main slideshows are
served at `/:project`, and subslideshows are served at `/:project/:slideshow`.

For a build with exactly one project, set
`routing.singleProjectRoot: true` in the config to publish that project at the
root instead. In that mode, the main slideshow is served at `/` and
subslideshows are served at `/:slideshow`.

## Config

`slides.config.yml` supports environment placeholders, which is useful for
GitHub Pages base paths and public API keys:

```yml
site:
  basePath: ${SLIDES_BASE_PATH}
  publicUrl: ${SLIDES_PUBLIC_URL}
routing:
  singleProjectRoot: false
protomaps:
  key: ${PUBLIC_PROTOMAPS_KEY}
```

Generated folders such as `apps/slides/build` and SvelteKit/Vite caches are
ignored by git.
