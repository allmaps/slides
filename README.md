# Allmaps Slides

Application to create map stories using MapLibre, Protomaps and Allmaps.

## Inspired by

- [Reuzenarbeid](https://tu-delft-heritage.github.io/reuzenarbeid/)
- [City Atlas](https://cityatlas.theberlage.nl/)
- [Interactive Storytelling with MapLibre](https://github.com/digidem/maplibre-storymap/)

## Developing

This repository is a pnpm workspace:

- `apps/slides` contains the SvelteKit application.
- `content/gravity-at-sea` is the `@allmaps/gravity-at-sea` workspace package.
  It exports the Gravity at Sea markdown, config, and assets.
- `packages/cli` validates content and starts/builds the app.
- `packages/slides-content` is the stable app import target. The CLI aliases it
  to the selected content package when it starts the app.

The selected content package contains one project. Its `slides.config.yml` holds
the project metadata, slideshow definitions, sources, and application settings.

Install dependencies with `pnpm install`, start a development server:

```sh
pnpm run dev

# or start the server and open the app in a new browser tab
pnpm run dev -- --open
```

During development, the app imports content directly from
`@allmaps/slides-content`, a stable package name. The CLI resolves the selected
content package, aliases `@allmaps/slides-content` to that package's entry
point, watches the selected package root, and reports validation errors. It no
longer copies markdown or assets into the app.

The content package has a small entry point:

```txt
content/
  gravity-at-sea/
    package.json
    index.ts
    slides.config.yml
    slideshows/
    assets/
```

`content/gravity-at-sea/index.ts` exports Vite glob imports for the config,
markdown slides, and assets. Asset paths in markdown/frontmatter are resolved
relative to the content package root.

## Building

To create a production version of your app:

```sh
pnpm run build
```

You can preview the production build with `pnpm run preview`.

Use another config file by calling the CLI directly:

```sh
pnpm exec slides build @allmaps/gravity-at-sea --config content/gravity-at-sea/slides.production.yml
```

## Routing

The main slideshow is served at `/`. Other slideshows are served at
`/:slideshow`.

## Config

`content/gravity-at-sea/slides.config.yml` supports environment placeholders,
which is useful for GitHub Pages base paths and public API keys:

```yml
title: Gravity Expeditions at Sea
main: main
slideshows:
  - id: main
    path: slideshows/00-main

site:
  basePath: ${SLIDES_BASE_PATH}
  publicUrl: ${SLIDES_PUBLIC_URL}
protomaps:
  key: ${PUBLIC_PROTOMAPS_KEY}
```

Generated folders such as `apps/slides/build` and SvelteKit/Vite caches are
ignored by git.
