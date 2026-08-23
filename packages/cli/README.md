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

### Options

| Option | Default | Description |
| --- | --- | --- |
| `--force`, `-f` | off | Recreate existing image derivatives instead of skipping current ones. |
| `--id <uri>` | `PUBLIC_URL/iiif` | Public IIIF base URI used in `info.json`, manifests, and collection IDs. |
| `--input <path>` | `iiif.input` or `apps/slides/static/images` | Source image folder to scan recursively. |
| `--output <path>` | `iiif.output` or `apps/slides/static/iiif` | Output folder for IIIF derivatives and JSON files. |
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

- Full-image fixed sizes are generated under `full/<width>,<height>/0/default.jpg`
  and, when WebP is enabled, `default.webp`.
- The original image is generated under `full/max/0/default.jpg`.
- Tile pyramid outputs use explicit region folders such as
  `0,0,6335,2395/792,300/0/default.jpg`.
- `info.json` includes `tiles.width`, `tiles.height`, `sizes`, and, when WebP is
  enabled, `extraFormats` and `preferredFormats`.
- WebP has a maximum supported dimension. Oversized WebP derivatives are skipped
  per file, while supported fixed sizes and tiles are still generated as WebP.

### Performance

The generator renders each fixed size and each pyramid scale once per image,
then crops tiles from those rendered levels. This avoids repeatedly decoding and
resizing the original source image for every tile.
