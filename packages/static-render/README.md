# @allmaps/static-render

A Node 24 batch renderer for map scenes. It consumes a serializable
`RenderPlan`, uses Chiitiler/MapLibre Native for basemaps and Allmaps
`IntArrayRenderer` for warped maps, and publishes immutable image files plus a
result manifest. It needs no DOM, SvelteKit server or custom native worker.

## API and CLI

`renderBatch(plan, {assetRoot, cacheRoot, outputRoot, offline})` returns
`{images, resources}`. `images` maps job IDs to `{path, width, height}`; paths
are SHA-256 filenames relative to `outputRoot`. Resources are immutable JSON
snapshots. The CLI writes this result only after the entire batch succeeds.

```sh
node packages/static-render/bin/render.mjs plan.json \
  --assets /path/to/content --cache /path/to/cache --output /path/to/output
```

The CLI also accepts `--result /path/to/result.json` and `--offline`.
See `src/types.ts` for the input contract and `tests/native.test.mjs` for a
self-contained basemap example. A plan contains:

- `version: 2` and `epoch`: a source-cache generation (normally a UTC day).
- `assets`: local service/data URLs mapped to paths relative to `assetRoot`.
- `layers`: normalized georeferenced maps and options, keyed by caller IDs.
- `jobs`: ordered layer IDs, camera, dimensions, output format and optional
  lower/upper MapLibre styles. No styles means a transparent background.
- `resources`: optional annotation JSON snapshots encoded as base64.

`createSourceContext` resolves local IIIF images and remote resources. Annotation
loading and application-specific map/style decisions belong to the caller;
Slides prepares them in `@allmaps/slides/build`. The renderer has no dependency
on the Slides model or SvelteKit. Plans may contain provider keys in style URLs:
keep them in the private build cache, not the published site.

Render recipes include geometry, camera, styles, options, source generations,
local image contents and renderer versions. A saved plan retains its remote
source generation; prepare a new plan to refresh remote content. `--offline`
requires a complete source snapshot and fails on missing inputs.

Online source requests retry temporary network errors, HTTP 408, 429 and 5xx up to
five times, with exponential backoff and a bounded `Retry-After` delay. If a
source remains unavailable, a previously cached copy can be used with a warning
for that batch. Its cache epoch is not advanced; a later source request can
revalidate it. Annotation fetching and forced refresh remain strict, as do
authentication errors, missing resources and cold-cache failures. The public
URL in the plan supplies Protomaps' Origin/Referer headers; CI runner hostnames
are not used as the deployment origin.

Workspace imports use TypeScript source; packed releases contain JavaScript
and type declarations.
The JS API is intended for a Node main process; use the CLI from worker-based
build systems. Slides invokes the CLI once per batch, then SvelteKit reads only
its manifest. Sharp and native dependency versions are pinned together.

The current upstream Allmaps annotation package requires a temporary consumer
Zod 4.4.3 override; see [installation notes](../slides/README.md). The workspace
lockfile already selects that compatible version.

## Docker

Build from the monorepo root; Linux AMD64 is the verified target:

```sh
docker build --platform linux/amd64 --target renderer \
  -f packages/static-render/Dockerfile -t allmaps-static-render .
mkdir -p render-cache render-output
docker run --rm --platform linux/amd64 \
  -v "$PWD/plan.json:/input/plan.json:ro" \
  -v "$PWD/content/kattenburg-atlas:/input/assets:ro" \
  -v "$PWD/render-cache:/cache" -v "$PWD/render-output:/output" \
  allmaps-static-render node /workspace/packages/static-render/bin/render.mjs \
  /input/plan.json --assets /input/assets --cache /cache --output /output
```

The entrypoint runs Xvfb under Tini so startup signals and child processes work
correctly inside a container. System graphics libraries, native modules and tests
are part of the image, not deployment shell commands. Tests include actual
rendered pixels at a nonzero bearing.

The optional `slides-build` target adds the app and CLI. Content stays outside
the image and is discovered when mounted:

```sh
docker build --platform linux/amd64 --target slides-build \
  -f packages/static-render/Dockerfile -t slides-build:local .
mkdir -p .render-cache dist
docker run --rm --platform linux/amd64 -e PUBLIC_BASE_PATH=kattenburg-atlas \
  -e SLIDES_BUILD_OUTPUT=/output/site \
  -v "$PWD/content:/workspace/content:ro" \
  -v "$PWD/.render-cache:/workspace/node_modules/.vite/slides" \
  -v "$PWD/dist:/output" \
  slides-build:local pnpm exec slides build ./content/kattenburg-atlas --outDir /output/site
```

The static site appears in `dist/site`. Mount its parent directory:
SvelteKit deletes and recreates the configured output directory during export.

This is an optional build-tool image. Kattenburg's ready-to-serve web image is
built separately by `content/kattenburg-atlas/Dockerfile`: that single Dockerfile
builds the app and copies the complete static output into Nginx.

Kattenburg's GitHub Pages workflow runs Node/pnpm directly. It calls
`sudo sh packages/static-render/scripts/install-system-deps.sh` on Ubuntu 24.04,
then runs the normal build under `xvfb-run -a`. The same dependency script is
used by both Dockerfiles, keeping the native library list in this package.

## Checks

```sh
pnpm --filter @allmaps/static-render check
pnpm --filter @allmaps/static-render test
pnpm --filter @allmaps/static-render test:native
# Linux without the container entrypoint:
xvfb-run -a pnpm --filter @allmaps/static-render test:native
```

Rendering is planar Web Mercator, pitch zero. Projective annotations/options
retain the live map's forward homography. `StaticWarpedMap` supplies its exact
matrix inverse through Allmaps' public transformation APIs for tile selection
and pixel sampling, avoiding an independently fitted reverse transform. No
polynomial substitution or additional native dependency is needed. Singular
projective transforms fail explicitly. Other nonlinear transforms may still
differ from WebGL triangulation. Unsupported debug/color effects and sprite atlases fail
explicitly. See `../../docs/thumbnail-generation.md` for the full build flow.
