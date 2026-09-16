import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  RemoteCache,
  RenderCache,
} from "../src/lib/server/thumbnails/cache.ts";

async function temporary(t) {
  const root = await mkdtemp(path.join(tmpdir(), "slides-cache-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("annotation snapshots survive clearing thumbnails and deduplicate concurrent fetches", async (t) => {
  const root = await temporary(t);
  let calls = 0;
  const fetch = async () => {
    calls++;
    return Response.json({ value: 1 }, { headers: { etag: '"v1"' } });
  };
  const annotations = new RemoteCache(path.join(root, "annotations"), 1, {
    fetch,
  });
  const [a, b] = await Promise.all([
    annotations.get("https://example.org/map"),
    annotations.get("https://example.org/map"),
  ]);
  assert.equal(calls, 1);
  assert.equal(a.hash, b.hash);
  const thumbs = new RenderCache(path.join(root, "thumbnails"));
  await thumbs.get({ annotation: a.hash }, async () => Buffer.from("image"));
  await rm(thumbs.root, { recursive: true });
  const restarted = new RemoteCache(annotations.root, 1, { fetch });
  assert.equal((await restarted.get("https://example.org/map")).hash, a.hash);
  assert.equal(calls, 1);
});

test("expiry revalidates with ETag; changed content changes downstream render identity", async (t) => {
  const root = await temporary(t);
  const url = "https://example.org/map";
  const first = await new RemoteCache(root, 1, {
    fetch: async () => new Response("v1", { headers: { etag: '"one"' } }),
  }).get(url);
  const unchanged = await new RemoteCache(root, 2, {
    fetch: async (_, options) => {
      assert.equal(options.headers["If-None-Match"], '"one"');
      return new Response(null, { status: 304 });
    },
  }).get(url);
  assert.equal(first.hash, unchanged.hash);
  const changed = await new RemoteCache(root, 3, {
    fetch: async () => new Response("v2"),
  }).get(url);
  assert.notEqual(changed.hash, first.hash);
  let renders = 0;
  const render = async () => {
    renders++;
    return Buffer.from("pixels");
  };
  const output = new RenderCache(path.join(root, "output"));
  await output.get({ annotation: first.hash }, render);
  await output.get({ annotation: unchanged.hash }, render);
  await output.get({ annotation: changed.hash }, render);
  assert.equal(renders, 2);
});

test("offline requires a complete snapshot; failed requests and renders are never cached", async (t) => {
  const root = await temporary(t);
  const url = "https://example.org/map";
  await assert.rejects(
    new RemoteCache(root, 1, { offline: true }).get(url),
    /Offline cache miss/,
  );
  await assert.rejects(
    new RemoteCache(root, 1, {
      fetch: async () => new Response("missing", { status: 404 }),
    }).get(url),
    /HTTP 404/,
  );
  assert.deepEqual(await readdir(root), []);
  const value = await new RemoteCache(root, 1, {
    fetch: async () => new Response("snapshot"),
  }).get(url);
  const offline = await new RemoteCache(root, 100, {
    offline: true,
    fetch: async () => {
      throw Error("Must not fetch");
    },
  }).get(url);
  assert.equal(offline.hash, value.hash);
  const output = new RenderCache(path.join(root, "output"));
  await assert.rejects(
    output.get({}, async () => {
      throw Error("render failure");
    }),
    /render failure/,
  );
  assert.equal(
    (await output.get({}, async () => Buffer.from("complete"))).toString(),
    "complete",
  );
});

test("cache hits survive a new process instance and force refresh revalidates fresh entries", async (t) => {
  const root = await temporary(t);
  const first = new RenderCache(path.join(root, "output"));
  await first.get({ camera: 1 }, async () => Buffer.from("cached"));
  const second = new RenderCache(first.root);
  assert.equal(
    (
      await second.get({ camera: 1 }, async () => {
        throw Error("Unexpected render");
      })
    ).toString(),
    "cached",
  );
  const options = { fetch: async () => new Response("old") };
  const url = "https://example.org/map";
  const old = await new RemoteCache(root, 1, options).get(url);
  const refreshed = await new RemoteCache(root, 1, {
    refresh: true,
    fetch: async () => new Response("new"),
  }).get(url);
  assert.notEqual(old.hash, refreshed.hash);
});

test("invalid annotation bodies do not replace a valid snapshot", async (t) => {
  const root = await temporary(t);
  const url = "https://example.org/map";
  const validate = (bytes) => JSON.parse(bytes.toString());
  const good = await new RemoteCache(root, 1, {
    validate,
    fetch: async () => Response.json({ map: 1 }),
  }).get(url);
  await assert.rejects(
    new RemoteCache(root, 2, {
      validate,
      fetch: async () => new Response("broken json"),
    }).get(url),
  );
  const retained = await new RemoteCache(root, 2, { offline: true }).get(url);
  assert.equal(retained.hash, good.hash);
});
