import assert from "node:assert/strict";
import { test } from "node:test";
import { getIiifRequest, getRegionFragment, resolveRegion, selectCanvas } from "../src/lib/iiif-source.ts";

test("canvas selection defaults to the first canvas or uses an explicit ID", () => {
  const manifest = { items: [{ id: "first" }, { id: "second" }] };
  assert.equal(selectCanvas(manifest), "first");
  assert.equal(selectCanvas(manifest, "second"), "second");
  assert.throws(() => selectCanvas(manifest, "missing"), /Canvas not found/);
  assert.throws(() => selectCanvas({ items: [] }), /no canvases/);
});

test("IIIF request recognition preserves encoded identifiers and query parameters", () => {
  const src = "https://example.org/iiif/a%2Fb/full/1024,/0/default.jpg?key=public";
  assert.deepEqual(getIiifRequest(src), {
    serviceUrl: "https://example.org/iiif/a%2Fb?key=public",
    infoUrl: "https://example.org/iiif/a%2Fb/info.json?key=public",
  });
  assert.equal(getIiifRequest("https://example.org/iiif/a/info.json").serviceUrl, "https://example.org/iiif/a");
});

test("ordinary images, rotations and distorted requests retain their rendering", () => {
  for (const src of ["photo.jpg", "https://example.org/photo.jpg", "https://example.org/iiif/a/full/1024,/90/default.jpg", "https://example.org/iiif/a/full/1024,200/0/default.jpg"]) {
    assert.equal(getIiifRequest(src), undefined);
  }
});

test("cropped IIIF image URLs retain their region", () => {
  for (const region of ["10,20,300,200", "pct:10,20,30.5,40"]) {
    const src = `https://example.org/iiif/a%2Fb/${region}/1024,/0/default.jpg?key=public`;
    assert.deepEqual(getIiifRequest(src), {
      serviceUrl: "https://example.org/iiif/a%2Fb?key=public",
      infoUrl: "https://example.org/iiif/a%2Fb/info.json?key=public",
      region,
    });
  }
});

test("xywh fragments support pixel and percentage regions with bounds validation", () => {
  const size = { width: 1000, height: 800 };
  assert.equal(getRegionFragment("assets/images/photo.jpg#xywh=100,200,300,400"), "100,200,300,400");
  assert.deepEqual(resolveRegion("percent:10,20,30,40", size), { x: 100, y: 160, width: 300, height: 320 });
  assert.deepEqual(resolveRegion("pct:10,20,30,40", size), resolveRegion("percent:10,20,30,40", size));
  assert.deepEqual(resolveRegion("pixel:900,700,300,200", size), { x: 900, y: 700, width: 100, height: 100 });
  for (const invalid of ["", "1,2,3", "-1,0,100,100", "0,0,0,100", "1000,0,100,100", "percent:110,0,5,5"]) {
    assert.throws(() => resolveRegion(invalid, size), /region/);
  }
});
