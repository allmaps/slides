# Build-time slide and map thumbnails

Implemented across the Slides app and shared packages, September 2026. The production build generates
thumbnails without a browser, DOM, or a running web server.

## Outputs

| Consumer         | Output                               | Appearance                                              |
| ---------------- | ------------------------------------ | ------------------------------------------------------- |
| Read more cards  | 540 × 400 WebP per slide and theme   | Complete map scene in light and dark styles             |
| Map layers panel | 256 × 256 WebP per map-entry variant | Transparent, north-up, fitted to the mask; no basemap   |
| Social metadata  | 1200 × 630 JPEG per slideshow route  | First slide, reframed at this aspect ratio, light theme |

A map-entry variant includes its URL, type, image crop, wiggle and renderer
options. An AnnotationPage with several maps produces one combined layer-row
preview. A panel thumbnail is never upscaled into a slide: warped maps render
again in the slide's shared viewport.

The layout serializes a small manifest with asset paths and dimensions.
`SlideshowPanel` selects the active theme; `SlideshowLayers` displays transparent
images using `object-fit: contain`. Missing previews retain the existing
placeholder. Open Graph and Twitter tags are included in prerendered HTML and
use absolute URLs derived from `PUBLIC_URL` and the app's base path.

## Package boundaries and build flow

`slides build` is orchestrated by `@allmaps/slides/build`:

1. The directory loader validates configuration and frontmatter and resolves a
   data-only project. `build/prepare.ts` converts it to a serializable scene
   plan and manifest template, without loading Vite or the Svelte application.
2. `@allmaps/static-render` runs once as a standalone batch CLI, outside Vite
   and SvelteKit workers. It accepts normalized maps, effects, styles and cameras.
3. Slides resolves the template against successful renderer results and
   atomically publishes the thumbnail manifest.
4. SvelteKit builds/prerenders the site. Its layout and thumbnail route read
   the manifest and files; neither starts native jobs.

`@allmaps/slides/model` owns schemas, project construction, reference validation,
defaults and shared map decisions. The app attaches compiled Markdown components
to the already-resolved project. The renderer owns its neutral camera and scene
contracts and does not depend on Slides.

`@allmaps/iiif/image` owns decoding, cropping, resizing, image dimensions and
pyramid scales. The renderer uses its local IIIF adapter to read originals;
static IIIF generation shares these primitives.

The planner uses symmetric thumbnail padding and processes each slideshow in
order, starting with its configured start scene. Partial camera and overlay
changes therefore have a deterministic predecessor. Explicit zoom retains its
MapLibre meaning; a social image has a wider viewport and sees more map.

## Rendering

The static renderer resolves local assets relative to a supplied root and
remote inputs through a persistent source cache. Allmaps `IntArrayRenderer`
renders warped overlays; Chiitiler renders the lower and upper style passes.
Sharp composites lower basemap, warped maps and upper labels/overlays before
final encoding. Slide and social images have no attribution banner.

The renderer has a JSON batch CLI, a Node API and a Docker image. Plans contain
relative local asset paths and can be moved with their content/source caches.
Sharp is pinned to the same version across the IIIF and native dependencies.
See [the renderer README](../packages/static-render/README.md) for commands and
[the Slides README](../packages/slides/README.md) for shared exports.

Both renderers receive the same center, zoom, bearing and pixel dimensions.
Allmaps' Mercator scale is `40075016.68557849 / (512 * 2 ** zoom)` and its
rotation is `-bearing * Math.PI / 180`. A native integration test checks the
projected location of three GeoJSON control points at a 37-degree bearing.

Rendering jobs run sequentially to bound native contexts and decoded tile
memory. Simultaneous requests for the same source or output are deduplicated.
Light and dark variants share warped overlays when their cameras match.
Fetch/decode failures abort the build instead of publishing partial renders.

## Separate persistent caches

Paths below are relative to `node_modules/.vite/slides` in the invoking
repository (or the directory selected by `--cacheDir`, with a `/slides` suffix).

| Directory | Contents |
| --- | --- |
| `annotations` | Remote georeference annotations and validators. |
| `thumbnails/sources` | IIIF, styles, TileJSON, tiles, glyphs and GeoJSON. |
| `thumbnails/native` | Native protocol cache. |
| `thumbnails/renders-v2` | Render passes and encoded results by recipe. |
| `thumbnails/assets` | Immutable images and annotation snapshots. |
| `projects/<project-key>/thumbnails` | Plan, template, result and last completed manifest. |

Annotations have their own cache directory and CI cache, so clearing expensive
raster outputs does not require downloading annotations again. Annotation
responses are parsed/validated before replacing a valid snapshot. The browser
uses the published annotation snapshot too, keeping its geometry in sync with
that build's previews.

Remote entries are fresh for the current UTC day. A later online build
revalidates using ETag/Last-Modified where available. A daily generation also
invalidates finished map rasters, ensuring a cached image cannot hide a changed
remote tile indefinitely. This is deliberately conservative: a new day may
rerender even when a provider's data is unchanged. Same-day unchanged builds
reuse finished images without tile fetches or native rendering.

Temporary network failures, HTTP 408, 429 and 5xx receive five attempts with delays
of 1, 2, 4 and 8 seconds, extended by `Retry-After` up to 30 seconds per delay.
Response-body interruptions are retried too. If retries are exhausted, the
source cache can supply its last successful response with a warning, once per
URL per batch. It retains the old epoch so later source requests revalidate it;
finished rasters still follow the daily generation rule above. Annotation
requests and forced refresh do not use stale responses. A missing cached copy,
authentication error, 404 or invalid annotation still fails the build.

Recipes include camera, size, ordered maps, effects, resolved styles, source
content/epoch and renderer/encoding versions. Annotation changes and local
image changes alter their content hashes. Prose/title edits do not affect
pixels. Writes use a temporary file and atomic rename. Failed requests and
failed render jobs are not cached as successful results.

The published route accepts only filenames present in the manifest. All URLs
contain a SHA-256 of the actual bytes. The route sends immutable cache headers;
static hosting ultimately controls response headers. Each build exports only
its referenced files, although the persistent build cache retains older
entries. Reset that cache periodically if its history grows too large.

When changing renderer behavior, bump the affected render recipe version in
`packages/static-render`. Dependency versions are pinned; CI includes
the lockfile digest in thumbnail cache keys.

## Running and refreshing

Normal builds generate thumbnails automatically:

```sh
PUBLIC_BASE_PATH=kattenburg-atlas pnpm exec slides build kattenburg-atlas
PUBLIC_BASE_PATH=kattenburg-atlas pnpm exec slides preview kattenburg-atlas
```

Use the same base-path setting for build and preview. Kattenburg's workflow sets
it to the repository name. `PUBLIC_URL` comes from its content configuration.
For Protomaps requests, the builder supplies that configured site's Origin and
Referer: Kattenburg's existing key rejects requests without its allowed origin.

| Environment variable              | Behavior                                                             |
| --------------------------------- | -------------------------------------------------------------------- |
| `SLIDES_THUMBNAILS_ENABLED=false` | Skip thumbnails and use UI placeholders                              |
| `SLIDES_THUMBNAILS_OFFLINE=true`  | Use the previous source generation; fail on missing remote resources |
| `SLIDES_THUMBNAILS_REFRESH=true`  | Revalidate remote snapshots and generate a fresh render generation   |
| `SLIDES_ANNOTATIONS_CACHE_ROOT`   | Override the separate annotation cache directory                     |
| `SLIDES_THUMBNAILS_CACHE_ROOT`    | Override the source/render/output cache directory                    |

Offline mode is for reproducing a complete cached snapshot. It does not make
the deployed interactive map offline: live basemap and IIIF requests remain
part of that application. Avoid combining offline and refresh modes.

Development reads the last successful manifest without starting native jobs.
Run `slides thumbnails <directory>` or a build to refresh previews after editing
map settings/content. A running server reloads when the completed manifest is
published. Ordinary content edits do not start native rendering.

## Kattenburg CI

`content/kattenburg-atlas/.github/workflows/deploy-pages.yml` restores and saves
three independent caches: IIIF derivatives, annotations, and thumbnails/map
sources. Cache snapshots use unique run/attempt keys with restore prefixes, so
newly generated files are saved even if a later build step fails. Only complete
source bodies and completed render jobs are cached. Manual workflow
inputs can independently skip restoring each cache.

The Pages workflow sets up Node 24 and pnpm, calls the renderer package's
shared Ubuntu dependency setup script, and runs `slides build` under Xvfb.
It uploads `dist/site` directly. No Docker image is built or run for Pages.

Container deployment has a separate `docker-publish.yml` workflow. Kattenburg's
single multi-stage Dockerfile obtains the Slides source, installs dependencies,
generates all derivatives and thumbnails, prerenders the site and produces an
Nginx serving image. Only public site files enter that final image. Its Nginx
configuration supports clean URLs for prerendered chapter HTML files.

The container build uses three BuildKit cache mounts and explicit Actions
cache import/export; ordinary image-layer caching alone does not persist cache
mounts on hosted runners. A daily `CACHE_EPOCH` build argument lets unchanged
content revalidate remote inputs. The renderer cache is namespaced by the
framework lockfile. See the content package README for build arguments and
local source overrides.

The optional renderer/build-tool image remains useful for standalone batches.
It shares `install-system-deps.sh` with the Pages and web-image builds. The
monorepo's `static-render.yml` workflow tests that tool image and native pixels.

## Validation and limits

Before this architecture migration, Kattenburg produced 35 light/dark slide pairs, 27 map-entry variants and six
social images: 103 images total. A warm batch reuses all images without native
rendering. The previous build layout's full Dockerfile was verified on Linux/amd64 with
empty source caches and on a second build that reused all 103 images and all
25 remote annotations. The direct Pages-style build was also verified using
cached remote resources in offline mode. The Nginx image serves chapter URLs,
thumbnails and IIIF metadata directly.

Tests cover shared content validation, ordering/references, camera fitting,
independent caches, ETag/304 handling, restart reuse, failed render recovery,
local IIIF pixels, exact projective inversion, changed originals and native alignment.

```sh
pnpm --filter @allmaps/slides --filter @allmaps/static-render \
  --filter @allmaps/iiif --filter @allmaps/slides-app test
pnpm --filter @allmaps/static-render test:native
# On Linux:
xvfb-run -a pnpm --filter @allmaps/static-render test:native
```

The supported scene is planar Web Mercator at pitch zero. Masks, transforms,
opacity, saturation, image regions, basemap themes and vector overlays are
handled. WebGL debug/effect modes (colorize, removeColor, mask/grid/GCP/vector
visualizations) and warped-map sprite atlases currently fail explicitly.
Buffer rendering may differ from WebGL triangulation on strongly distorted
maps. Projective maps preserve the authored forward transform used by the live
map and camera fitting. The renderer package's `StaticWarpedMap` computes its
exact matrix inverse and installs it through Allmaps' public transformation
APIs. Both tile selection and pixel sampling use that inverse, including masks,
rotation and explicit map-option overrides. No polynomial fallback is applied.
Singular projective transforms fail explicitly. Warped-layer and composition
recipe versions invalidate earlier results, including saved projective plans.
The regression fixture uses Kattenburg's Dilcher GCPs; offline pixel tests cover
full and cropped views at different bearings. Thin-plate splines and other
transformation types retain their existing Allmaps behavior.
Hosted static-map APIs remain an alternative if avoiding native build
dependencies becomes more important than rendering the app's own style.

The next renderer optimization to investigate is Allmaps `WasmRenderer`.
`IntArrayRenderer` is the verified initial backend; switching to WASM requires
format/initialization and visual compatibility tests, not just a constructor
replacement. See [Allmaps render](https://allmaps.org/docs/packages/render/),
[render-wasm](https://allmaps.org/docs/packages/render-wasm/) and
[Chiitiler](https://github.com/Kanahiro/chiitiler).
