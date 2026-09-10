import { Vault } from "@iiif/helpers/vault";
import { createPaintingAnnotationsHelper, parseSpecificResource } from "@iiif/helpers/painting-annotations";
import { expandTarget } from "@iiif/helpers/annotation-targets";
import { ImageServiceLoader } from "@iiif/helpers/image-service";
import { getId, getImageServices } from "@iiif/parser/image-3";
import type { IIIFExternalWebResource } from "@iiif/parser/presentation-3/types";
import type { CanvasNormalized } from "@iiif/parser/presentation-3-normalized/types";
import { getIiifRequest, getRegionFragment, resolveRegion, selectCanvas, type IiifSource, type ImageBox } from "./iiif-source.ts";
export type { ImageBox } from "./iiif-source.ts";

export type ImageService = Awaited<ReturnType<ImageServiceLoader["loadService"]>>;
export type IiifImage = {
  id: string;
  width: number;
  height: number;
  target: ImageBox;
  service?: ImageService;
};
export type IiifResource = { width: number; height: number; images: IiifImage[]; region?: ImageBox };

function dimensions(value: { width?: unknown; height?: unknown }) {
  const width = Number(value.width);
  const height = Number(value.height);
  if (!(width > 0 && height > 0 && Number.isFinite(width + height))) {
    throw new Error("The IIIF image has no valid dimensions.");
  }
  return { width, height };
}

/** Resolve once per figure; the preview and modal share the resulting metadata. */
export async function loadIiifResource(source: IiifSource, baseUrl: string, signal: AbortSignal): Promise<IiifResource> {
  const fetchJson = async (url: string) => {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`IIIF request failed (${response.status}): ${url}`);
    return response.json();
  };
  const vault = new Vault({ customFetcher: fetchJson, enableDevtools: false });
  const loader = new ImageServiceLoader({ disableThrottling: true });
  loader.fetch = (url, init) => fetch(url, { ...init, signal }).then(response => {
    if (!response.ok) throw new Error(`IIIF request failed (${response.status}): ${url}`);
    return response;
  });
  const url = new URL(source.url.split("#")[0], baseUrl).href;
  const region = source.region
    ?? (source.type === "manifest" && source.canvas ? getRegionFragment(source.canvas) : undefined)
    ?? getRegionFragment(source.url)
    ?? getIiifRequest(url)?.region;
  if (source.type === "image") {
    const serviceUrl = getIiifRequest(url)?.serviceUrl ?? url;
    const service = await loader.loadService({ id: serviceUrl, width: 0, height: 0 });
    // Generated metadata carries the published site's ID. Keep local previews
    // and deployments under another base path on the requested local service.
    if (new URL(serviceUrl).origin === new URL(baseUrl).origin) {
      service.id = serviceUrl;
      if ("@id" in service) service["@id"] = serviceUrl;
    }
    const size = dimensions(service);
    return { ...size, region: resolveRegion(region, size), images: [{ id: getId(service), ...size, service, target: { x: 0, y: 0, ...size } }] };
  }

  const manifest = await vault.loadManifest(url);
  if (!manifest) throw new Error("The IIIF manifest could not be loaded.");
  // A canvas ID can itself contain a fragment; only strip our xywh selector.
  const requestedCanvas = source.canvas && getRegionFragment(source.canvas) !== undefined
    ? source.canvas.split("#")[0] : source.canvas;
  const canvasId = selectCanvas(manifest, requestedCanvas);
  let canvas: CanvasNormalized | undefined = vault.get({ id: canvasId, type: "Canvas" });
  if (!canvas || !Array.isArray(canvas.items)) {
    canvas = await vault.load<CanvasNormalized>(canvasId);
  }
  if (!canvas) throw new Error("The IIIF canvas could not be loaded.");
  const size = dimensions(canvas);
  // Annotation pages may be linked rather than embedded in a manifest.
  for (const reference of canvas.items) {
    const page = vault.get(reference);
    if (!page?.items?.length) await vault.load(reference.id);
  }
  const paintables = createPaintingAnnotationsHelper(vault).getPaintables(canvas);
  const images: IiifImage[] = [];
  for (const item of paintables.items) {
    if (item.type !== "image") continue;
    const [resource, specific] = parseSpecificResource(item.resource);
    if (resource.type !== "Image") continue;
    // This Vault normalizes both Presentation 2 and 3 into the v3 model.
    const body = resource as IIIFExternalWebResource;
    const services = getImageServices(body);
    const service = services[0] ? await loader.loadService({
      id: getId(services[0]), width: Number(body.width) || size.width,
      height: Number(body.height) || size.height, source: services[0],
    }) : undefined;
    const imageSize = dimensions(service ?? { width: body.width ?? size.width, height: body.height ?? size.height });
    const target = expandTarget(item.target).selector;
    if (target && target.type !== "BoxSelector") throw new Error("This canvas uses an unsupported image placement.");
    if (specific.selector) throw new Error("This image uses an unsupported source crop.");
    const box = target?.spatial;
    const placement = box ? {
      x: box.x * (box.unit === "percent" ? size.width / 100 : 1),
      y: box.y * (box.unit === "percent" ? size.height / 100 : 1),
      width: box.width * (box.unit === "percent" ? size.width / 100 : 1),
      height: box.height * (box.unit === "percent" ? size.height / 100 : 1),
    } : { x: 0, y: 0, ...size };
    images.push({
      id: new URL(getId(body), url).href, ...imageSize, service,
      target: placement,
    });
  }
  if (!images.length) throw new Error("This canvas has no painting images.");
  signal.throwIfAborted();
  return { ...size, images, region: resolveRegion(region, size) };
}
