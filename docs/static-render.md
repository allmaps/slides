# Static renderer reference

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
See [the input types](../packages/static-render/src/types.ts) and
[the native tests](../packages/static-render/tests/native.test.mjs) for a
self-contained basemap example. A plan contains:

- `version: 2` and `epoch`: a source-cache generation (normally a UTC day).
- `assets`: local service/data URLs mapped to paths relative to `assetRoot`.
- `layers`: normalized georeferenced maps and options, keyed by caller IDs.
- `jobs`: ordered layer IDs, camera, dimensions, output format and optional
  lower/upper MapLibre styles. No styles means a transparent background.
- `fonts`: optional caller IDs mapped to `{ family, base64? }` font inputs.
- `resources`: optional annotation JSON snapshots encoded as base64.

Jobs can add `textOverlay: { title, subtitle?, font?, textSize? }`. `font` references an
entry in `fonts`; omitted entries use the system sans-serif font. The optional
base64 is the content of a TTF/OTF file; omitting it selects an installed family.
For reproducible output, pass font bytes. The renderer ships no application
fonts or branding. For example:

```js
plan.fonts = {
  display: { family: "My Display Font", base64: fontBytes.toString("base64") },
};
plan.jobs[0].textOverlay = {
  title: "An atlas", subtitle: "A journey through time", font: "display",
  textSize: 76,
};
```

`textSize` sets the title size in pixels at 1200 × 630 (default `76`, greater
than zero and at most `512`). Other image dimensions scale it proportionally;
the subtitle uses 34/76 of the title size.
Text is rendered literally (markup is escaped), wraps and shrinks when needed,
and sits at the lower left with a soft dark halo for contrast. A separate composition
cache includes text, size and font contents; changing them does not redraw the map.
Jobs without `textOverlay` retain their original pixels. Sharp/Pango renders
text without a browser; the renderer provides a writable Fontconfig cache and
defaults to its fontconfig backend, so custom fonts work on macOS and Linux.
Explicit `FONTCONFIG_FILE` and `PANGOCAIRO_BACKEND` settings are respected.

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
are not used as the deployment origin. Local batches without an absolute public
URL use `http://localhost/`; explicit HTTP development URLs are also supported.
A rejected configured origin remains an error and does not fall back to localhost.

Workspace imports use TypeScript source; packed releases contain JavaScript
and type declarations.
The JS API is intended for a Node main process; use the CLI from worker-based
build systems. Slides invokes the CLI once per batch, then SvelteKit reads only
its manifest. Sharp and native dependency versions are pinned together.

The current dependency set needs no consumer Zod override. See
[package development](development.md#bundling-and-packing) for release checks.

## Linux setup

Thumbnail rendering uses native graphics libraries. These requirements come from
MapLibre Native/Chiitiler; installing Sharp alone does not provide them.
The package manager installs JavaScript packages and their native modules.
The build machine supplies Linux graphics libraries and a display.

For a source checkout on **Ubuntu 24.04**, run the shared setup script, then
render under Xvfb:

```sh
sudo sh packages/static-render/scripts/install-system-deps.sh
xvfb-run -a pnpm exec slides build ./content/slides-template
```

The script is intended for CI machines and Docker build stages. Other Linux
distributions need equivalent packages. If you use the npm package without this
checkout, put the dependency installation in your workflow or build image;
[the script](../packages/static-render/scripts/install-system-deps.sh) is the
canonical Ubuntu package list. The Slides npm package does not include that script.

`slides dev`, `slides validate` and `slides check` do not start native rendering.
Local IIIF generation uses Sharp and does not require Xvfb. To omit thumbnails,
set `thumbnails.enabled: false` or use `SLIDES_THUMBNAILS_ENABLED=false` for the build.
See [generation settings](generation.md) for the resulting behavior.

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
differ from WebGL triangulation. See [thumbnail generation](thumbnail-generation.md) for the full build flow.

### Warped-map option support

The following covers the options exposed by Allmaps render beta.84 / MapLibre
beta.44. Options can be supplied per map in `RenderLayer.maps[].options`;
`RenderLayer.effects` overrides the pixel effects for every map in that layer.

| Options | Applied by | Preview behavior |
| --- | --- | --- |
| `gcps`, `transformationType`, `internalProjection` | Allmaps renderer directly | Applied by Allmaps' buffer renderer. |
| `resourceMask`, `applyMask` | Allmaps renderer, with mask normalization | Applied, including option masks and full-image rendering when masking is disabled. |
| `visible`, `renderMaps` | Static renderer before rendering | A value of `false` omits the map raster. |
| `opacity`, `saturation` | Sharp raw-pixel pipeline | Applied to each map before composition. Saturation uses Allmaps' RGB luminance weights. |
| `removeColor`, `removeColorColor`, `removeColorThreshold`, `removeColorHardness` | Sharp raw-pixel pipeline | Removes the selected background using RGB distance and a smooth alpha cutoff; existing transparency is preserved. Defaults: `false`, `#222222`, `0.3`, `0.7`. |
| `colorize`, `colorizeColor` | Sharp raw-pixel pipeline | Additive colorization after saturation. Defaults: `false`, `#ff56ba`. |
| `projection` | Allmaps renderer directly (Web Mercator only) | Other output projections warn and fall back to Web Mercator; `internalProjection` remains configurable. |
| `distortionMeasure`, `distortionMeasures`, `distortionColor00/01/1/2/3`, `resourceResolution` | Neither (unsupported) | Warn and omit: these depend on WebGL's triangulation/distortion data. |
| `renderGcps`, `renderTransformedGcps`, `renderVectors`, `renderFullMask`, `renderMask`, `renderAppliedMask`, and their `Color`, `Size`, `BorderColor`, `BorderSize` settings | Neither (unsupported) | Warn and omit diagnostic geometry. Mask clipping itself is supported. |
| `renderLines`, `renderPoints`, `renderGrid`, `renderGridColor`, `debugTriangles`, `debugTiles` | Neither (unsupported) | Warn and omit diagnostic rendering. |
| `scaleFactorCorrection`, `log2ScaleFactorCorrection` | Neither (unsupported override) | Warn and use the static renderer's tile resolution selection. |
| `fetchFn`, `warpedMapFactory`, `warpedMapList` | Neither (unsupported override) | Warn and use the static renderer's source cache and map factory. Live objects/callbacks cannot be serialized in a JSON plan. |

Sharp handles image decoding and alpha composition. Its raw-pixel pipeline
implements the removal/saturation/colorization math instead of using Sharp's
HSL tint/saturation operations, which produce different colors. Effects run on
each warped map before it is placed over the basemap or other maps. This is a
static approximation of the WebGL appearance, especially at translucent edges.
Invalid effect colors also warn and skip that effect; other effects still apply.

Live scheduling/cache settings do not change a completed still and are ignored:
`anticipateVisibility`, `anticipateInteraction`, `animatedOptions`, `createRTree`,
`rtreeUpdatedOptions`, `batchFailureMode`, `overviewTilesSelection`,
`overviewTilesMaxResolution`, `requestViewportBufferRatio`,
`overviewRequestViewportBufferRatio`, `pruneViewportBufferRatio`,
`overviewPruneViewportBufferRatio`, `maxTotalOverviewResolutionRatio`,
`spritesMaxHigherLog2ScaleFactorDiff`, `spritesMaxLowerLog2ScaleFactorDiff`, and
MapLibre's `layerId`, `layerType`, `layerRenderingMode`.

Unsupported options (including unknown future options) warn once per map-entry
preparation, listing the source and skipped settings. Disabled flags do not warn.
Warnings do not prevent rendering, including when other supported effects are
present. Missing sources, invalid geometry and failed decoding still fail the
build. Slides' separate sprite-atlas input still requires IIIF sources instead.
