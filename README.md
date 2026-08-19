# Allmaps Slides

Application to create map stories using MapLibre, Protomaps and Allmaps.

## Inspired by

- [Reuzenarbeid](https://tu-delft-heritage.github.io/reuzenarbeid/)
- [City Atlas](https://cityatlas.theberlage.nl/)
- [Interactive Storytelling with MapLibre](https://github.com/digidem/maplibre-storymap/)

## Developing

This app uses [SvelteKit](https://svelte.dev/tutorial/kit/introducing-sveltekit) as application framework.

Install dependencies with `pnpm install`, start a development server:

```sh
pnpm run dev

# or start the server and open the app in a new browser tab
pnpm run dev -- --open
```

## Building

To create a production version of your app:

```sh
pnpm run build
```

You can preview the production build with `pnpm run preview`.

## Routing

By default, the root route shows a project overview, project main slideshows are
served at `/:project`, and subslideshows are served at `/:project/:slideshow`.

For a build with exactly one project, set
`PUBLIC_SLIDES_SINGLE_PROJECT_ROOT=true` to publish that project at the root
instead. In that mode, the main slideshow is served at `/` and subslideshows are
served at `/:slideshow`.
