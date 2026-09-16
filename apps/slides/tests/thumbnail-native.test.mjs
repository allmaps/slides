import assert from "node:assert/strict";
import { test } from "node:test";
import { fork } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { Viewport } from "@allmaps/render";
import { lonLatToWebMercator } from "@allmaps/project";
import { unitsPerPixel } from "../src/lib/shared/map/camera.ts";

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
    const child = fork(
      new URL(
        "../src/lib/server/thumbnails/native-worker.mjs",
        import.meta.url,
      ),
      [],
      {
        serialization: "advanced",
        stdio: ["ignore", "inherit", "inherit", "ipc"],
      },
    );
    t.after(() => child.kill());
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
    const result = new Promise((resolve, reject) => {
      child.on("error", reject);
      child.on("exit", (code) => reject(new Error(`Renderer exited: ${code}`)));
      child.on("message", (message) => {
        if (message.type === "source")
          reject(new Error(`Unexpected remote request: ${message.url}`));
        else if (message.error) reject(new Error(message.error));
        else if (message.type === "result") resolve(message.bytes);
      });
    });
    child.send({
      type: "render",
      id: 1,
      cacheDir,
      offline: true,
      options: {
        stylejson: style,
        center,
        zoom,
        bearing,
        pitch: 0,
        width: 400,
        height: 300,
        ext: "png",
      },
    });
    const png = await result;
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
