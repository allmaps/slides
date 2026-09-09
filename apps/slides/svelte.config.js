import adapter from "@sveltejs/adapter-static";
import { mdsvex } from "mdsvex";
import { join } from "path";
import remarkFootnotes from "remark-footnotes";
import removeFootnoteLinks from "./src/lib/shared/remove-footnote-links.js";

const getBasePath = (value) => {
  if (!value) return "";

  try {
    const url = new URL(value);
    return getBasePath(url.pathname);
  } catch {
    // Accept both URL strings and plain path strings.
  }

  const basePath = value.replace(/^\/+|\/+$/g, "");

  return basePath ? `/${basePath}` : "";
};

const basePath = getBasePath(
  process.env.PUBLIC_BASE_PATH ?? process.env.PUBLIC_URL,
);
const normalizePath = (value) => value.replace(/\/+$/g, "") || "/";
const appRootPaths = new Set([
  "/",
  ...(basePath ? [normalizePath(basePath)] : []),
]);

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    // adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
    // If your environment is not supported, or you settled on a specific environment, switch out the adapter.
    // See https://svelte.dev/docs/kit/adapters for more information about adapters.
    adapter: adapter({
      // default options are shown. On some platforms
      // these options are set automatically — see below
      pages: "build",
      assets: "build",
      fallback: undefined,
      precompress: false,
      strict: true,
    }),
    paths: {
      base: basePath,
    },
    prerender: {
      handleMissingId: ({ path, message }) => {
        if (appRootPaths.has(normalizePath(path))) {
          return;
        }

        throw new Error(message);
      },
      handleUnseenRoutes: ({ routes }) => {
        const ignoredRoutes = [
          "/[slideshow]",
          "/api/[...request]",
          "/iiif/[...request]",
        ];
        const unexpectedRoutes = routes.filter(
          (route) => !ignoredRoutes.includes(route),
        );

        if (unexpectedRoutes.length) {
          throw new Error(
            `The following prerenderable routes were not prerendered: ${unexpectedRoutes.join(", ")}`,
          );
        }
      },
    },
    // router: {
    //   type: "hash",
    // },
  },
  preprocess: mdsvex({
    extensions: [".svx", ".md"],
    remarkPlugins: [remarkFootnotes],
    rehypePlugins: [removeFootnoteLinks],
    layout: {
      _: join(import.meta.dirname, "./src/lib/components/Section.svelte"),
    },
  }),
  extensions: [".svelte", ".svx", ".md"],
};

export default config;
