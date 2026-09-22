import assert from "node:assert/strict";
import { test } from "node:test";
import { parseConfigDocument, parseFrontmatter } from "../src/model/config.ts";
import {
  parseSlidesConfig,
  slideMetadataSchema,
} from "../src/model/content-schema.ts";
import { buildProject } from "../src/model/project.ts";
import {
  getEffectiveBasemapStyleConfig,
  resolveBasemapStyle,
} from "../src/model/basemap.ts";

test("config and frontmatter use one normalization contract without runtime globals", () => {
  const raw = parseConfigDocument(
    "title: ${TITLE}\nslideshows:\n - id: story\n   path: chapters\niiif:\n  tiles: false",
    "slides.config.yml",
    { TITLE: "Atlas" },
  );
  const parsed = parseSlidesConfig(raw, "fixture");
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.main, "story");
  assert.equal(parsed.data.title, "Atlas");
  const slide = slideMetadataSchema.parse(
    parseFrontmatter(
      "---\ntitle: Test\nwarpedMaps:\n  path: assets/map.json\n---\nBody",
    ),
  );
  assert.equal(slide.warpedMaps[0].url, "assets/map.json");
  assert.throws(() => parseFrontmatter("---\ntitle: One\ntitle: Two\n---"));
});
test("project ordering, asset adapters and references are independent of Svelte", () => {
  const config = {
    title: "Atlas",
    main: "main",
    slideshows: [
      { id: "main", path: "chapters" },
      { id: "detail", path: "details" },
    ],
    sources: { places: { type: "geojson", path: "assets/places.json" } },
  };
  const files = {
    "chapters/02-later.md": { metadata: { title: "Later" } },
    "chapters/01-first.md": {
      metadata: {
        title: "First",
        subslideshows: "detail",
        warpedMaps: { url: "assets/map.json" },
      },
    },
  };
  const project = buildProject(config, files, (p) => "/content/" + p);
  assert.deepEqual(
    project.slideshows[0].chapters.map((c) => c.slug),
    ["first", "later"],
  );
  assert.equal(
    project.slideshows[0].chapters[0].warpedMaps[0].url,
    "/content/assets/map.json",
  );
  assert.equal(project.slideshows[0].slug, "");
  assert.equal(project.slideshows[1].slug, "detail");
  assert(!JSON.stringify(project).includes("Component"));
  assert.throws(
    () =>
      buildProject({ ...config, slideshows: [config.slideshows[0]] }, files),
    /Unknown subslideshow/,
  );
  assert.throws(
    () =>
      buildProject(config, {
        ...files,
        "chapters/03-first.md": { metadata: { title: "Duplicate" } },
      }),
    /Duplicate slide slug/,
  );
});
test("basemap dependencies are injected while visibility and inheritance stay shared", async () => {
  const config = getEffectiveBasemapStyleConfig({
    theme: "dark",
    appMap: { styles: { dark: "fixture.json" } },
  });
  const resolved = await resolveBasemapStyle({
    theme: "dark",
    config,
    strict: true,
    mapStyleFiles: {
      "./assets/map-styles/fixture.json": {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#123456" },
          },
        ],
      },
    },
  });
  assert.equal(resolved.foregroundColor, "#123456");
  assert.deepEqual(resolved.baseLayerIds, ["basemap:background"]);
});
