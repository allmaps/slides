import assert from "node:assert/strict";
import { test } from "node:test";
import { WarpedMap, Viewport } from "@allmaps/render";
import { lonLatToWebMercator } from "@allmaps/project";
import { computeWarpedMapBearing } from "@allmaps/bearing";
import {
  resolveChapterCamera,
  unitsPerPixel,
  getCameraLayoutOptions,
  getCameraPadding,
} from "../src/model/map/camera.ts";

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

test("fit modes contain, cover or equal the available area at different bearings and aspect ratios", () => {
  const map = new WarpedMap("map", georeferencedMap);
  const padding = { left: 80, right: 20, top: 30, bottom: 50 };
  try {
    for (const size of [[540, 400], [400, 700]]) {
      for (const bearing of [0, 37, 90]) {
        const chapter = { warpedMaps: [{ url: "map" }], location: { bearing } };
        const cameras = {};
        for (const fit of ["contain", "cover", "equal"]) {
          const camera = resolveChapterCamera({ ...chapter, fit }, () => [map], size, padding);
          cameras[fit] = camera;
          const viewport = new Viewport(size, lonLatToWebMercator(camera.center), unitsPerPixel(camera.zoom), {
            rotation: (-bearing * Math.PI) / 180,
          });
          const [a, b, c, d, e, f] = viewport.projectedGeoToViewportHomogeneousTransform;
          const pixels = map.projectedGeoAppliedMask.map(([x, y]) => [a * x + c * y + e, b * x + d * y + f]);
          const width = Math.max(...pixels.map(p => p[0])) - Math.min(...pixels.map(p => p[0]));
          const height = Math.max(...pixels.map(p => p[1])) - Math.min(...pixels.map(p => p[1]));
          const ratios = [width / (size[0] - padding.left - padding.right), height / (size[1] - padding.top - padding.bottom)];
          const extent = fit === "contain" ? Math.max(...ratios) : fit === "cover" ? Math.min(...ratios) : ratios[0] * ratios[1];
          assert.ok(Math.abs(extent - 1) < 1e-6, `${fit}, ${bearing}°, ${size}: ${ratios}`);
          assert.equal(camera.bearing, bearing);
        }
        assert.deepEqual(resolveChapterCamera(chapter, () => [map], size, padding), cameras.contain);
        assert.deepEqual(cameras.cover.center, cameras.contain.center);
        assert.deepEqual(cameras.equal.center, cameras.contain.center);
        assert.ok(cameras.contain.zoom < cameras.equal.zoom);
        assert.ok(cameras.equal.zoom < cameras.cover.zoom);
      }
    }
  } finally {
    map.destroy();
  }
});

test("useBounds excludes distant maps while an explicit zoom overrides native-image zoom", () => {
  const map = new WarpedMap("map", georeferencedMap);
  const props = { url: "included", useBounds: true, useZoom: true };
  try {
    const getMaps = (entry) => {
      assert.equal(entry.url, "included");
      return [map];
    };
    for (const fit of ["contain", "cover", "equal"]) {
      const chapter = { fit, warpedMaps: [props, { url: "excluded" }] };
      const native = resolveChapterCamera(chapter, getMaps, [540, 400]);
      assert.ok(Math.abs(unitsPerPixel(native.zoom) - 1 / map.resourceToProjectedGeoScale) < 1e-9);
      const explicit = resolveChapterCamera({ ...chapter, location: { zoom: 11 } }, getMaps, [540, 400]);
      assert.equal(explicit.zoom, 11);
    }
  } finally {
    map.destroy();
  }
});

test("inner padding preserves layout reservations and offsets, including edge-to-edge cover", () => {
  const map = new WarpedMap("map", georeferencedMap);
  const warpedMaps = [{ url: "map" }];
  try {
    for (const [size, layout, offset] of [
      [[1280, 800], { top: 0, right: 460, bottom: 0, left: 0 }, [-230, 0]],
      [[400, 800], { top: 0, right: 0, bottom: 420, left: 0 }, [0, -210]],
      [[540, 400], { top: 0, right: 0, bottom: 0, left: 0 }, [0, 0]],
    ]) {
      assert.deepEqual(getCameraPadding(layout, 0), layout);
      assert.deepEqual(getCameraPadding(layout), getCameraPadding(layout, 25));
      for (const padding of [-30, 0, 25, 60]) {
        const combined = getCameraPadding(layout, padding);
        const framing = getCameraLayoutOptions(combined);
        assert.deepEqual(framing.offset, offset, 'the content margin must not move the layout center');
        for (const side of ['top', 'right', 'bottom', 'left'])
          assert.equal(combined[side] - padding, layout[side], 'the panel reservation must remain intact');
        const camera = resolveChapterCamera({ warpedMaps, fit: 'cover', padding }, () => [map], size, framing.padding);
        const viewport = new Viewport(size, lonLatToWebMercator(camera.center), unitsPerPixel(camera.zoom));
        const [a, b, c, d, e, f] = viewport.projectedGeoToViewportHomogeneousTransform;
        const pixels = map.projectedGeoAppliedMask.map(([x, y]) => [a * x + c * y + e + offset[0], b * x + d * y + f + offset[1]]);
        const bounds = [Math.min(...pixels.map(p => p[0])), Math.min(...pixels.map(p => p[1])),
          Math.max(...pixels.map(p => p[0])), Math.max(...pixels.map(p => p[1]))];
        const target = [combined.left, combined.top, size[0] - combined.right, size[1] - combined.bottom];
        assert.ok(bounds[0] <= target[0] + 1e-6 && bounds[1] <= target[1] + 1e-6 &&
          bounds[2] >= target[2] - 1e-6 && bounds[3] >= target[3] - 1e-6, 'cover must reach every available edge');
        assert.ok(Math.abs(bounds[0] - target[0]) < 1e-6 || Math.abs(bounds[1] - target[1]) < 1e-6,
          'cover must meet one pair of edges exactly');
      }
    }
    for (const padding of [-30, 0, 25]) {
      assert.deepEqual(
        resolveChapterCamera({ warpedMaps, padding }, () => [map], [540, 400]),
        resolveChapterCamera({ warpedMaps }, () => [map], [540, 400], padding),
        'standalone camera resolution also honors the chapter margin',
      );
    }
  } finally {
    map.destroy();
  }
});
