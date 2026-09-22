import { readFile, mkdir, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { BuildStaticIiifResult, IiifCatalog } from "./core.ts";

export type PublishedIiifCatalog = { version: 1; assets: BuildStaticIiifResult["assets"] };
export async function writeIiifCatalog(filename: string, result: Pick<BuildStaticIiifResult, "assets">) {
  await mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify({ version: 1, assets: result.assets }, null, 2));
  await rename(temporary, filename);
}
/** Serving a prepared catalog performs no discovery or image generation. */
export function readIiifCatalog(filename: string): IiifCatalog {
  async function read(): Promise<PublishedIiifCatalog> {
    const catalog = JSON.parse(await readFile(filename, "utf8"));
    if (catalog.version !== 1 || !catalog.assets) throw new Error(`Invalid IIIF catalog: ${filename}`);
    return catalog;
  }
  return {
    entries: async () => Object.keys((await read()).assets).sort().map(request => ({ request })),
    get: async request => {
      const { assets } = await read();
      if (!request || !Object.hasOwn(assets, request)) return new Response("Not found", { status: 404 });
      const asset = assets[request];
      return new Response(new Uint8Array(await readFile(asset.filename)), { headers: {
        "content-type": asset.type, "access-control-allow-origin": "*", "cache-control": "no-cache",
      } });
    },
  };
}
