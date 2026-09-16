import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { dataAssetFiles, imageAssetUrls } from "$lib/shared/content-package";
import {
  getContentAssetUrl,
  getContentIiifImage,
  withBaseUrl,
} from "$lib/shared/paths";
import { digest, type CachedResource, RemoteCache } from "./cache.ts";

/** Resolves local app URLs directly, without a running server or old deployment. */
export class Sources {
  private images = new Map<string, string>();
  private data = new Map<string, () => Promise<string>>();
  private prepared = new Map<string, Promise<CachedResource>>();
  constructor(
    readonly remote: RemoteCache,
    contentRoot: string,
  ) {
    for (const key of Object.keys(imageAssetUrls)) {
      const relative = key.replace(/^\.\//, "");
      const iiif = getContentIiifImage(relative);
      const service = iiif
        ? withBaseUrl(`iiif/${iiif.servicePath}`)
        : getContentAssetUrl(relative);
      if (service)
        this.images.set(
          new URL(service, "http://slides.local").pathname,
          path.join(contentRoot, key.replace(/^\.\//, "")),
        );
    }
    for (const [key, load] of Object.entries(dataAssetFiles)) {
      const url = getContentAssetUrl(key.replace(/^\.\//, ""));
      if (url)
        this.data.set(new URL(url, "http://slides.local").pathname, load);
    }
  }

  private findImage(url: string) {
    const pathname = new URL(url, "http://slides.local").pathname;
    for (const [service, filename] of this.images) {
      // Known local IIIF services may use a previous deployment's host/base path.
      const suffix = service.slice(service.indexOf("/iiif/"));
      const index = suffix.startsWith("/iiif/") ? pathname.indexOf(suffix) : -1;
      if (pathname === service || pathname.startsWith(`${service}/`))
        return {
          filename,
          service,
          request: pathname.slice(service.length + 1),
        };
      if (
        index >= 0 &&
        (pathname.length === index + suffix.length ||
          pathname[index + suffix.length] === "/")
      )
        return {
          filename,
          service,
          request: pathname.slice(index + suffix.length + 1),
        };
    }
  }

  async imageRevision(url: string) {
    const image = this.findImage(url);
    return image
      ? digest(await readFile(image.filename))
      : `remote:${this.remote.epoch}`;
  }

  async get(url: string): Promise<CachedResource> {
    const pathname = new URL(url, "http://slides.local").pathname;
    const load = this.data.get(pathname);
    if (load) {
      const bytes = Buffer.from(await load());
      return { bytes, hash: digest(bytes), type: "application/json" };
    }
    const image = this.findImage(url);
    if (image) {
      const key = `${image.filename}:${image.request}`;
      let result = this.prepared.get(key);
      if (!result) {
        result = this.localImage(image.filename, image.request, url);
        this.prepared.set(key, result);
      }
      return result;
    }
    if (!/^https?:\/\//.test(url))
      throw new Error(`Unknown local thumbnail source: ${url}`);
    return this.remote.get(url);
  }

  fetch: typeof fetch = async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    const resource = await this.get(url);
    return new Response(new Uint8Array(resource.bytes), {
      headers: { "content-type": resource.type },
    });
  };

  private async localImage(
    filename: string,
    request: string,
    url: string,
  ): Promise<CachedResource> {
    const { width, height } = await sharp(filename).metadata();
    if (!width || !height)
      throw new Error(`Missing image dimensions: ${filename}`);
    let bytes: Buffer;
    let type: string;
    if (request === "info.json") {
      bytes = Buffer.from(
        JSON.stringify({
          "@context": "http://iiif.io/api/image/3/context.json",
          id: url.replace(/\/info.json$/, ""),
          type: "ImageService3",
          protocol: "http://iiif.io/api/image",
          profile: "level2",
          width,
          height,
          tiles: [{ width: 512, scaleFactors: [1, 2, 4, 8, 16, 32, 64, 128] }],
        }),
      );
      type = "application/json";
    } else {
      const [region, size, rotation, quality] = request.split("/");
      if (rotation !== "0" || quality !== "default.jpg")
        throw new Error(`Unsupported local IIIF thumbnail request: ${url}`);
      let image = sharp(filename);
      let rw = width,
        rh = height;
      if (region !== "full") {
        const [left, top, w, h] = region.split(",").map(Number);
        image = image.extract({ left, top, width: w, height: h });
        rw = w;
        rh = h;
      }
      if (size !== "max" && size !== "full") {
        const [w, h] = size.split(",").map(Number);
        image = image.resize(
          w || Math.round((h * rw) / rh),
          h || Math.round((w * rh) / rw),
          { fit: "fill" },
        );
      }
      bytes = await image.jpeg().toBuffer();
      type = "image/jpeg";
    }
    return { bytes, hash: digest(bytes), type };
  }

  clearDecodedSources() {
    this.prepared.clear();
  }
}
