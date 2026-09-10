import assert from "node:assert/strict";
import { test } from "node:test";
import { thumbnailUrl } from "../src/lib/image-url.ts";

const service = { "@context": "http://iiif.io/api/image/3/context.json", id: "https://example.org/image", type: "ImageService3", profile: "level0", width: 4000, height: 2000 };

test("level 0 thumbnails use an advertised size without downloading pixels during selection", () => {
  const url = thumbnailUrl({ ...service, sizes: [{ width: 1024, height: 512 }, { width: 512, height: 256 }] });
  assert.equal(url, `${service.id}/full/512,256/0/default.jpg`);
  assert.equal(thumbnailUrl(service), undefined);
  assert.equal(thumbnailUrl(), undefined);
});

test("resizable services can supply a small thumbnail even without advertised sizes", () => {
  assert.equal(thumbnailUrl({ ...service, profile: "level2" }), `${service.id}/full/512,256/0/default.jpg`);
});
