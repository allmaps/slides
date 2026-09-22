import type { ContentSnapshot } from "./index.ts";
import { within } from "./index.ts";
import path from "node:path";

export function normalizeBasePath(value: string) {
  try { value = new URL(value).pathname; } catch { /* plain path */ }
  return value.replace(/^\/+|\/+$/g, "");
}
export function createContentAssets(content: Pick<ContentSnapshot, "config" | "images" | "data">) {
  const { config } = content;
  const base = normalizeBasePath(config.publicBasePath);
  const url = (value: string) => `/${[base, value.replace(/^\/+/, "")].filter(Boolean).join("/")}`;
  const assets = { images: {} as Record<string, string>, data: {} as Record<string, string> };
  const urls = new Map<string, string>();
  for (const filename of content.images) {
    const relative = within(config.sourceContentDir, filename);
    const fromImages = path.relative(config.iiif.inputRoot, filename);
    // With IIIF disabled, ordinary image imports may live anywhere in assets.
    if (!config.iiif.enabled && (fromImages.startsWith(`..${path.sep}`) || path.isAbsolute(fromImages))) continue;
    const service = url(`iiif/${within(config.iiif.inputRoot, filename).replace(/\.[^/.]+$/, "")}`);
    assets.images[service] = relative;
    urls.set(relative, service);
  }
  for (const filename of content.data) {
    const relative = within(config.sourceContentDir, filename);
    const request = url(`api/${relative.replace(/^assets\//, "")}`);
    assets.data[request] = relative;
    urls.set(relative, request);
  }
  const resolveAsset = (value: string) => {
    if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith("//")) return value;
    const relative = value.replace(/^\.?\//, "");
    return urls.get(relative) ?? urls.get(`assets/${relative}`);
  };
  return { assets, resolveAsset, url };
}
