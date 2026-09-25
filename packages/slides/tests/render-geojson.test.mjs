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
    sources: { expeditionTrack: { type: "geojson", path: "assets/geojson/track.geojson" } },
    map: { styles: { light: style, dark: style } },
  }));
  const route = { type: "Feature", properties: { stroke: "#64c18f", "stroke-width": 8 },
    geometry: { type: "LineString", coordinates: [[4, 52], [5, 53]] } };
  await writeFile(path.join(root, "assets/geojson/track.geojson"), JSON.stringify(route));
  await writeFile(path.join(root, "chapters/01-first.md"), "---\ntitle: First\nlocation:\n  center: [4, 52]\n  zoom: 4\n---\n");
  await writeFile(path.join(root, "chapters/02-second.md"), "---\ntitle: Second\n---\n");
  await writeFile(path.join(root, "chapters/03-hidden.md"), "---\ntitle: Hidden\nlayers:\n  - layer: user-expeditionTrack-line\n    visibility: none\n---\n");
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
  for (const theme of ["light", "dark"])
    assert(!scene(manifest.slides["main:hidden"][theme]).styles.upper.layers.some(layer => layer.type === "line"));
});
