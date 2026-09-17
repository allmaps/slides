# @allmaps/sveltekit-iiif

IIIF generation with optional SvelteKit/Vite adapters. Node consumers can reuse
the image primitives without importing the framework integration.

| Export   | Responsibility                                                                                              |
| -------- | ----------------------------------------------------------------------------------------------------------- |
| `/image` | Image dimensions, pyramid scale factors, Sharp decode/crop/resize pipeline and local IIIF request rendering |
| `/core`  | Static Image API derivatives, Presentation manifests and collections                                        |
| `/vite`  | `?iiif` imports and build catalog integration                                                               |
| `/route` | SvelteKit route adapter                                                                                     |

## Local images without an HTTP server

```ts
import { renderLocalIiifRequest } from "@allmaps/sveltekit-iiif/image";

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
pnpm --filter @allmaps/sveltekit-iiif test
pnpm --filter @allmaps/sveltekit-iiif check
```
