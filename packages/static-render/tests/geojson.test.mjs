import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeGeoJsonSources } from "../src/native.ts";

test("native GeoJSON removes null feature IDs without changing valid IDs or properties", () => {
  const feature = {
    type: "Feature", id: null,
    properties: { id: null, stroke: "#64c18f" },
    geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] },
  };
  const style = {
    version: 8, layers: [], sources: {
      route: { type: "geojson", data: feature },
      collection: { type: "geojson", data: {
        type: "FeatureCollection",
        features: [feature, { ...feature, id: 0 }, { ...feature, id: "route" }],
      } },
      remote: { type: "geojson", data: "https://example.org/route.geojson" },
    },
  };
  const original = structuredClone(style);
  const result = normalizeGeoJsonSources(style);
  assert.equal(Object.hasOwn(result.sources.route.data, "id"), false);
  assert.deepEqual(result.sources.route.data.properties, feature.properties);
  const [missing, zero, string] = result.sources.collection.data.features;
  assert.equal(Object.hasOwn(missing, "id"), false);
  assert.equal(zero.id, 0);
  assert.equal(string.id, "route");
  assert.deepEqual(result.sources.remote, style.sources.remote);
  assert.deepEqual(style, original, "Saved render plans must not be mutated");
});
