import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { WarpedMap } from "@allmaps/render";
import { lonLatToWebMercator } from "@allmaps/project";
import {
  resolveChapterCamera,
  unitsPerPixel,
} from "@allmaps/slides-model/map/camera";
import {
  StaticWarpedMap,
  invertProjectiveWeights,
} from "../src/static-warped-map.ts";
import { renderBatch } from "../src/index.ts";

// Real, overdetermined GCPs and mask from Kattenburg's Dilcher bird's-eye map.
// A generated coordinate image below keeps the regression offline and portable.
const fixture = JSON.parse(
  await readFile(new URL("./fixtures/projective-map.json", import.meta.url)),
);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

test("Kattenburg projective geometry is unchanged and its inverse round-trips across the mask", (t) => {
  const original = new WarpedMap("original", fixture);
  const improved = new StaticWarpedMap("improved", fixture);
  t.after(() => {
    original.destroy();
    improved.destroy();
  });
  let previousError = 0;
  for (let x = 1000; x < 9100; x += 500) {
    for (let y = 1500; y < 6400; y += 500) {
      const resource = [x, y];
      const projected =
        original.projectedTransformer.transformToProjectedGeo(resource);
      assert.deepEqual(
        improved.projectedTransformer.transformToProjectedGeo(resource),
        projected,
      );
      assert(
        distance(
          improved.projectedTransformer.transformToResource(projected),
          resource,
        ) < 1e-4,
      );
      previousError = Math.max(
        previousError,
        distance(
          original.projectedTransformer.transformToResource(projected),
          resource,
        ),
      );
    }
  }
  assert(
    previousError > 100,
    "Fixture must expose the independently fitted inverse error",
  );
  // Tile selection uses polygons, not just individual pixels.
  const projectedMask = improved.projectedTransformer.transformToProjectedGeo(
    [fixture.resourceMask],
    { maxDepth: 0 },
  );
  const restored = improved.projectedTransformer.transformToResource(
    projectedMask,
    { maxDepth: 0 },
  )[0];
  for (const point of fixture.resourceMask)
    assert(
      restored.some((restoredPoint) => distance(point, restoredPoint) < 1e-4),
    );

  const gcps = fixture.gcps.map((gcp, index) => ({
    ...gcp,
    resource: [gcp.resource[0] + index * 3, gcp.resource[1]],
  }));
  improved.setGcps(gcps);
  const updated = improved.projectedTransformer;
  assert(
    distance(
      updated.transformToResource(
        updated.transformToProjectedGeo([5000, 3500]),
      ),
      [5000, 3500],
    ) < 1e-4,
  );
});

test("other transformation types keep Allmaps' existing behavior", (t) => {
  for (const type of ["polynomial", "thinPlateSpline"]) {
    const options = { transformationType: type };
    const original = new WarpedMap("original", fixture, {}, options);
    const improved = new StaticWarpedMap("improved", fixture, {}, options);
    t.after(() => {
      original.destroy();
      improved.destroy();
    });
    const projected = original.projectedTransformer.transformToProjectedGeo([
      5000, 3500,
    ]);
    assert.deepEqual(
      improved.projectedTransformer.transformToProjectedGeo([5000, 3500]),
      projected,
    );
    assert.deepEqual(
      improved.projectedTransformer.transformToResource(projected),
      original.projectedTransformer.transformToResource(projected),
    );
  }
});

test("invalid or singular homographies fail instead of substituting a transformation", () => {
  for (const weights of [
    [],
    Array(9).fill(0),
    [1, 0, 0, 2, 0, 0, 0, 0, 1],
    Array(9).fill(NaN),
  ])
    assert.throws(
      () => invertProjectiveWeights(new Float64Array(weights)),
      /projective|Projective/,
    );
});

test("serialized projective plans sample the forward geometry, including rotated and cropped views", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "projective-pixels-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const width = Math.ceil(fixture.resource.width / 16),
    height = Math.ceil(fixture.resource.height / 16);
  const scalePoint = ([x, y]) => [
    (x / fixture.resource.width) * width,
    (y / fixture.resource.height) * height,
  ];
  const map = {
    ...fixture,
    resource: { ...fixture.resource, width, height },
    resourceMask: fixture.resourceMask.map(scalePoint),
    gcps: fixture.gcps.map((gcp) => ({
      ...gcp,
      resource: scalePoint(gcp.resource),
    })),
  };
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 3;
      pixels[offset] = Math.round((x / (width - 1)) * 255);
      pixels[offset + 1] = Math.round((y / (height - 1)) * 255);
      pixels[offset + 2] = 80;
    }
  await sharp(pixels, { raw: { width, height, channels: 3 } })
    .png()
    .toFile(path.join(root, "map.png"));
  const warped = new StaticWarpedMap("fixture", map);
  t.after(() => warped.destroy());
  const props = { url: "fixture", useBearing: true };
  const size = [320, 240];
  const camera = resolveChapterCamera(
    { warpedMaps: [props] },
    () => [warped],
    size,
    15,
  );
  const jobs = [
    { id: "full", layers: ["map"], camera, size, format: "webp" },
    {
      id: "crop",
      layers: ["map"],
      camera: {
        ...camera,
        zoom: camera.zoom + 1.2,
        bearing: camera.bearing + 31,
      },
      size,
      format: "webp",
    },
  ];
  const plan = {
    version: 1,
    epoch: 0,
    assets: { images: { [map.resource.id]: "map.png" }, data: {} },
    resources: {},
    layers: { map: { props, maps: [{ map }] } },
    jobs,
  };
  const options = {
    assetRoot: root,
    cacheRoot: path.join(root, "cache"),
    outputRoot: path.join(root, "out"),
    offline: true,
  };
  const result = await renderBatch(plan, options);
  for (const job of jobs) {
    const data = await sharp(
      path.join(options.outputRoot, result.images[job.id].path),
    )
      .ensureAlpha()
      .raw()
      .toBuffer();
    const center = lonLatToWebMercator(job.camera.center);
    const units = unitsPerPixel(job.camera.zoom);
    const angle = (job.camera.bearing * Math.PI) / 180;
    let samples = 0;
    // Expected colors at these pixels use the unmodified forward fit, never
    // the inverse under test. Tolerance allows pixel rounding and WebP encoding.
    for (let y = 120; y < height - 70; y += 24)
      for (let x = 100; x < width - 75; x += 24) {
        const geo = warped.projectedTransformer.transformToProjectedGeo([x, y]);
        const dx = (geo[0] - center[0]) / units,
          dy = (geo[1] - center[1]) / units;
        const px = Math.round(
          size[0] / 2 + Math.cos(angle) * dx - Math.sin(angle) * dy,
        );
        const py = Math.round(
          size[1] / 2 - Math.sin(angle) * dx - Math.cos(angle) * dy,
        );
        if (px < 2 || py < 2 || px >= size[0] - 2 || py >= size[1] - 2)
          continue;
        const offset = (py * size[0] + px) * 4;
        assert(
          data[offset + 3] > 240,
          `${job.id}: missing tile at ${px},${py}`,
        );
        assert(
          Math.abs(data[offset] - (x / (width - 1)) * 255) < 7,
          `${job.id}: wrong resource x at ${px},${py}`,
        );
        assert(
          Math.abs(data[offset + 1] - (y / (height - 1)) * 255) < 7,
          `${job.id}: wrong resource y at ${px},${py}`,
        );
        samples++;
      }
    assert(
      samples > 30,
      `${job.id}: insufficient visible samples (${samples})`,
    );
  }
  assert.deepEqual(
    await renderBatch(plan, options),
    result,
    "Warm builds must reuse corrected outputs",
  );
});
