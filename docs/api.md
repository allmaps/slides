# Slides JavaScript API

Most projects only need the [CLI](commands.md). These exports let other Node
applications load content, run builds or integrate the included viewer.

## Module boundaries

| Export | Purpose |
| --- | --- |
| `/model` and `/model/*` | Schemas, data-only project and shared map decisions; no file watching or native startup. |
| `/content` | Discover and validate a content directory. |
| `/build` | `loadSlidesConfig`, `buildSite`, `runSite`, `buildThumbnails`. |
| `/build/catalog` | Read completed thumbnail manifests. |
| `/vite` | `slidesContent()` and `iiifImageAssets()` adapters for the included application. |
| `/server/iiif` | Prepared IIIF catalogs, routes, overview and annotation image resolution. |
| `/canvas-panel` | Svelte IIIF canvas component and its prop types. |

```js
import { loadSlidesConfig, buildSite } from '@allmaps/slides/build';
import { loadContent } from '@allmaps/slides/content';

const config = await loadSlidesConfig({ content: './my-story' });
const content = await loadContent(config);
console.log(content.project.title);
await buildSite({ content: './my-story', outDir: './public-site' });
```

Browser code should import the model entry points, keeping Node-only build
dependencies outside the client graph. Workspace exports point to source;
release exports point to compiled JavaScript and declarations. The IIIF and
renderer implementations are bundled into this package. Canvas components ship
as preprocessed Svelte files for the application's compiler. No separate
installation or publication of these workspace packages is needed.

The renderer runs through its own bundled entry in a separate Node process.
The app imports IIIF behavior from ordinary server modules; the Vite virtual
module supplies only configuration data. Application sources are included because
each presentation's Markdown is compiled when `slides build` runs.
