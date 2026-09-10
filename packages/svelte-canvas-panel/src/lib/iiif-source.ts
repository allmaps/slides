export type IiifRequest = {
  infoUrl: string;
  serviceUrl: string;
  region?: string;
};

// Recognize unrotated IIIF requests, retaining a crop as the initial viewport.
// Arbitrary external images and other transformations keep their original rendering.
export const getIiifRequest = (src: string): IiifRequest | undefined => {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return undefined;
  }
  if (!["https:", "http:"].includes(url.protocol)) return undefined;

  const isInfo = url.pathname.endsWith("/info.json");
  const request = url.pathname.match(
    /\/(full|(?:pct:)?\d+(?:\.\d+)?(?:,\d+(?:\.\d+)?){3})\/(?:max|full|\d+,|,\d+|!\d+,\d+|pct:\d+(?:\.\d+)?)\/0\/default\.(?:jpg|png|webp|avif)$/,
  );
  if (!isInfo && !request) return undefined;

  url.hash = "";
  url.pathname = isInfo
    ? url.pathname.slice(0, -"/info.json".length)
    : url.pathname.slice(0, request!.index);
  const serviceUrl = url.href;
  url.pathname += "/info.json";
  return {
    infoUrl: url.href, serviceUrl,
    ...(request && request[1] !== "full" ? { region: request[1] } : {}),
  };
};

export type IiifSource = (
  | { type: "manifest"; url: string; canvas?: string }
  | { type: "image"; url: string }
) & { region?: string };

export type ImageBox = { x: number; y: number; width: number; height: number };

export function getRegionFragment(url: string) {
  return new URLSearchParams(url.split("#")[1]).get("xywh") ?? undefined;
}

/** Resolve pixel or percentage coordinates against the complete image/canvas. */
export function resolveRegion(value: string | undefined, size: { width: number; height: number }): ImageBox | undefined {
  if (value === undefined) return undefined;
  const match = value.match(/^(?:(pixel|percent|pct):)?(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)$/);
  if (!match) throw new Error("Invalid xywh region.");
  const percent = match[1] === "percent" || match[1] === "pct";
  const xScale = percent ? size.width / 100 : 1;
  const yScale = percent ? size.height / 100 : 1;
  const x = Number(match[2]) * xScale;
  const y = Number(match[3]) * yScale;
  const width = Math.min(Number(match[4]) * xScale, size.width - x);
  const height = Math.min(Number(match[5]) * yScale, size.height - y);
  if (!(width > 0 && height > 0 && Number.isFinite(x + y + width + height))) {
    throw new Error("The xywh region lies outside the image or is empty.");
  }
  return { x, y, width, height };
}

/** Vault normalizes Presentation 2 and 3 manifests before canvas selection. */
export function selectCanvas(manifest: { items?: { id: string }[] }, id?: string) {
  const canvas = id ? manifest.items?.find((item) => item.id === id) : manifest.items?.[0];
  if (!canvas) throw new Error(id ? `Canvas not found: ${id}` : "This manifest has no canvases.");
  return canvas.id;
}
