import assert from "node:assert/strict";
import { test } from "node:test";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { Viewport } from "@allmaps/render";
import { lonLatToWebMercator } from "@allmaps/project";
import { unitsPerPixel } from "@allmaps/slides-model/map/camera";

// Opt in on a machine with graphics libraries (Linux: run under xvfb-run).
test(
  "Native and Allmaps cameras align at nonzero bearing without DOM access",
  {
    skip: process.env.SLIDES_TEST_NATIVE !== "true",
    timeout: 30_000,
  },
  async (t) => {
    const cacheDir = await mkdtemp(path.join(tmpdir(), "slides-native-test-"));
    t.after(() => rm(cacheDir, { recursive: true, force: true }));
    const center = [4.915, 52.377],
      zoom = 15,
      bearing = 37;
    const points = [center, [4.917, 52.378], [4.913, 52.376]];
    const style = {
      version: 8,
      sources: {
        controls: {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: points.map((coordinates) => ({
              type: "Feature",
              properties: {},
              geometry: { type: "Point", coordinates },
            })),
          },
        },
      },
      layers: [
        {
          id: "controls",
          type: "circle",
          source: "controls",
          paint: { "circle-color": "#ff0000", "circle-radius": 5 },
        },
      ],
    };
    const planPath = path.join(cacheDir, "plan.json");
    await writeFile(
      planPath,
      JSON.stringify({
        version: 1,
        epoch: 0,
        assets: { images: {}, data: {} },
        layers: {},
        resources: {},
        jobs: [
          {
            id: "native",
            layers: [],
            camera: { center, zoom, bearing },
            size: [400, 300],
            format: "webp",
            styles: {
              lower: style,
              upper: { version: 8, sources: {}, layers: [] },
            },
          },
        ],
      }),
    );
    const child = spawn(
      process.execPath,
      [
        new URL("../bin/render.mjs", import.meta.url).pathname,
        planPath,
        "--assets",
        cacheDir,
        "--output",
        cacheDir,
        "--cache",
        cacheDir,
        "--offline",
      ],
      { stdio: "inherit" },
    );
    t.after(() => child.kill());
    await new Promise((resolve, reject) => {
      child.on("error", reject);
      child.on("exit", (code) =>
        code === 0 ? resolve() : reject(new Error(`Renderer exited: ${code}`)),
      );
    });
    const result = JSON.parse(
      await readFile(path.join(cacheDir, "result.json"), "utf8"),
    );
    const png = await readFile(path.join(cacheDir, result.images.native.path));
    const { data, info } = await sharp(png)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.equal(info.width, 400);
    const viewport = new Viewport(
      [400, 300],
      lonLatToWebMercator(center),
      unitsPerPixel(zoom),
      { rotation: (-bearing * Math.PI) / 180 },
    );
    const [a, b, c, d, e, f] =
      viewport.projectedGeoToViewportHomogeneousTransform;
    for (const point of points) {
      const [x, y] = lonLatToWebMercator(point);
      const px = Math.round(a * x + c * y + e),
        py = Math.round(b * x + d * y + f);
      const offset = (py * info.width + px) * 4;
      assert(
        data[offset] > 240 && data[offset + 1] < 10 && data[offset + 3] > 240,
        `Control point not aligned at ${px},${py}: ${[...data.subarray(offset, offset + 4)]}`,
      );
    }
  },
);
