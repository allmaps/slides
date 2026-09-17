import path from "node:path";
import sharp from "sharp";
import { StaticWarpedMap } from "./static-warped-map.ts";
import { createSourceContext } from "./context.ts";
import { atomicWrite, digest, recipeHash } from "./cache.ts";
import { renderWarpedLayer, type LoadedLayer } from "./warped.ts";
import { renderBasemap } from "./basemap.ts";
import { NativeRenderer } from "./native.ts";
import type { RenderOptions, RenderPlan, RenderResult } from "./types.ts";
export type * from "./types.ts";

export function validateRenderPlan(plan: RenderPlan) {
  if (
    plan.version !== 1 ||
    !Array.isArray(plan.jobs) ||
    !Number.isSafeInteger(plan.epoch) ||
    plan.epoch < 0
  )
    throw new Error("Unsupported static render plan");
  const ids = new Set<string>();
  for (const job of plan.jobs) {
    if (!job.id || ids.has(job.id))
      throw new Error(`Duplicate or missing render job id: ${job.id}`);
    ids.add(job.id);
    if (
      job.size.length !== 2 ||
      job.size.some((n) => !Number.isInteger(n) || n < 1 || n > 8192)
    )
      throw new Error(`Invalid render size: ${job.id}`);
    if (
      ![...job.camera.center, job.camera.zoom, job.camera.bearing].every(
        Number.isFinite,
      )
    )
      throw new Error(`Invalid camera: ${job.id}`);
    if (!["webp", "jpg"].includes(job.format))
      throw new Error(`Invalid output format: ${job.format}`);
    for (const id of job.layers)
      if (!plan.layers[id]) throw new Error(`Unknown render layer: ${id}`);
  }
  for (const filename of [
    ...Object.values(plan.assets.images),
    ...Object.values(plan.assets.data),
  ]) {
    if (path.isAbsolute(filename) || filename.split(/[\\/]/).includes(".."))
      throw new Error(`Asset must be relative to asset root: ${filename}`);
  }
}

export async function renderBatch(
  plan: RenderPlan,
  options: RenderOptions,
): Promise<RenderResult> {
  validateRenderPlan(plan);
  const { sources, cache } = await createSourceContext({
    ...options,
    assets: plan.assets,
    epoch: plan.epoch,
    publicUrl: plan.publicUrl,
  });
  const native = new NativeRenderer(
    sources,
    path.join(options.cacheRoot, "native", String(plan.epoch)),
  );
  const result: RenderResult = { images: {}, resources: {} };
  const layers = new Map<string, LoadedLayer>();
  const publish = async (bytes: Buffer, extension: string) => {
    const filename = `${digest(bytes)}.${extension}`;
    await atomicWrite(path.join(options.outputRoot, filename), bytes);
    return filename;
  };
  try {
    for (const [id, layer] of Object.entries(plan.layers)) {
      // A saved plan can be reused after a local original or render option changes.
      const imageRevisions = await Promise.all(
        layer.maps.map(({ map }) => sources.imageRevision(map.resource.id)),
      );
      layers.set(id, {
        props: layer.props,
        revision: recipeHash({
          maps: layer.maps,
          options: layer.props.options,
          revision: layer.revision,
          imageRevisions,
        }),
        maps: layer.maps.map(
          ({ map, options }, index) =>
            new StaticWarpedMap(`${id}:${index}`, map, {}, options),
        ),
      });
    }
    for (const job of plan.jobs) {
      const selected = job.layers.map((id) => layers.get(id)!);
      const png = await cache.get(
        {
          version: 2,
          renderer: "static-render-1",
          job: { ...job, id: undefined },
          revisions: selected.map((l) => l.revision),
          epoch: plan.epoch,
        },
        async () => {
          const overlays: { input: Buffer }[] = [];
          for (const layer of selected)
            overlays.push({
              input: await renderWarpedLayer(
                layer,
                job.camera,
                job.size,
                sources,
                cache,
              ),
            });
          if (job.styles?.upper.layers.length)
            overlays.push({
              input: await renderBasemap(
                job.styles.upper,
                job.camera,
                job.size,
                native,
                cache,
                plan.epoch,
              ),
            });
          const canvas = job.styles
            ? sharp(
                await renderBasemap(
                  job.styles.lower,
                  job.camera,
                  job.size,
                  native,
                  cache,
                  plan.epoch,
                ),
              )
            : sharp({
                create: {
                  width: job.size[0],
                  height: job.size[1],
                  channels: 4,
                  background: "#00000000",
                },
              });
          return canvas.composite(overlays).png().toBuffer();
        },
      );
      const encoded = await cache.get(
        { version: 1, sharp: "0.35.4", format: job.format, hash: digest(png) },
        () =>
          job.format === "webp"
            ? sharp(png).webp({ quality: 85 }).toBuffer()
            : sharp(png)
                .flatten({ background: "white" })
                .jpeg({ quality: 90 })
                .toBuffer(),
      );
      result.images[job.id] = {
        path: await publish(encoded, job.format),
        width: job.size[0],
        height: job.size[1],
      };
    }
    for (const [id, resource] of Object.entries(plan.resources))
      result.resources[id] = await publish(
        Buffer.from(resource.base64, "base64"),
        resource.extension,
      );
    await atomicWrite(
      path.join(options.cacheRoot, "epoch.json"),
      JSON.stringify({ epoch: plan.epoch }),
    );
    console.log(
      `[static-render] ${plan.jobs.length} images; ${cache.rendered} render/encode jobs, ${cache.reused} cache hits`,
    );
    return result;
  } finally {
    for (const layer of layers.values())
      for (const map of layer.maps) map.destroy();
  }
}
