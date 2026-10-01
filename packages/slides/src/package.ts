import path from "node:path";
import { fileURLToPath } from "node:url";

// Self-resolution works from source files and from any emitted bundle chunk.
export const packageRoot = path.dirname(fileURLToPath(import.meta.resolve("@allmaps/slides/package.json")));
