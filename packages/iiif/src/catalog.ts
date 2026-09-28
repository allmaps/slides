import { readFile, mkdir, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { BuildStaticIiifResult, IiifCatalog } from "./core.ts";
import type { ImageServiceInfo } from "./core.ts";

/** List only published artifacts; never discovers sources or generates pixels. */
export async function getIiifOverview(catalog: IiifCatalog) {
  const requests = (await catalog.entries()).map(entry => entry.request);
  const assets = new Set(requests);
  const collection = assets.has("collection.json") ? "collection.json" : undefined;
  let collectionLabel: string | undefined;
  const manifestLabels: Record<string, string> = {};
  if (collection) {
    const response = await catalog.get(collection);
    if (!response.ok) throw new Error(`Cannot read published IIIF collection: ${collection}`);
    const metadata: { id: string; label?: Record<string, string[]>; items?: { id: string; label?: Record<string, string[]> }[] } = await response.json();
    const label = (value?: Record<string, string[]>) => Object.values(value ?? {}).flat().join(" · ") || undefined;
    collectionLabel = label(metadata.label);
    const prefix = metadata.id.slice(0, -collection.length);
    for (const item of metadata.items ?? []) {
      if (item.id.startsWith(prefix)) {
        const request = item.id.slice(prefix.length);
        if (assets.has(request)) manifestLabels[request] = label(item.label) ?? request;
      }
    }
  }
  const images = await Promise.all(requests.filter(request => request.endsWith("/info.json")).map(async info => {
    const response = await catalog.get(info);
    if (!response.ok) throw new Error(`Cannot read published IIIF image: ${info}`);
    const metadata: ImageServiceInfo = await response.json();
    const name = info.slice(0, -"/info.json".length);
    const sizes = [...(metadata.sizes ?? [])].sort((a, b) => a.width - b.width);
    const preview = [...sizes.map(size => `${name}/full/${size.width},${size.height}/0/default.jpg`), `${name}/full/max/0/default.jpg`].find(request => assets.has(request));
    return { name, info, preview, width: metadata.width, height: metadata.height,
      fileCount: requests.filter(request => request.startsWith(`${name}/`)).length };
  }));
  return { images, fileCount: requests.length, collection, collectionLabel, manifestLabels,
    manifests: requests.filter(request => request === "manifest.json" || request.endsWith("/manifest.json")) };
}

export type PublishedIiifCatalog = {
  version: 1;
  assets: BuildStaticIiifResult["assets"];
  publicUrl?: string;
  idBase?: string;
};
export async function writeIiifCatalog(filename: string, result: Pick<BuildStaticIiifResult, "assets"> & Partial<Pick<BuildStaticIiifResult, "options">>) {
  await mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify({ version: 1, assets: result.assets,
    publicUrl: result.options?.publicUrl, idBase: result.options?.idBase }, null, 2));
  await rename(temporary, filename);
}
/** Serving a prepared catalog performs no discovery or image generation. */
export function readIiifCatalog(filename: string, { allowMissing = false } = {}): IiifCatalog {
  async function read(): Promise<PublishedIiifCatalog> {
    let contents: string;
    try { contents = await readFile(filename, "utf8"); }
    catch (error) {
      if (allowMissing && (error as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, assets: {} };
      throw error;
    }
    const catalog = JSON.parse(contents);
    if (catalog.version !== 1 || !catalog.assets) throw new Error(`Invalid IIIF catalog: ${filename}`);
    return catalog;
  }
  return {
    entries: async () => Object.keys((await read()).assets).sort().map(request => ({ request })),
    get: async (request, options) => {
      const { assets, publicUrl, idBase } = await read();
      if (!request || !Object.hasOwn(assets, request)) return new Response("Not found", { status: 404 });
      const asset = assets[request];
      let bytes: Uint8Array<ArrayBuffer>;
      try { bytes = new Uint8Array(await readFile(asset.filename)); }
      catch (error) {
        if (allowMissing && (error as NodeJS.ErrnoException).code === "ENOENT") return new Response("Not found", { status: 404 });
        throw error;
      }
      // Only JSON identifiers change for a local origin/port. Pixels and the
      // published files stay untouched, and explicit custom ID bases are kept.
      if (options?.publicUrl && publicUrl !== undefined && idBase === `${publicUrl.replace(/\/+$/, "")}/iiif`
        && asset.type.startsWith("application/json")) {
        const target = `${options.publicUrl.replace(/\/+$/, "")}/iiif`;
        const json = JSON.parse(new TextDecoder().decode(bytes), (key, value) =>
          ["id", "@id", "target"].includes(key) && typeof value === "string"
            && (value === idBase || value.startsWith(idBase + "/"))
            ? target + value.slice(idBase.length) : value);
        bytes = new TextEncoder().encode(JSON.stringify(json));
      }
      return new Response(bytes, { headers: {
        "content-type": asset.type, "access-control-allow-origin": "*", "cache-control": "no-cache",
      } });
    },
  };
}
