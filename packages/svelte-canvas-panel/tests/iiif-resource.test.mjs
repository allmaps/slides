import assert from "node:assert/strict";
import { test } from "node:test";
import { loadIiifResource } from "../src/lib/iiif-resource.ts";
import { createIiifWorld } from "../src/lib/atlas-world.ts";

const base = "https://example.org";
const service = {
  "@context": "http://iiif.io/api/image/3/context.json",
  id: `${base}/image`, type: "ImageService3", profile: "level0",
  width: 4064, height: 1951,
  sizes: [{ width: 512, height: 246 }, { width: 1024, height: 492 }],
  tiles: [{ width: 1024, scaleFactors: [1, 2, 4] }],
};
const imageBody = i => ({ id: `${base}/image-${i}.jpg`, type: "Image", width: 1000, height: 800 });
const canvas = i => ({ id: `${base}/canvas/${i}`, type: "Canvas", width: 1000, height: 800,
  items: [{ id: `${base}/page/${i}`, type: "AnnotationPage", items: [{
    id: `${base}/annotation/${i}`, type: "Annotation", motivation: "painting",
    target: `${base}/canvas/${i}`, body: imageBody(i),
  }] }],
});
const manifest = () => ({ "@context": "http://iiif.io/api/presentation/3/context.json",
  id: `${base}/manifest.json`, type: "Manifest", items: [canvas(0), canvas(1)],
});

function mockResources(t, entries) {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    options?.signal?.throwIfAborted();
    requests.push(String(url));
    const value = entries[String(url)];
    return new Response(JSON.stringify(value ?? {}), { status: value ? 200 : 404 });
  });
  return requests;
}
const load = (source, signal = new AbortController().signal) => loadIiifResource(source, base, signal);

test("local level 0 derivatives use advertised sizes and valid API 3 edge tiles", async t => {
  const requests = mockResources(t, { [`${base}/image/info.json`]: { ...service, id: "https://published.example.org/image" } });
  const resource = await load({ type: "image", url: "/image/info.json" });
  const world = createIiifWorld(resource);
  const composite = world.getObjects().find(object => object.layers.length).layers[0];
  const tiles = composite.allImages.filter(layer => "tileWidth" in layer);
  assert.deepEqual(requests, [`${base}/image/info.json`]);
  assert.ok(composite.allImages.some(layer => layer.uri === `${base}/image/full/512,246/0/default.jpg`));
  assert.equal(tiles.find(layer => layer.display.scale === 1).getImageUrl(7), `${base}/image/3072,1024,992,927/992,927/0/default.jpg`);
  assert.equal(tiles.find(layer => layer.display.scale === 2).getImageUrl(1), `${base}/image/2048,0,2016,1951/1008,976/0/default.jpg`);
});

test("remote Image API 2 services keep width-only tile requests", async t => {
  const v2 = { ...service, "@context": "http://iiif.io/api/image/2/context.json", type: "ImageService2", profile: "http://iiif.io/api/image/2/level2.json" };
  mockResources(t, { [`${base}/image/info.json`]: v2 });
  const world = createIiifWorld(await load({ type: "image", url: service.id }));
  const composite = world.getObjects().find(object => object.layers.length).layers[0];
  const tile = composite.allImages.find(layer => "tileWidth" in layer && layer.display.scale === 1);
  assert.equal(tile.getImageUrl(7), `${base}/image/3072,1024,992,927/992,/0/default.jpg`);
});

test("Presentation 3 selects the first or an explicitly requested canvas", async t => {
  const data = manifest();
  mockResources(t, { [data.id]: data });
  assert.equal((await load({ type: "manifest", url: data.id })).images[0].id, imageBody(0).id);
  assert.equal((await load({ type: "manifest", url: data.id, canvas: data.items[1].id })).images[0].id, imageBody(1).id);
  await assert.rejects(load({ type: "manifest", url: data.id, canvas: "missing" }), /Canvas not found/);
});

test("Presentation 2 manifests normalize before image selection", async t => {
  const data = { "@context": "http://iiif.io/api/presentation/2/context.json", "@id": `${base}/v2`, "@type": "sc:Manifest", label: "V2",
    sequences: [{ "@id": `${base}/sequence`, "@type": "sc:Sequence", canvases: [0, 1].map(i => ({
      "@id": `${base}/canvas/${i}`, "@type": "sc:Canvas", width: 1000, height: 800,
      images: [{ "@id": `${base}/annotation/${i}`, "@type": "oa:Annotation", motivation: "sc:painting", on: `${base}/canvas/${i}`,
        resource: { "@id": imageBody(i).id, "@type": "dctypes:Image", width: 1000, height: 800 } }],
    })) }],
  };
  mockResources(t, { [data["@id"]]: data });
  assert.equal((await load({ type: "manifest", url: data["@id"] })).images[0].id, imageBody(0).id);
  assert.equal((await load({ type: "manifest", url: data["@id"], canvas: `${base}/canvas/1` })).images[0].id, imageBody(1).id);
});

test("linked annotation pages and positioned painting images retain canvas bounds", async t => {
  const data = manifest();
  const page = data.items[0].items[0];
  page.items[0].target += "#xywh=100,200,500,400";
  data.items[0].items = [{ id: page.id, type: "AnnotationPage" }];
  const requests = mockResources(t, { [data.id]: data, [page.id]: page });
  const resource = await load({ type: "manifest", url: data.id });
  assert.ok(requests.includes(page.id));
  assert.deepEqual(resource.images[0].target, { x: 100, y: 200, width: 500, height: 400 });
  const world = createIiifWorld(resource);
  world.recalculateWorldSize();
  assert.equal(world.width, 1000);
  assert.equal(world.height, 800);
});

test("failed and cancelled requests reject instead of creating a blank viewer", async t => {
  mockResources(t, {});
  await assert.rejects(load({ type: "image", url: service.id }), /404/);
  await assert.rejects(load({ type: "image", url: service.id }, AbortSignal.abort()), { name: "AbortError" });
});

test("local level 0 image regions keep the complete tiled image available", async t => {
  const requests = mockResources(t, { [`${base}/image/info.json`]: service });
  const resource = await load({ type: "image", url: "/image/info.json#xywh=100,200,800,600" });
  assert.deepEqual(requests, [`${base}/image/info.json`]);
  assert.deepEqual(resource.region, { x: 100, y: 200, width: 800, height: 600 });
  assert.equal(resource.width, 4064);
  assert.equal(resource.images[0].width, 4064);
  const world = createIiifWorld(resource);
  world.recalculateWorldSize();
  assert.equal(world.width, 4064);
});

test("cropped request paths and explicit figure regions select the initial view", async t => {
  mockResources(t, { [`${base}/image/info.json`]: service });
  const url = `${base}/image/100,200,800,600/1024,/0/default.jpg`;
  assert.deepEqual((await load({ type: "image", url })).region, { x: 100, y: 200, width: 800, height: 600 });
  assert.deepEqual((await load({ type: "image", url, region: "0,0,400,300" })).region, { x: 0, y: 0, width: 400, height: 300 });
});

test("manifest and selected-canvas fragments resolve regions in canvas coordinates", async t => {
  const data = manifest();
  const requests = mockResources(t, { [data.id]: data });
  const first = await load({ type: "manifest", url: `${data.id}#xywh=percent:10,20,30,40` });
  const second = await load({ type: "manifest", url: data.id, canvas: `${data.items[1].id}#xywh=100,200,500,400` });
  assert.deepEqual(first.region, { x: 100, y: 160, width: 300, height: 320 });
  assert.equal(first.images[0].id, imageBody(0).id);
  assert.deepEqual(second.region, { x: 100, y: 200, width: 500, height: 400 });
  assert.equal(second.images[0].id, imageBody(1).id);
  assert.ok(requests.every(url => !url.includes("#")));
});

test("canvas IDs with ordinary fragments remain selectable", async t => {
  const data = manifest();
  data.items[1].id = `${data.id}#canvas-2`;
  data.items[1].items[0].items[0].target = data.items[1].id;
  mockResources(t, { [data.id]: data });
  const resource = await load({ type: "manifest", url: data.id, canvas: data.items[1].id, region: "100,200,500,400" });
  assert.equal(resource.images[0].id, imageBody(1).id);
  assert.deepEqual(resource.region, { x: 100, y: 200, width: 500, height: 400 });
});
