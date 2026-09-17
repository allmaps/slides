import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { renderLocalIiifRequest, getScaleFactors } from "../src/image.ts";
import { buildStaticIiif, parseIiifOptions } from "../src/core.ts";

test("local IIIF metadata and cropped tiles use the actual source dimensions", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "slides-iiif-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const filename = path.join(root, "source.png");
  const raw = Buffer.alloc(800 * 600 * 3);
  for (let y = 0; y < 600; y++)
    for (let x = 0; x < 800; x++)
      raw[(y * 800 + x) * 3 + (x < 400 ? 0 : 2)] = 255;
  await sharp(raw, { raw: { width: 800, height: 600, channels: 3 } })
    .png()
    .toFile(filename);
  const info = JSON.parse(
    (
      await renderLocalIiifRequest(
        filename,
        "info.json",
        "https://example.org/image",
      )
    ).bytes,
  );
  assert.deepEqual([info.width, info.height], [800, 600]);
  assert.deepEqual(info.tiles[0].scaleFactors, [1, 2]);
  assert.equal(info.profile, "level0");
  assert(info.extraFeatures.includes("regionByPx"));
  const tile = await renderLocalIiifRequest(
    filename,
    "400,0,400,600/100,150/0/default.jpg",
    info.id,
  );
  const { data, info: decoded } = await sharp(tile.bytes)
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.deepEqual([decoded.width, decoded.height], [100, 150]);
  assert(data[2] > 240 && data[0] < 10);
  await assert.rejects(
    () =>
      renderLocalIiifRequest(filename, "799,0,2,1/1,1/0/default.jpg", info.id),
    /outside/,
  );
  await assert.rejects(
    () => renderLocalIiifRequest(filename, "full/0,0/0/default.jpg", info.id),
    /Invalid/,
  );
  assert.deepEqual(
    getScaleFactors({ width: 2049, height: 1024 }, 512),
    [1, 2, 4, 8],
  );
  // The same image primitives also continue to produce the public static catalog.
  const options = parseIiifOptions(
    "https://example.org",
    {
      input: root,
      output: path.join(root, "out"),
      tiles: true,
      sizes: true,
      webp: false,
      tileSize: "512",
    },
    { inputRoot: root, outputRoot: path.join(root, "out") },
  );
  const result = await buildStaticIiif(options);
  assert(result.files.includes("source/info.json"));
  const staticInfo = JSON.parse(
    await readFile(path.join(root, "out/source/info.json"), "utf8"),
  );
  assert.deepEqual(
    [staticInfo.width, staticInfo.height],
    [info.width, info.height],
  );
  const full = await sharp(
    path.join(root, "out/source/full/max/0/default.jpg"),
  ).metadata();
  assert.deepEqual([full.width, full.height], [800, 600]);
});
