# @allmaps/static-render

Render map scenes to image files in Node.js 24 or later.
A JSON render plan describes the camera, basemap, georeferenced maps and output
sizes. The renderer produces images and a result manifest without a browser.

This workspace package is included in `@allmaps/slides`.
For slideshow previews, use [`slides thumbnails`](../../docs/generation.md);
Slides prepares the render plan for you.

## Render a plan

From the repository root, with a prepared `plan.json`:

```sh
node packages/static-render/bin/render.mjs plan.json \
  --assets /path/to/content --cache /path/to/cache --output /path/to/output
```

See the [render plan reference](../../docs/static-render.md#api-and-cli) and
[self-contained native test](tests/native.test.mjs) for input examples.
Linux requires [system graphics libraries and Xvfb](../../docs/static-render.md#linux-setup).
A [Docker setup](../../docs/static-render.md#docker) is also available.

## Develop

Run from the repository root:

```sh
pnpm --filter @allmaps/static-render check
pnpm --filter @allmaps/static-render test
pnpm --filter @allmaps/static-render test:native
```

On headless Linux, prefix the native test with `xvfb-run -a`.
The [renderer reference](../../docs/static-render.md) covers supported effects,
caching and limitations; [thumbnail generation](../../docs/thumbnail-generation.md)
explains its integration with Slides.
