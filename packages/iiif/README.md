# @allmaps/iiif

Generate static IIIF image tiles, manifests and collections from local images.
The package also provides catalog readers and optional SvelteKit/Vite adapters.

This is a workspace package included in the `@allmaps/slides` release.
For a slideshow, use [`slides iiif`](../../docs/generation.md); no separate
package installation is needed.

## Use the image API

From another package in this workspace:

```ts
import { renderLocalIiifRequest } from '@allmaps/iiif/image';

const { bytes, type } = await renderLocalIiifRequest(
  '/content/assets/images/map.jpg',
  '0,0,512,512/256,256/0/default.jpg',
  'https://example.org/iiif/map',
);
```

This crops and resizes a local image without an HTTP server.
See the [API reference](../../docs/iiif.md) for supported requests,
batch generation, catalogs and cache behavior.

## Develop

Run from the repository root:

```sh
pnpm --filter @allmaps/iiif test
pnpm --filter @allmaps/iiif check
```
