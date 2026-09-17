import path from "node:path";
import { parseAnnotation } from "@allmaps/annotation";
import { RemoteCache, RenderCache, readJson } from "./cache.ts";
import { Sources, type SourceAssets } from "./sources.ts";

export async function createSourceContext(options: {
  assets: SourceAssets;
  assetRoot: string;
  cacheRoot: string;
  annotationsRoot?: string;
  publicUrl?: string;
  offline?: boolean;
  refresh?: boolean;
  epoch?: number;
}) {
  const { cacheRoot, offline, refresh } = options;
  const previous = await readJson<{ epoch: number }>(
    path.join(cacheRoot, "epoch.json"),
  );
  const epoch =
    options.epoch ??
    (refresh
      ? Date.now()
      : offline
        ? (previous?.epoch ?? 0)
        : Math.floor(Date.now() / 86_400_000));
  const remote = new RemoteCache(path.join(cacheRoot, "sources"), epoch, {
    offline,
    refresh,
    fetch: async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const headers = new Headers(init?.headers);
      if (
        url.hostname === "api.protomaps.com" &&
        options.publicUrl?.startsWith("https://")
      ) {
        headers.set("Origin", new URL(options.publicUrl).origin);
        headers.set("Referer", options.publicUrl);
      }
      return fetch(input, { ...init, headers });
    },
  });
  const annotations = new RemoteCache(
    options.annotationsRoot ?? path.join(cacheRoot, "annotations"),
    epoch,
    {
      offline,
      refresh,
      validate: (bytes) => {
        if (!parseAnnotation(JSON.parse(bytes.toString())).length)
          throw new Error("Empty georeference annotation");
      },
    },
  );
  return {
    epoch,
    annotations,
    sources: new Sources(remote, options.assets, options.assetRoot),
    cache: new RenderCache(path.join(cacheRoot, "renders-v2")),
  };
}
