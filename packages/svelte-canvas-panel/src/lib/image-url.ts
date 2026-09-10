import { createImageServiceRequest, imageServiceRequestToString, supportsCustomSizes } from "@iiif/parser/image-3";
import type { ImageService } from "./iiif-resource.ts";

export function imageUrl(service: ImageService, size?: { width: number; height: number }) {
  const request = createImageServiceRequest(service);
  if (request.type !== "image") throw new Error("Invalid IIIF image service.");
  if (size) request.size = { ...request.size, max: false, width: size.width, height: size.height };
  return imageServiceRequestToString(request, service);
}

/** Never invent a resized request for a static level 0 service. */
export function thumbnailUrl(service?: ImageService): string | undefined {
  if (!service) return undefined;
  const sizes = [...(service.sizes ?? [])].sort((a, b) => a.width - b.width);
  let size = sizes.find(size => size.width >= 320) ?? sizes.at(-1);
  if (!size && supportsCustomSizes(service) && service.width && service.height) {
    const width = Math.min(512, service.width);
    size = { width, height: Math.round(service.height * width / service.width) };
  }
  return size ? imageUrl(service, size) : undefined;
}
