import assert from "node:assert/strict";
import { test } from "node:test";
import { WarpedMap, Viewport } from "@allmaps/render";
import { lonLatToWebMercator } from "@allmaps/project";
import { computeWarpedMapBearing } from "@allmaps/bearing";
import {
  resolveChapterCamera,
  unitsPerPixel,
  getCameraLayoutOptions,
} from "../src/lib/shared/map/camera.ts";

// Synthetic mask around Kattenburg; independent of installed content packages.
const georeferencedMap = {
  "@context": "https://schemas.allmaps.org/map/2/context.json",
  type: "GeoreferencedMap",
  resource: {
    id: "https://example.org/kattenburg",
    type: "ImageService3",
    width: 1000,
    height: 800,
  },
  resourceMask: [
    [0, 0],
    [1000, 0],
    [1000, 800],
    [0, 800],
  ],
  gcps: [
    { resource: [0, 0], geo: [4.91, 52.38] },
    { resource: [1000, 0], geo: [4.92, 52.38] },
    { resource: [1000, 800], geo: [4.92, 52.374] },
    { resource: [0, 800], geo: [4.91, 52.374] },
  ],
  transformation: { type: "polynomial", options: { order: 1 } },
};

test("map masks fit a shared camera at nonzero bearing without DOM access", () => {
  assert.equal(typeof document, "undefined");
  const map = new WarpedMap("map", georeferencedMap);
  try {
    const props = { url: "map", useBearing: true };
    const camera = resolveChapterCamera(
      { warpedMaps: [props], location: { bearing: 37 } },
      () => [map],
      [540, 400],
      20,
    );
    assert.equal(camera.bearing, 37);
    const viewport = new Viewport(
      [540, 400],
      lonLatToWebMercator(camera.center),
      unitsPerPixel(camera.zoom),
      { rotation: (-37 * Math.PI) / 180 },
    );
    const [a, b, c, d, e, f] =
      viewport.projectedGeoToViewportHomogeneousTransform;
    for (const [x, y] of map.projectedGeoAppliedMask) {
      const px = a * x + c * y + e,
        py = b * x + d * y + f;
      assert(
        px >= 19.9 && px <= 520.1 && py >= 19.9 && py <= 380.1,
        `${px},${py} outside fitted view`,
      );
    }
    const derived = resolveChapterCamera(
      { warpedMaps: [props] },
      () => [map],
      [540, 400],
    );
    assert.equal(derived.bearing, computeWarpedMapBearing(map));
  } finally {
    map.destroy();
  }
});

test("explicit location overrides map fitting and a location-only chapter inherits unspecified fields", () => {
  const previous = { center: [4.9, 52.3], zoom: 13, bearing: 24 };
  assert.deepEqual(
    resolveChapterCamera(
      { location: { zoom: 15 } },
      () => [],
      [540, 400],
      20,
      previous,
    ),
    { ...previous, zoom: 15 },
  );
  assert.deepEqual(
    getCameraLayoutOptions({ left: 100, right: 20, top: 20, bottom: 40 }),
    {
      padding: { left: 60, right: 60, top: 30, bottom: 30 },
      offset: [40, -10],
    },
  );
});

test("useBounds excludes distant maps while an explicit zoom overrides native-image zoom", () => {
  const map = new WarpedMap("map", georeferencedMap);
  const props = { url: "included", useBounds: true, useZoom: true };
  try {
    const getMaps = (entry) => {
      assert.equal(entry.url, "included");
      return [map];
    };
    const camera = resolveChapterCamera(
      { warpedMaps: [props, { url: "excluded" }], location: { zoom: 11 } },
      getMaps,
      [540, 400],
    );
    assert.equal(camera.zoom, 11);
  } finally {
    map.destroy();
  }
});
