# Images and captions

Use Markdown images for simple captions or HTML figures for IIIF images,
rich captions and zoomable details. Put local source images in
`assets/images/` and run `pnpm exec slides iiif .` before previewing them.
See [generation](generation.md) for refresh commands and options.

## IIIF figures

Use ordinary HTML figures in Markdown; no component imports are needed. For an
Image API service, use `data-image` with its base URL or `info.json` URL:

```md
<figure data-image="https://example.org/iiif/ship"
  aria-label="A ship on the slipway">

<figcaption>

*Launching a ship*, circa 1900. Collection of
[Het Scheepvaartmuseum](https://www.hetscheepvaartmuseum.nl/collectie).

</figcaption>
</figure>
```

For a Presentation API 2 or 3 manifest, use `data-manifest`. The **first canvas**
is used unless `data-canvas` supplies a canvas ID from that manifest:

```md
<figure data-manifest="https://example.org/manifest.json"
  data-canvas="https://example.org/canvas/2" aria-label="A ship on the slipway">

<figcaption>

*Launching a ship*. [Source institution](https://example.org/object/123).

</figcaption>
</figure>
```

IIIF figures contain the caption and source attributes; do not add a second
Markdown image. Atlas loads the image directly, without a separate fallback or
generated `srcset`. Use `aria-label` on the figure to describe the image (or the
caption is used). Keep blank lines around Markdown inside HTML, and do
not indent it by four spaces. Captions support links, emphasis and paragraphs.
Prefer institution object-record links and retain attribution and rights.

## Local and external images

For **local derivatives**, a standalone Markdown image is enough. Its relative
asset path resolves to the existing local IIIF service, and its alt text supplies
the label and caption:

```md
![A ship on the slipway](assets/images/ship.jpg)
```

Use a figure for a rich caption:

```md
<figure data-image="assets/images/ship.jpg" aria-label="A ship on the slipway">

<figcaption>

*Launching a ship*. [Source institution](https://example.org/object/123).

</figcaption>
</figure>
```

External IIIF resources require a figure with `data-image` or `data-manifest`.
An ordinary external Markdown image stays an `<img>` with its alt text as the
caption; its URL does not automatically activate the viewer. Images inside a
sentence remain inline. IIIF `info.json` URLs belong in `data-image`, not Markdown
image markup. Unrotated Image API request URLs, including rectangular crops,
are also accepted in `data-image`.

## Image regions

Append a standard `#xywh=x,y,width,height` fragment to `data-image` to crop the
preview and set the modal's opening view. Coordinates refer to the original
image, not its preview size. For example, this selects the photograph within its
card mount in the Pantserplaten slide:

```md
<figure data-image="https://dlc.services/iiif-img/v3/7/6/1e430d74-d9e8-4073-ba9b-438ac4d0988c#xywh=1718,1276,5820,4409"
  aria-label="Railway bridge">

<figcaption>

Piet Oosterhuis, 1875. [TU Delft Library](https://heritage.tudelft.nl/nl/objects/trg-9301-c-01).

</figcaption>
</figure>
```

You can also set `data-region="1700,1200,5900,4550"` on the figure. This takes
precedence over a URL fragment. `percent:10,20,60,50` specifies percentages;
Image API request URLs with `/x,y,width,height/…` or `/pct:x,y,width,height/…`
also supply the region automatically when used in `data-image`.

For local derivatives, use e.g. `data-image="assets/images/ship.jpg"` with
`data-region="100,200,800,600"`. Atlas composes the crop from the available
level 0 tiles; no new crop derivatives are needed. With Presentation manifests,
use `data-canvas="https://example.org/canvas/2#xywh=100,200,800,600"` or put
the fragment on `data-manifest` for the first canvas. These coordinates refer to
the canvas. Regions extending past the image edge are clipped; empty or invalid
regions report a loading error with a retry button.

Use `data-rotation="90"` on a figure for clockwise rotation. Region coordinates
still refer to the original, unrotated image.

Remote IIIF services must allow browser requests with CORS. Their pixels and
metadata load in the browser; the build does not copy them into your project.
IIIF images need JavaScript, while authored captions remain available without it.
Unsupported or unavailable images show an error with a retry button.

The viewer supports painting images and rectangular canvas placement.
Painting-annotation source crop selectors, nonrectangular targets and audiovisual
playback are not supported. See [interface behavior](interface.md#image-viewer)
for loading and keyboard controls.

## Relative image references in annotations

With IIIF enabled, an annotation’s image service `id` can reference an image
relative to the **content root**, for example in `target.source`:

```json
{
  "id": "assets/images/map.jpg",
  "type": "ImageService3",
  "width": 2000,
  "height": 1500
}
```

Store the annotation under `assets/annotations/` and reference it from
`warpedMaps`. Generate local services with `slides iiif` during development;
builds generate them automatically. When the annotation is served through
`/api/annotations/…`, the image path becomes an absolute IIIF service URL:

- Development uses the current request origin (e.g. `http://localhost:5173`)
  and the configured base path.
- Deployed builds use `site.publicUrl` / `PUBLIC_URL`, e.g.
  `https://example.org/story/iiif/map`. Set this to the full deployed app URL,
  including its base path.

The authored JSON stays relative, and remote image URLs, provenance, masks and
control points are preserved. The thumbnail renderer resolves the same local
images directly from disk. Share the app’s `/api/annotations/…` URL to use an
annotation outside the app.

## Logos and theme-aware images

Store logos and other interface artwork in `assets/logos/`, outside the IIIF
input directory (`assets/images/` by default). SVGs anywhere under `assets/`
are served directly as vectors and never converted to IIIF. Raster images
outside the IIIF input are also ordinary assets. Vite includes these files in
production builds and resolves the site's base path automatically.

Ordinary Markdown image syntax works for a single version. For light/dark
alternatives, use an ordinary HTML image with `data-dark-src`:

```html
<img src="assets/logos/institution-light.svg"
       data-dark-src="assets/logos/institution-dark.svg"
       alt="Institution name" height="60" />
```

`src` is the light version and `data-dark-src` is optional. The alternative follows
the slideshow's theme switch, with the system preference as the initial fallback.
This works in credits and slide Markdown without component imports,
content-specific code, or a filename convention. Both versions should have the same viewBox
and aspect ratio.
Specify just `height` or just `width` (in pixels) to size the image while keeping
its original proportions. Images also fit within the available panel width
without stretching.

For linked credits logos, wrap images in ordinary HTML links inside a
`<div class="logo-grid">`. This reusable two-column layout removes text-link
decoration; HTML links do not add external-link arrows. Use `class="logo-wide"`
on a link to span both columns. Include meaningful image alt text and, when
opening a new tab, `target="_blank" rel="noreferrer"`. [Kattenburg's credits](https://github.com/amsterdamtimemachine/kattenburg-atlas/blob/main/CREDITS.md)
contain a complete example.
