# Build and deploy a slideshow

Allmaps Slides exports a static site. Set its public URL and, if needed, a
path prefix in `slides.config.yml`:

```yaml
site:
  publicUrl: https://example.org/story/
  basePath: /story
```

Use an empty `basePath` for a site served at the domain root.
`publicUrl` includes the path prefix; it supplies canonical, sharing and IIIF URLs.
You can override these at build time with `PUBLIC_URL` and `PUBLIC_BASE_PATH`.

## Build

From the content directory:

```sh
pnpm exec slides validate .
pnpm exec slides build .
pnpm exec slides preview .
```

Builds generate thumbnails and local IIIF derivatives before exporting the app
to `dist/`. Upload that directory to a static host. Configure the host to serve
prerendered HTML for clean slideshow URLs, such as `/history`, including on direct
navigation. Public URL and base-path changes require a new build.

On Linux, thumbnail rendering needs system graphics libraries and Xvfb.
Follow [renderer setup](static-render.md#linux-setup) on the build machine.
The deployed site needs no Node server or native graphics libraries.
The package manager installs npm dependencies, including Sharp, normally.

Generated sites include software license notices under `licenses/`. Provide
access to the corresponding application source for the version you distribute;
see [licensing and source distribution](licensing.md#distributing-a-site).

## Workflows and headers

The existing content repositories provide source-checkout workflow examples:
[Gravity at Sea](https://github.com/tu-delft-heritage/gravity-expeditions-app/blob/main/.github/workflows/deploy-pages.yml),
[Reuzenarbeid](https://github.com/tu-delft-heritage/reuzenarbeid/blob/main/.github/workflows/deploy-pages.yml)
and [Kattenburg Atlas](https://github.com/amsterdamtimemachine/kattenburg-atlas/blob/main/.github/workflows/deploy-pages.yml).
They install renderer system dependencies and run the build under Xvfb.
The [template](https://github.com/allmaps/slides-template) does not configure deployment.

Kattenburg also has a Docker build that serves the exported site with Nginx;
see its [deployment guide](https://github.com/amsterdamtimemachine/kattenburg-atlas/blob/main/docs/deployment.md).

Local IIIF URLs stay stable when source images change. Configure your host to
revalidate those responses instead of marking them immutable, and allow CORS
if other sites will use the images. Thumbnail filenames are content hashes and
can use immutable caching. Static hosts apply their own response-header rules.

## Search metadata

Each slideshow's prerendered HTML includes a canonical URL, social metadata,
and schema.org JSON-LD describing a `WebPage` and its
`PresentationDigitalDocument`. The presentation's `hasPart` entries describe
the chapters as `CreativeWork` sections, with titles, available descriptions,
one-based positions, and links to their HTML anchors. Subslideshows also include
a `BreadcrumbList` back to the project. Metadata updates on client navigation.

URLs use the complete `site.publicUrl` (or the build-time `PUBLIC_URL` override),
including its subpath. For example, `https://example.org/atlas/` produces
`https://example.org/atlas/history` for the `history` slideshow. A trailing slash
on the configured URL is optional. These remain deployment URLs when previewing
on localhost, even if the local router runs at `/`. Set `PUBLIC_URL` to the local
server URL to explicitly preview local metadata instead. `PUBLIC_BASE_PATH`
controls where the app itself is served; it does not change the metadata URL.
An absolute HTTP(S) public URL is required for canonical links and JSON-LD. Description fallback rules are documented in
[configuration](configuration.md#overall-titles-descriptions-and-sharing-images). Existing
social thumbnails are reused; no additional rendering is needed.

The contents menu is included in the initial HTML, including collapsed entries,
and chapter navigation uses ordinary links with descriptive text. This helps
crawlers discover the same sections readers can open.

Google [chooses sitelinks automatically](https://developers.google.com/search/docs/appearance/sitelinks);
this markup cannot guarantee a chapter overview in a search result. Its
[ItemList carousels](https://developers.google.com/search/docs/appearance/structured-data/carousel)
support specific content types, not general slideshows. The
[schema.org validator](https://validator.schema.org/) can check the full graph;
Google's [Rich Results Test](https://search.google.com/test/rich-results) checks
only Google-supported features, such as breadcrumbs. After deployment, use
Search Console URL Inspection to check the indexed page and request recrawling.
