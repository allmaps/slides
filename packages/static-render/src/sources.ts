import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderLocalIiifRequest } from "@allmaps/iiif/image";
import { digest, type CachedResource, RemoteCache } from "./cache.ts";

export type SourceAssets = {
  images: Record<string, string>;
  data: Record<string, string>;
};

/** Resolves local app URLs directly, without a running server or old deployment. */
export class Sources {
  readonly remote: RemoteCache;
  private images: Map<string, string>;
  private data: Map<string, string>;
  private prepared = new Map<string, Promise<CachedResource>>();
  constructor(remote: RemoteCache, assets: SourceAssets, root: string) {
    this.remote = remote;
    this.images = new Map(
      Object.entries(assets.images).map(([url, file]) => [
        new URL(url, "http://slides.local").pathname,
        path.resolve(root, file),
      ]),
    );
    this.data = new Map(
      Object.entries(assets.data).map(([url, file]) => [
        new URL(url, "http://slides.local").pathname,
        path.resolve(root, file),
      ]),
    );
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
    const filename = this.data.get(pathname);
    if (filename) {
      const bytes = await readFile(filename);
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
    const { bytes, type } = await renderLocalIiifRequest(
      filename,
      request,
      url.replace(/\/info.json$/, ""),
    );
    return { bytes, hash: digest(bytes), type };
  }

  clearDecodedSources() {
    this.prepared.clear();
  }
}
