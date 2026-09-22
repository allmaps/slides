import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
const stableStringify = (value: unknown) => JSON.stringify(value, (_, entry) =>
  entry && typeof entry === "object" && !Array.isArray(entry)
    ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b))) : entry);

export const digest = (data: string | Uint8Array) =>
  createHash("sha256").update(data).digest("hex");
export const recipeHash = (value: unknown) => digest(stableStringify(value));

export async function atomicWrite(filename: string, data: string | Uint8Array) {
  await mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${randomUUID()}.tmp`;
  await writeFile(temporary, data);
  await rename(temporary, filename);
}

export async function readJson<T>(filename: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(filename, "utf8"));
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code === "ENOENT" ||
      error instanceof SyntaxError
    )
      return undefined;
    throw error;
  }
}

type Entry = {
  hash: string;
  epoch: number;
  type: string;
  etag?: string;
  modified?: string;
};
export type CachedResource = { bytes: Buffer; hash: string; type: string };
type RemoteCacheOptions = {
  offline?: boolean;
  refresh?: boolean;
  fetch?: typeof fetch;
  validate?: (bytes: Buffer) => void;
  /** Reuse a previous source after temporary failures; force refresh stays strict. */
  staleIfError?: boolean;
};

class RemoteFetchError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.retryable = retryable;
  }
}

const RETRY_ATTEMPTS = 5;
const MAX_RETRY_DELAY_MS = 30_000;

function retryDelay(response: Response | undefined, attempt: number) {
  const value = response?.headers.get("retry-after");
  const requested = value
    ? /^\d+$/.test(value)
      ? Number(value) * 1000
      : Date.parse(value) - Date.now()
    : 0;
  return Math.min(
    MAX_RETRY_DELAY_MS,
    Math.max(1000 * 2 ** attempt, Number.isFinite(requested) ? requested : 0),
  );
}

async function fetchResource(
  url: string,
  headers: Record<string, string>,
  fetchFn: typeof fetch,
) {
  let failure: RemoteFetchError | undefined;
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    let response: Response | undefined;
    try {
      response = await fetchFn(url, {
        headers,
        signal: AbortSignal.timeout(30_000),
      });
      if (response.status === 304) return { response };
      if (response.ok)
        return { response, bytes: Buffer.from(await response.arrayBuffer()) };
      failure = new RemoteFetchError(
        `Fetching ${url}: HTTP ${response.status}`,
        response.status === 408 ||
          response.status === 429 ||
          response.status >= 500,
      );
      await response.body?.cancel().catch(() => {});
    } catch (error) {
      failure = new RemoteFetchError(`Fetching ${url}: ${String(error)}`, true);
    }
    if (!failure?.retryable) throw failure;
    if (attempt + 1 < RETRY_ATTEMPTS)
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelay(response, attempt)),
      );
  }
  throw new RemoteFetchError(
    `${failure?.message} (after ${RETRY_ATTEMPTS} attempts)`,
    true,
  );
}

/** Independent stores can share policy without mixing annotations with image tiles. */
export class RemoteCache {
  private pending = new Map<string, Promise<CachedResource>>();
  private stale = new Map<string, CachedResource>();
  hits = 0;
  downloads = 0;
  readonly root: string;
  readonly epoch: number;
  readonly options: RemoteCacheOptions;
  constructor(root: string, epoch: number, options: RemoteCacheOptions = {}) {
    this.root = root;
    this.epoch = epoch;
    this.options = options;
  }

  get(url: string): Promise<CachedResource> {
    const stale = this.stale.get(url);
    if (stale) {
      this.hits++;
      return Promise.resolve(stale);
    }
    const existing = this.pending.get(url);
    if (existing) return existing;
    const promise = this.load(url).finally(() => this.pending.delete(url));
    this.pending.set(url, promise);
    return promise;
  }

  private async load(url: string): Promise<CachedResource> {
    const metadataPath = path.join(this.root, `${digest(url)}.json`);
    const entry = await readJson<Entry>(metadataPath);
    let bytes: Buffer | undefined;
    if (entry) {
      try {
        bytes = await readFile(path.join(this.root, `${entry.hash}.bin`));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    if (
      entry &&
      bytes &&
      (this.options.offline ||
        (!this.options.refresh && entry.epoch === this.epoch))
    ) {
      this.hits++;
      return { bytes, hash: entry.hash, type: entry.type };
    }
    if (this.options.offline) throw new Error(`Offline cache miss: ${url}`);
    const headers: Record<string, string> = {
      "User-Agent": "Allmaps-Slides-thumbnails/1.0",
    };
    if (bytes && entry?.etag) headers["If-None-Match"] = entry.etag;
    if (bytes && entry?.modified) headers["If-Modified-Since"] = entry.modified;
    let fetched: Awaited<ReturnType<typeof fetchResource>>;
    try {
      fetched = await fetchResource(url, headers, this.options.fetch ?? fetch);
    } catch (error) {
      if (
        error instanceof RemoteFetchError &&
        error.retryable &&
        this.options.staleIfError &&
        !this.options.refresh &&
        entry &&
        bytes
      ) {
        this.hits++;
        console.warn(
          `[static-render] ${error.message}; using previously cached source (epoch ${entry.epoch})`,
        );
        // Leave its epoch unchanged so a later source request can revalidate it.
        const resource = { bytes, hash: entry.hash, type: entry.type };
        this.stale.set(url, resource);
        return resource;
      }
      throw error;
    }
    const { response } = fetched;
    if (response?.status === 304 && entry && bytes) {
      await atomicWrite(
        metadataPath,
        JSON.stringify({ ...entry, epoch: this.epoch }),
      );
      this.hits++;
      return { bytes, hash: entry.hash, type: entry.type };
    }
    if (!response?.ok)
      throw new Error(`Fetching ${url}: HTTP ${response?.status}`);
    bytes = fetched.bytes;
    if (!bytes?.length) throw new Error(`Empty response: ${url}`);
    this.options.validate?.(bytes);
    const metadata: Entry = {
      hash: digest(bytes),
      epoch: this.epoch,
      type: response.headers.get("content-type") ?? "application/octet-stream",
      etag: response.headers.get("etag") ?? undefined,
      modified: response.headers.get("last-modified") ?? undefined,
    };
    // Metadata becomes visible only after the immutable body is complete.
    await atomicWrite(path.join(this.root, `${metadata.hash}.bin`), bytes);
    await atomicWrite(metadataPath, JSON.stringify(metadata));
    this.downloads++;
    return { bytes, hash: metadata.hash, type: metadata.type };
  }
}

export class RenderCache {
  rendered = 0;
  reused = 0;
  private pending = new Map<string, Promise<Buffer>>();
  readonly root: string;
  constructor(root: string) {
    this.root = root;
  }
  async get(recipe: unknown, render: () => Promise<Buffer>): Promise<Buffer> {
    const key = recipeHash(recipe);
    let pending = this.pending.get(key);
    if (!pending) {
      pending = (async () => {
        const filename = path.join(this.root, `${key}.png`);
        try {
          const buffer = await readFile(filename);
          this.reused++;
          return buffer;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        const buffer = await render();
        await atomicWrite(filename, buffer);
        this.rendered++;
        return buffer;
      })().finally(() => this.pending.delete(key));
      this.pending.set(key, pending);
    }
    return pending;
  }
}
