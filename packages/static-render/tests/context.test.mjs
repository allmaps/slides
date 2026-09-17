import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createSourceContext } from "../src/context.ts";

test("a cold source cache preserves the serialized deployment origin for Protomaps", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "slides-origin-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const plan = JSON.parse(
    JSON.stringify({
      publicUrl: "https://amsterdamtimemachine.github.io/kattenburg-atlas/",
    }),
  );
  const seen = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    const headers = new Headers(options.headers);
    seen.push({ url, headers });
    if (new URL(url).hostname === "api.protomaps.com") {
      assert.equal(
        headers.get("origin"),
        "https://amsterdamtimemachine.github.io",
      );
      assert.equal(headers.get("referer"), plan.publicUrl);
      assert.equal(headers.get("user-agent"), "Allmaps-Slides-thumbnails/1.0");
    } else {
      assert.equal(headers.get("origin"), null);
      assert.equal(headers.get("referer"), null);
    }
    return Response.json({ tiles: ["https://example.org/{z}/{x}/{y}"] });
  });
  const context = await createSourceContext({
    ...plan,
    assets: { images: {}, data: {} },
    assetRoot: root,
    cacheRoot: root,
    epoch: 1,
  });
  const url = "https://api.protomaps.com/tiles/v4.json?key=test";
  await context.sources.get(url);
  await context.sources.get(url);
  await context.sources.get("https://images.example.org/info.json");
  assert.equal(seen.length, 2);
  assert.equal(context.sources.remote.options.staleIfError, true);
  assert.equal(context.annotations.options.staleIfError, undefined);
});
