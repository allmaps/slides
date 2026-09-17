import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createServer } from "vite";
import { atomicWrite, digest, readJson } from "@allmaps/static-render/cache";

// The temporary Vite server loads content for a production build. Do not let
// its default development environment leak into the subsequent build process.
process.env.NODE_ENV ??= "production";

const args = process.argv.slice(2);
const { values } = parseArgs({
  args,
  strict: false,
  allowPositionals: true,
  options: {
    mode: { type: "string", short: "m" },
    config: { type: "string", short: "c" },
  },
});
async function runNode(script, args) {
  const child = spawn(process.execPath, [script, ...args], {
    stdio: "inherit",
  });
  const interrupt = () => child.kill("SIGINT");
  const terminate = () => child.kill("SIGTERM");
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", terminate);
  try {
    await new Promise((resolve, reject) => {
      child.on("error", reject);
      child.on("exit", (code, signal) =>
        code === 0
          ? resolve()
          : reject(
              new Error(`${path.basename(script)} failed: ${signal ?? code}`),
            ),
      );
    });
  } finally {
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", terminate);
  }
}

const truthy = (value) => value === "true" || value === "1";
const helpOnly = args.some((arg) =>
  ["--help", "-h", "--version", "-v"].includes(arg),
);
if (!helpOnly) {
  // Restored container caches contain derivatives but no generated Kit config.
  await runNode(
    path.join(
      path.dirname(
        fileURLToPath(import.meta.resolve("@sveltejs/kit/package.json")),
      ),
      "svelte-kit.js",
    ),
    ["sync", "--mode", values.mode ?? "production"],
  );
}
if (
  !helpOnly &&
  !["false", "0"].includes(process.env.SLIDES_THUMBNAILS_ENABLED ?? "")
) {
  const cacheRoot = path.resolve(
    process.env.SLIDES_THUMBNAILS_CACHE_ROOT ?? ".svelte-kit/thumbnails",
  );
  const assetRoot = process.env.SLIDES_CONTENT_PACKAGE_ROOT ?? process.cwd();
  const work = path.join(
    cacheRoot,
    digest(process.env.SLIDES_CONTENT_PACKAGE_ROOT ?? "default").slice(0, 16),
  );
  const outputRoot = path.join(cacheRoot, "assets");
  const server = await createServer({
    mode: values.mode ?? "production",
    configFile: values.config,
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  let prepared;
  try {
    const { prepareThumbnails } = await server.ssrLoadModule(
      "/src/lib/server/thumbnails/prepare.ts",
    );
    prepared = await prepareThumbnails({
      assetRoot,
      cacheRoot,
      annotationsRoot: path.resolve(
        process.env.SLIDES_ANNOTATIONS_CACHE_ROOT ?? ".svelte-kit/annotations",
      ),
      offline: truthy(process.env.SLIDES_THUMBNAILS_OFFLINE),
      refresh: truthy(process.env.SLIDES_THUMBNAILS_REFRESH),
      publicUrl: process.env.PUBLIC_URL,
    });
  } finally {
    await server.close();
  }
  const planPath = path.join(work, "plan.json"),
    resultPath = path.join(work, "result.json");
  await atomicWrite(planPath, JSON.stringify(prepared.plan));
  await atomicWrite(
    path.join(work, "manifest-template.json"),
    JSON.stringify(prepared.manifest),
  );
  await runNode(
    fileURLToPath(import.meta.resolve("@allmaps/static-render/cli")),
    [
      planPath,
      "--assets",
      assetRoot,
      "--output",
      outputRoot,
      "--cache",
      cacheRoot,
      "--result",
      resultPath,
      ...(truthy(process.env.SLIDES_THUMBNAILS_OFFLINE) ? ["--offline"] : []),
    ],
  );
  const result = await readJson(resultPath);
  const image = (ref) => {
    const output = result.images[ref.path];
    if (!output) throw new Error(`Missing rendered image: ${ref.path}`);
    return { ...output, path: `thumbnails/${output.path}` };
  };
  const manifest = prepared.manifest;
  for (const key of Object.keys(manifest.slides))
    manifest.slides[key] = {
      light: image(manifest.slides[key].light),
      dark: image(manifest.slides[key].dark),
    };
  for (const key of Object.keys(manifest.layers))
    manifest.layers[key] = image(manifest.layers[key]);
  for (const key of Object.keys(manifest.social))
    manifest.social[key] = image(manifest.social[key]);
  for (const key of Object.keys(manifest.annotations))
    manifest.annotations[key] = `thumbnails/${result.resources[key]}`;
  await atomicWrite(path.join(work, "manifest.json"), JSON.stringify(manifest));
}
await runNode(
  path.join(
    path.dirname(fileURLToPath(import.meta.resolve("vite/package.json"))),
    "bin/vite.js",
  ),
  ["build", ...args],
);
