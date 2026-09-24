import sharp, { type Metadata, type Region } from "sharp";
export type ImageSize = { width: number; height: number };

export function getImageSize(metadata: Metadata): ImageSize {
  if (!metadata.width || !metadata.height) {
    throw new Error("Could not read image width and height");
  }

  return {
    width: metadata.width,
    height: metadata.height,
  };
}

export function getScaleFactors(
  { width, height }: ImageSize,
  tileSize: number,
) {
  if (
    ![width, height, tileSize].every(
      (value) => Number.isInteger(value) && value > 0,
    )
  )
    throw new Error("Image and tile dimensions must be positive integers");
  const scaleFactors: number[] = [];
  let scaleFactor = 1;

  while (true) {
    scaleFactors.push(scaleFactor);

    if (
      Math.ceil(width / scaleFactor) <= tileSize &&
      Math.ceil(height / scaleFactor) <= tileSize
    ) {
      break;
    }

    scaleFactor *= 2;
  }

  return scaleFactors;
}

/** Shared source decoding, region extraction and resizing for static and on-demand IIIF. */
export function createImagePipeline(
  filename: string,
  size?: ImageSize,
  region?: Region,
) {
  let pipeline = sharp(filename, { limitInputPixels: false });
  if (region) pipeline = pipeline.extract(region);
  if (size)
    pipeline = pipeline.resize(size.width, size.height, { fit: "fill" });
  return pipeline;
}

/** A local, DOM-free IIIF subset for image consumers; no HTTP server required. */
export async function renderLocalIiifRequest(
  filename: string,
  request: string,
  serviceId: string,
) {
  const size = getImageSize(await createImagePipeline(filename).metadata());
  if (request === "info.json")
    return {
      type: "application/json",
      bytes: Buffer.from(
        JSON.stringify({
          "@context": "http://iiif.io/api/image/3/context.json",
          id: serviceId,
          type: "ImageService3",
          protocol: "http://iiif.io/api/image",
          profile: "level0",
          ...size,
          extraFeatures: ["regionByPx", "sizeByW", "sizeByH", "sizeByWh"],
          tiles: [{ width: 512, scaleFactors: getScaleFactors(size, 512) }],
        }),
      ),
    };
  const parts = request.split("/");
  const [regionText, sizeText, rotation, quality] = parts;
  if (parts.length !== 4 || rotation !== "0" || quality !== "default.jpg")
    throw new Error(`Unsupported local IIIF request: ${request}`);
  let region: Region | undefined;
  if (regionText !== "full") {
    if (!/^\d+,\d+,\d+,\d+$/.test(regionText))
      throw new Error(`Invalid IIIF region: ${regionText}`);
    const [left, top, width, height] = regionText.split(",").map(Number);
    if (
      !width ||
      !height ||
      left + width > size.width ||
      top + height > size.height
    )
      throw new Error(`IIIF region outside image: ${regionText}`);
    region = { left, top, width, height };
  }
  const crop = region ?? size;
  let output: ImageSize | undefined;
  if (sizeText !== "max" && sizeText !== "full") {
    if (!/^(?:\d+,\d*|,\d+)$/.test(sizeText))
      throw new Error(`Invalid IIIF size: ${sizeText}`);
    const [w, h] = sizeText.split(",").map(Number);
    const width = w || Math.round((h * crop.width) / crop.height);
    const height = h || Math.round((w * crop.height) / crop.width);
    if (
      !(width > 0 && height > 0) ||
      width > crop.width ||
      height > crop.height
    )
      throw new Error(`Invalid or upscaled IIIF size: ${sizeText}`);
    output = { width, height };
  }
  return {
    type: "image/jpeg",
    bytes: await createImagePipeline(filename, output, region)
      .jpeg()
      .toBuffer(),
  };
}
