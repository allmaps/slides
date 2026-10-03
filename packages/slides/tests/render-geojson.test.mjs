import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadSlidesConfig } from "../src/content/config.ts";
import { loadContent } from "../src/content/index.ts";
import { prepareThumbnails } from "../src/build/prepare.ts";

test("content GeoJSON appears in slide and social scenes and respects per-slide visibility", async t => {
  const root = await mkdtemp(path.join(tmpdir(), "slides-geojson-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "chapters"));
  await mkdir(path.join(root, "assets/geojson"), { recursive: true });
  const style = { version: 8, sources: {}, layers: [{
    id: "background", type: "background", paint: { "background-color": "#ffffff" },
  }] };
  await writeFile(path.join(root, "slides.config.yml"), JSON.stringify({
    title: "GeoJSON story", main: "main", slideshows: [{ id: "main", path: "chapters" }],
    socialImage: { textOverlay: true },
    sources: { expeditionTrack: { type: "geojson", path: "assets/geojson/track.geojson" } },
    map: { styles: { light: style, dark: style } },
  }));
  const route = { type: "Feature", properties: { stroke: "#64c18f", "stroke-width": 8 },
    geometry: { type: "LineString", coordinates: [[4, 52], [5, 53]] } };
  await writeFile(path.join(root, "assets/geojson/track.geojson"), JSON.stringify(route));
  await writeFile(path.join(root, "chapters/01-first.md"), "---\ntitle: First\nlocation:\n  center: [4, 52]\n  zoom: 4\n---\n");
  await writeFile(path.join(root, "chapters/02-second.md"), "---\ntitle: Second\n---\n");
  await writeFile(path.join(root, "chapters/03-hidden.md"), "---\ntitle: Hidden\nlayers:\n  - layer: expeditionTrack-line\n    visibility: none\n---\n");
  const content = await loadContent(await loadSlidesConfig({ content: root }));
  const { plan, manifest } = await prepareThumbnails(content, {
    assetRoot: root, cacheRoot: path.join(root, "cache"),
    annotationsRoot: path.join(root, "annotations"), offline: true, refresh: false,
  });
  const scene = thumbnail => plan.jobs.find(job => job.id === thumbnail.path);
  for (const slug of ["first", "second"]) {
    for (const theme of ["light", "dark"]) {
      const upper = scene(manifest.slides[`main:${slug}`][theme]).styles.upper;
      assert.deepEqual(upper.sources.expeditionTrack.data, route);
      assert(upper.layers.some(layer => layer.type === "line" && layer.source === "expeditionTrack"));
    }
  }
  assert(scene(manifest.social.main).styles.upper.layers.some(layer => layer.type === "line"));
  assert.equal(scene(manifest.social.main).textOverlay.title, 'GeoJSON story');
  assert.equal(plan.fonts.title.family, 'League Spartan');
  assert.ok(plan.fonts.title.base64);
  for (const previews of Object.values(manifest.slides))
    for (const image of Object.values(previews)) assert.equal(scene(image).textOverlay, undefined);
  for (const theme of ["light", "dark"])
    assert(!scene(manifest.slides["main:hidden"][theme]).styles.upper.layers.some(layer => layer.type === "line"));
});

test('thumbnail layers reset after overrides and include custom GeoJSON text without a basemap', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'slides-labels-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'chapters'));
  await mkdir(path.join(root, 'assets/geojson'), { recursive: true });
  const places = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { Naam: 'Oude Kerk 1306' },
    geometry: { type: 'Point', coordinates: [4.898, 52.374] } }] };
  await writeFile(path.join(root, 'assets/geojson/places.geojson'), JSON.stringify(places));
  await writeFile(path.join(root, 'slides.config.yml'), JSON.stringify({
    title: 'Labels', sources: { places: { type: 'geojson', path: 'assets/geojson/places.geojson' } },
    layers: [
      { layer: 'places-point-circle', visibility: 'none' },
      { id: 'labels', source: 'places', type: 'symbol', layout: {
        visibility: 'none', 'text-field': ['get', 'Naam'], 'text-font': ['Noto Sans Regular'],
      } },
    ],
    slideshows: [{ id: 'main', path: 'chapters', start: { layers: [{ layer: 'labels', visibility: 'visible' }] } }],
  }));
  await writeFile(path.join(root, 'chapters/01-labels.md'), '---\ntitle: Labels\nlayers:\n - layer: labels\n   visibility: visible\n   opacity: 0.5\n---\n');
  await writeFile(path.join(root, 'chapters/02-defaults.md'), '---\ntitle: Defaults\n---\n');
  await writeFile(path.join(root, 'chapters/03-labels-again.md'), '---\ntitle: Labels again\nlayers:\n - layer: labels\n   visibility: visible\n---\n');
  const content = await loadContent(await loadSlidesConfig({ content: root }));
  const { plan, manifest } = await prepareThumbnails(content, {
    assetRoot: root, cacheRoot: path.join(root, 'cache'), annotationsRoot: path.join(root, 'annotations'), offline: true, refresh: false,
  });
  const scene = image => plan.jobs.find(job => job.id === image.path).styles.upper;
  for (const theme of ['light', 'dark']) {
    const first = scene(manifest.slides['main:labels'][theme]);
    const reset = scene(manifest.slides['main:defaults'][theme]);
    const again = scene(manifest.slides['main:labels-again'][theme]);
    assert.deepEqual(first.sources.places.data, places);
    assert.deepEqual(first.layers.find(layer => layer.id === 'user-labels').layout['text-field'], ['get', 'Naam']);
    assert.equal(first.layers.find(layer => layer.id === 'user-labels').paint['text-opacity'], 0.5);
    assert.ok(first.glyphs);
    assert.equal(reset.layers.some(layer => layer.id === 'user-labels'), false);
    assert.equal(reset.layers.some(layer => layer.type === 'circle'), false);
    assert.equal(again.layers.find(layer => layer.id === 'user-labels').paint?.['text-opacity'], undefined);
    assert.equal(again.layers.filter(layer => layer.id.startsWith('user-user-')).length, 0);
  }
  assert.equal(scene(manifest.social.main).layers.find(layer => layer.id === 'user-labels').paint['text-opacity'], 0.5);
});
