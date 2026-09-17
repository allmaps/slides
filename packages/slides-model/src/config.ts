import { parse } from "yaml";
export function expandEnvironment(
  value: unknown,
  env: Record<string, string | undefined>,
): unknown {
  if (typeof value === "string")
    return value.replace(
      /\$\{([A-Z0-9_]+)\}/gi,
      (_, name: string) => env[name] ?? "",
    );
  if (Array.isArray(value))
    return value.map((entry) => expandEnvironment(entry, env));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        expandEnvironment(entry, env),
      ]),
    );
  return value;
}
export function parseConfigDocument(
  raw: string,
  filename: string,
  env: Record<string, string | undefined> = {},
) {
  return expandEnvironment(
    filename.endsWith(".json") ? JSON.parse(raw) : (parse(raw) ?? {}),
    env,
  );
}
export function parseFrontmatter(markdown: string): unknown {
  const match = markdown
    .replace(/^\uFEFF/, "")
    .match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  return match ? parse(match[1]) : undefined;
}
