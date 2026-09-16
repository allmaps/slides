// Build-only child process. MapLibre Native must not run in Vite/SvelteKit workers.
import { getRenderedCameraBuffer, ChiitilerCache } from "chiitiler";

/** @type {Map<number, {resolve: (value: Buffer) => void, reject: (error: Error) => void}>} */
const requests = new Map();
let sequence = 0;
process.on("message", async (/** @type {any} */ message) => {
  if (message.type === "source") {
    const pending = requests.get(message.id);
    requests.delete(message.id);
    if (message.error) pending?.reject(new Error(message.error));
    else pending?.resolve(message.bytes);
    return;
  }
  if (message.type !== "render") return;
  try {
    const fallback = ChiitilerCache.fileCache({ dir: message.cacheDir });
    const bytes = await getRenderedCameraBuffer({
      ...message.options,
      cache: {
        name: "slides",
        get: async (key) => {
          if (!/^https?:\/\//.test(key)) {
            const bytes = await fallback.get(key);
            if (!bytes && message.offline)
              throw new Error(`Offline native source cache miss: ${key}`);
            return bytes;
          }
          return new Promise((resolve, reject) => {
            const id = ++sequence;
            requests.set(id, { resolve, reject });
            process.send?.({ type: "source", id, url: key });
          });
        },
        set: fallback.set,
      },
    });
    process.send?.({ type: "result", id: message.id, bytes });
  } catch (error) {
    process.send?.({ type: "result", id: message.id, error: String(error) });
  }
});
