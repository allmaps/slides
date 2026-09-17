import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { stableStringify } from "@allmaps/slides-model/map/annotations";

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
};

/** Independent stores can share policy without mixing annotations with image tiles. */
export class RemoteCache {
  private pending = new Map<string, Promise<CachedResource>>();
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
    let response: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await (this.options.fetch ?? fetch)(url, {
          headers,
          signal: AbortSignal.timeout(30_000),
        });
        if (response.status !== 429 && response.status < 500) break;
        if (attempt === 2) break;
        await response.body?.cancel();
      } catch (error) {
        if (attempt === 2) throw new Error(`Fetching ${url}: ${String(error)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
    }
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
    bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) throw new Error(`Empty response: ${url}`);
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
