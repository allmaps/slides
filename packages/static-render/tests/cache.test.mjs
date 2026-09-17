import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { RemoteCache, RenderCache } from "../src/cache.ts";

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

function immediateRetries(t) {
  const delays = [];
  t.mock.method(globalThis, "setTimeout", (callback, delay, ...args) => {
    delays.push(delay);
    return setImmediate(callback, ...args);
  });
  return delays;
}

test("temporary failures can recover beyond the old three-attempt window", async (t) => {
  const root = await temporary(t);
  const delays = immediateRetries(t);
  let calls = 0;
  const cache = new RemoteCache(root, 1, {
    fetch: async () => {
      calls++;
      if (calls <= 3)
        return new Response("upstream failure", {
          status: calls === 1 ? 408 : 500,
        });
      return Response.json({ tiles: ["https://example.org/{z}/{x}/{y}"] });
    },
  });
  const resource = await cache.get("https://example.org/tiles.json");
  assert(JSON.parse(resource.bytes.toString()).tiles.length);
  assert.equal(calls, 4);
  assert.deepEqual(delays, [1000, 2000, 4000]);
});

test("retries honor bounded Retry-After and recover interrupted response bodies", async (t) => {
  const root = await temporary(t);
  const delays = immediateRetries(t);
  let calls = 0;
  const resource = await new RemoteCache(root, 1, {
    fetch: async () => {
      calls++;
      if (calls === 1)
        return new Response(null, {
          status: 429,
          headers: { "retry-after": "20" },
        });
      if (calls === 2)
        return new Response(null, {
          status: 503,
          headers: {
            "retry-after": new Date(Date.now() + 120_000).toUTCString(),
          },
        });
      if (calls === 3)
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new Error("connection reset"));
            },
          }),
        );
      return new Response("complete body");
    },
  }).get("https://example.org/tiles.json");
  assert.equal(resource.bytes.toString(), "complete body");
  assert.deepEqual(delays, [20_000, 30_000, 4000]);
});

test("source outages reuse a prior snapshot once per batch without advancing its epoch", async (t) => {
  const root = await temporary(t);
  immediateRetries(t);
  const warnings = [];
  t.mock.method(console, "warn", (warning) => warnings.push(warning));
  const url = "https://example.org/tiles.json";
  const first = await new RemoteCache(root, 1, {
    fetch: async () =>
      new Response("last good source", { headers: { etag: '"old"' } }),
  }).get(url);
  let attempts = 0;
  const unavailable = new RemoteCache(root, 2, {
    staleIfError: true,
    fetch: async () => {
      attempts++;
      return new Response(null, { status: 500 });
    },
  });
  assert.equal((await unavailable.get(url)).hash, first.hash);
  assert.equal((await unavailable.get(url)).hash, first.hash);
  assert.equal(attempts, 5);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /using previously cached source \(epoch 1\)/);
  let revalidated = false;
  const recovered = await new RemoteCache(root, 2, {
    fetch: async (_, { headers }) => {
      revalidated = true;
      assert.equal(headers["If-None-Match"], '"old"');
      return new Response("recovered source");
    },
  }).get(url);
  assert(revalidated);
  assert.notEqual(recovered.hash, first.hash);
});

test("cold outages, force refresh, annotations and permanent errors still fail", async (t) => {
  const root = await temporary(t);
  immediateRetries(t);
  const url = "https://example.org/tiles.json";
  const unavailable = async () => new Response(null, { status: 500 });
  await assert.rejects(
    new RemoteCache(root, 1, { staleIfError: true, fetch: unavailable }).get(
      url,
    ),
    /HTTP 500.*after 5 attempts/,
  );
  assert.deepEqual(await readdir(root), []);
  await new RemoteCache(root, 1, {
    fetch: async () => new Response("good"),
  }).get(url);
  for (const options of [{ staleIfError: true, refresh: true }, {}])
    await assert.rejects(
      new RemoteCache(root, 2, { ...options, fetch: unavailable }).get(url),
      /HTTP 500/,
    );
  for (const status of [401, 403, 404]) {
    let attempts = 0;
    await assert.rejects(
      new RemoteCache(root, 2, {
        staleIfError: true,
        fetch: async () => {
          attempts++;
          return new Response(null, { status });
        },
      }).get(url),
      new RegExp(`HTTP ${status}`),
    );
    assert.equal(attempts, 1);
  }
});
