import { CompositeResource, SingleImage, TiledImage, World, WorldObject } from "@atlas-viewer/atlas/standalone";
import { getId, supportsCustomSizes } from "@iiif/parser/image-3";
import { canvasRotation } from "./rotation.ts";
import { imageUrl } from "./image-url.ts";
import type { IiifImage, IiifResource } from "./iiif-resource.ts";

function createImage(image: IiifImage, rotation: number) {
  const { service, target } = image;
  if (!service) {
    const content = new SingleImage();
    content.applyProps({
      uri: image.id,
      display: image, target: { x: 0, y: 0, width: target.width, height: target.height },
    });
    const object = WorldObject.createWithProps({ id: image.id, ...target, rotation });
    object.appendChild(content);
    return object;
  }

  const id = getId(service);
  const sizes = [...(service.sizes ?? [])];
  if (!sizes.length && supportsCustomSizes(service)) {
    // Provide lightweight fallbacks even when the service only advertises tiles.
    for (const width of [512, 1024, 2048].filter(width => width < image.width)) {
      sizes.push({ width, height: Math.round(image.height * width / image.width) });
    }
  }
  const layers: (SingleImage | TiledImage)[] = sizes.map(size =>
    SingleImage.fromImage(imageUrl(service, size), image, size),
  );
  for (const tile of service.tiles ?? []) {
    for (const factor of tile.scaleFactors) {
      // Passing the service lets Atlas select Image API 3's width,height URLs,
      // including edge tiles in the generated level 0 services.
      layers.push(TiledImage.fromTile(id, image, tile, factor, service));
    }
  }
  if (!service.tiles?.length) layers.push(SingleImage.fromImage(imageUrl(service), image));
  const object = WorldObject.createWithProps({
    id: image.id, width: image.width, height: image.height,
    x: target.x, y: target.y, scale: target.width / image.width, rotation,
  });
  object.appendChild(new CompositeResource({
    id, width: image.width, height: image.height, images: layers,
    renderOptions: { layerPolicy: "fallback-only", prefetchRadius: 0 },
  }));
  return object;
}

/** Atlas objects are mutable, so each mounted viewer gets its own world. */
export function createIiifWorld(resource: IiifResource, rotation = 0) {
  const view = canvasRotation(resource, rotation);
  const world = new World(view.width, view.height);
  // Preserve the canvas extent, including margins around positioned images.
  world.appendChild(WorldObject.createWithProps({ id: "canvas", width: view.width, height: view.height }));
  for (const image of resource.images) {
    const object = createImage({ ...image, target: view.placement(image.target) }, view.rotation);
    world.appendChild(object);
    if (view.rotation) {
      // Atlas 3.2.4 rotates image layers, but its outer world culling still uses
      // unrotated bounds. These objects are static: retain their drawing geometry
      // separately and give the world's spatial index the rotated bounding box.
      const drawingPoints = object.points.slice();
      const box = view.bounds(image.target);
      object.points.set([1, box.x, box.y, box.x + box.width, box.y + box.height]);
      object.points = drawingPoints;
    }
  }
  return world;
}
