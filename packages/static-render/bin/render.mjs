#!/usr/bin/env node
import { existsSync } from "node:fs";
const source = new URL("../src/cli.js", import.meta.url);
await import(existsSync(source) ? source.href : new URL("../dist/cli.js", import.meta.url).href);
