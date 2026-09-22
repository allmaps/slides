# @allmaps/iiif

IIIF generation with optional SvelteKit/Vite adapters. Node consumers can reuse
the image primitives without importing the framework integration.

| Export   | Responsibility                                                                                              |
| -------- | ----------------------------------------------------------------------------------------------------------- |
| `/image` | Image dimensions, pyramid scale factors, Sharp decode/crop/resize pipeline and local IIIF request rendering |
| `/core`  | Static Image API derivatives, Presentation manifests and collections                                        |
| `/catalog` | Write and read explicit catalogs of prepared public assets |
| `/vite`  | `?iiif` imports and build catalog integration                                                               |
| `/route` | SvelteKit route adapter                                                                                     |

## Explicit generation and serving

The framework-independent API prepares derivatives and returns an allowlist of
public requests mapped to files. It needs no virtual module or Slides config:

```js
import { buildStaticIiif, parseIiifOptions } from '@allmaps/iiif';
import { writeIiifCatalog, readIiifCatalog } from '@allmaps/iiif/catalog';

const options = parseIiifOptions('https://example.org/story', {}, {
  inputRoot: './assets/images',
  outputRoot: './node_modules/.vite/my-iiif/publication',
});
const result = await buildStaticIiif(options, {
  cacheRoot: './node_modules/.vite/my-iiif/pixels',
});
await writeIiifCatalog('./node_modules/.vite/my-iiif/catalog.json', result);
const catalog = readIiifCatalog('./node_modules/.vite/my-iiif/catalog.json');
const response = await catalog.get('ship/info.json');
```

Run generation before serving or prerendering. `catalog.entries()` supplies
the list of `{ request }` route parameters. Serving a prepared catalog never
starts image processing. A caller can instead copy the returned `assets` into
its own static output tree.

Paths relative to the image root become stable public IDs. Hashes are private
cache keys, computed from source bytes, options and image-library versions.
Identical pixels can be shared across publications with different public URLs;
metadata is generated for the selected URL. Even a same-size source replacement
invalidates pixels. Removed files cease to be listed, and arbitrary cached files
cannot be requested through the catalog. Publish a new catalog only after a
successful batch. For concurrent publications, use separate output directories
and a shared pixel cache.

Because these public URLs are stable, configure static hosting to revalidate
them rather than cache them as immutable. The catalog response supplies CORS
and `Cache-Control: no-cache`; static hosts must apply their own header rules.

The optional `iiifImageAssets()` Vite plugin handles `?iiif` image metadata
imports. Its options are explicit. The legacy convenience catalog plugin is
also available with an explicit `sourceModule`, but is not required by Slides
or by this API.

## Local images without an HTTP server

```ts
import { renderLocalIiifRequest } from "@allmaps/iiif/image";

const { bytes, type } = await renderLocalIiifRequest(
  "/content/assets/images/map.jpg",
  "0,0,512,512/256,256/0/default.jpg",
  "https://example.org/iiif/map",
);
```

The helper accepts `info.json`, full or pixel regions, `max`/`full` or explicit
width/height sizes, rotation zero and default JPEG. It validates bounds and
rejects upscaling and unsupported requests. Metadata declares this supported
subset. It is an internal image adapter, not a general-purpose IIIF server.

The static renderer maps local service URLs to originals and calls this helper.
It shares decoding/resizing and scale-factor calculations with the static
catalog generator. Static pyramid generation still decodes/resizes each level
once before cropping its tiles. Sharp is pinned to the same version as the
native renderer, avoiding multiple native image-library versions in a process.

```sh
pnpm --filter @allmaps/iiif test
pnpm --filter @allmaps/iiif check
```
