# Slides CLI

The CLI is the boundary between reusable app code and editable story content. It
loads a Slides config file, validates project folders, sets the public
environment variables expected by SvelteKit, and then runs the app package.

## Commands

```sh
slides dev @allmaps/gravity-at-sea
slides build @allmaps/gravity-at-sea
slides preview @allmaps/gravity-at-sea
slides check @allmaps/gravity-at-sea
slides validate @allmaps/gravity-at-sea
```

`slides dev` resolves the named content package, reads `slides.config.yml` from
that package root, watches that resolved package root, and reports validation
errors. The app imports markdown, config, and assets through the stable
`@allmaps/slides-content` import, which the CLI aliases to the selected package
when it runs SvelteKit.

Each content package must contain a named `package.json` and an exported entry
point that provides the content globs consumed by the app; the Gravity package uses
`content/gravity-at-sea/index.ts`.

`--config <path>` can still override the config file. Without `--config`, the
CLI looks for `slides.config.yml`, `slides.config.yaml`, or `slides.config.json`
in the selected package root.

## Config

The config file can be YAML or JSON. Paths are resolved relative to the config
file.

```yml
site:
  basePath: ${SLIDES_BASE_PATH}
  publicUrl: ${SLIDES_PUBLIC_URL}

routing:
  singleProjectRoot: false

protomaps:
  key: ${PUBLIC_PROTOMAPS_KEY}
```

Useful fields:

| Field | Default | Description |
| --- | --- | --- |
| `app.directory` | workspace `apps/slides` | SvelteKit app directory. |
| `site.basePath` | empty | SvelteKit base path, for example `/kattenburg-atlas`. |
| `site.publicUrl` | `site.basePath` | Absolute public URL used by commands that need IDs. |
| `routing.singleProjectRoot` | `false` | Publish the only project at `/` instead of `/:project`. |
| `protomaps.key` | empty | Public Protomaps key passed to the app. |
| `iiif.enabled` | `true` | Generate and serve IIIF derivatives. |
| `iiif.input` | `assets/images` | Source image root for manual IIIF generation and imported image paths. |
| `iiif.output` | `static/iiif` | Output folder used by the manual `slides iiif` command. |
| `iiif.id` | `PUBLIC_URL/iiif` | Public IIIF base URI used in generated metadata. |
| `iiif.sizes` | `true` | Generate fixed-size full-image derivatives and advertise them in `info.json`. |
| `iiif.tiles` | `true` | Generate tile pyramid derivatives and advertise them in `info.json`. |
| `iiif.tileSize` | `1024` | Tile width and height. |
| `iiif.webp` | `true` | Generate and advertise WebP derivatives. |

Environment placeholders such as `${PUBLIC_PROTOMAPS_KEY}` are expanded before
the config is applied.

## `slides iiif`

Build static IIIF Image API level 0 derivatives, IIIF Presentation manifests,
and a root IIIF collection from a configured image directory.

Run it with:

```sh
slides iiif @allmaps/gravity-at-sea
```

or through the workspace script:

```sh
pnpm iiif
```

The script writes output to `static/iiif` by default. Each image gets its own
IIIF Image API folder named after the source filename without the extension.
Each source subfolder gets a `manifest.json`, and `static/iiif/collection.json`
lists those manifests.

During `slides dev` and `slides build`, the Slides app also loads the IIIF
generator as a Vite plugin. Content packages can expose lazy `?iiif` imports
from their image assets; the plugin uses those imports as the app's IIIF source
list, caches derivatives in `.svelte-kit/iiif`, and prerenders stable static
files under the app's `/iiif` route. The configured `iiif.input` folder is used
as the root for deriving stable IIIF paths from those imports. This uses the
same generator as the CLI command; the route output is written by SvelteKit
rather than directly to `iiif.output`.

### Options

| Option | Default | Description |
| --- | --- | --- |
| `--force`, `-f` | off | Recreate existing image derivatives instead of skipping current ones. |
| `--id <uri>` | `PUBLIC_URL/iiif` | Public IIIF base URI used in `info.json`, manifests, and collection IDs. |
| `--input <path>` | `iiif.input` or `assets/images` | Source image folder to scan recursively. |
| `--output <path>` | `iiif.output` or `static/iiif` | Output folder for IIIF derivatives and JSON files. |
| `--sizes` / `--no-sizes` | `iiif.sizes` | Generate or skip fixed-size full-image derivatives. |
| `--tiles` / `--no-tiles` | `iiif.tiles` | Generate or skip tile pyramid derivatives. |
| `--tile-size <pixels>` | `1024` | Tile width and height used for the image pyramid. |
| `--webp` | on | Generate WebP derivatives alongside JPEG and advertise WebP in `info.json`. |
| `--no-webp` | off | Generate JPEG derivatives only and omit WebP properties from `info.json`. |
| `--help`, `-h` | off | Print the CLI help text. |

`PUBLIC_URL` is set from the Slides config. If no public URL is configured, IDs
are rooted at `/iiif`.

### Examples

Regenerate everything, including WebP:

```sh
slides iiif --force
```

Generate JPEG-only derivatives:

```sh
slides iiif --no-webp
```

Use a deployment URL for all IIIF IDs:

```sh
slides iiif @allmaps/gravity-at-sea --force
```

Write to a temporary output folder:

```sh
slides iiif --input static/images/maps --output /tmp/gravity-iiif-maps
```

### Output Notes

- The original image is generated under `full/max/0/default.jpg`.
- When `sizes` is enabled, fixed sizes are generated under
  `full/<width>,<height>/0/default.jpg` and, when WebP is enabled,
  `default.webp`.
- Tile pyramid outputs use explicit region folders such as
  `0,0,6335,2395/792,300/0/default.jpg`.
- `info.json` includes `tiles.width` and `tiles.height` when `tiles` is enabled,
  `sizes` when `sizes` is enabled, and, when WebP is enabled, `extraFormats`
  and `preferredFormats`.
- WebP has a maximum supported dimension. Oversized WebP derivatives are skipped
  per file, while supported fixed sizes and tiles are still generated as WebP.

### Performance

The generator renders each fixed size and each pyramid scale once per image,
then crops tiles from those rendered levels. This avoids repeatedly decoding and
resizing the original source image for every tile.
