import { fork, type ChildProcess } from "node:child_process";
import path from "node:path";
import type { StyleSpecification } from "maplibre-gl";
import type { Camera } from "$lib/shared/map/camera";
import type { Sources } from "./sources.ts";

/** Long-lived child: native contexts are reused without loading them in SSR workers. */
export class NativeRenderer {
  private child?: ChildProcess;
  private sequence = 0;
  private pending = new Map<
    number,
    {
      resolve: (bytes: Buffer) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  constructor(
    private sources: Sources,
    private cacheDir: string,
  ) {}

  render(
    style: StyleSpecification,
    camera: Camera,
    size: [number, number],
  ): Promise<Buffer> {
    if (!this.child) {
      const child = fork(
        path.resolve("src/lib/server/thumbnails/native-worker.mjs"),
        [],
        {
          serialization: "advanced",
          stdio: ["ignore", "inherit", "inherit", "ipc"],
        },
      );
      this.child = child;
      child.on(
        "message",
        async (message: {
          type: string;
          id: number;
          url?: string;
          bytes?: Buffer;
          error?: string;
        }) => {
          if (message.type === "source" && message.url) {
            try {
              const resource = await this.sources.get(message.url);
              if (child.connected)
                child.send({
                  type: "source",
                  id: message.id,
                  bytes: resource.bytes,
                });
            } catch (error) {
              if (child.connected)
                child.send({
                  type: "source",
                  id: message.id,
                  error: String(error),
                });
            }
          } else if (message.type === "result") {
            const job = this.pending.get(message.id);
            if (!job) return;
            clearTimeout(job.timer);
            this.pending.delete(message.id);
            if (message.error || !message.bytes)
              job.reject(
                new Error(
                  message.error ?? "Native renderer returned no pixels",
                ),
              );
            else job.resolve(message.bytes);
          }
        },
      );
      const fail = (error: Error) => {
        for (const job of this.pending.values()) {
          clearTimeout(job.timer);
          job.reject(error);
        }
        this.pending.clear();
        if (this.child === child) this.child = undefined;
      };
      child.on("error", fail);
      child.on("exit", (code, signal) =>
        fail(new Error(`Native thumbnail renderer exited: ${signal ?? code}`)),
      );
    }
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.close();
        reject(new Error("Native thumbnail render timed out"));
      }, 120_000);
      this.pending.set(id, { resolve, reject, timer });
      this.child!.send({
        type: "render",
        id,
        cacheDir: this.cacheDir,
        offline: this.sources.remote.options.offline,
        options: {
          stylejson: style,
          ...camera,
          width: size[0],
          height: size[1],
          pitch: 0,
          ext: "png",
          quality: 100,
        },
      });
    });
  }

  close() {
    this.child?.kill();
    this.child = undefined;
  }
}
