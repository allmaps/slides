# Build from the monorepo root. The renderer target also works without apps/content.
FROM node:24-bookworm-slim AS node
FROM ubuntu:24.04 AS runtime
COPY packages/static-render/scripts/install-system-deps.sh /tmp/install-system-deps.sh
RUN sh /tmp/install-system-deps.sh && rm /tmp/install-system-deps.sh
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && npm install --global pnpm@10.22.0
WORKDIR /workspace
ENV PNPM_HOME=/usr/local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH

FROM runtime AS renderer
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
RUN pnpm install --frozen-lockfile --filter @allmaps/static-render...
# Exercise image processing and actual native pixels, not just successful imports.
RUN pnpm --filter @allmaps/iiif --filter @allmaps/static-render test \
    && SLIDES_TEST_NATIVE=true xvfb-run -a pnpm --filter @allmaps/static-render test:native
COPY --chmod=755 packages/static-render/docker-entrypoint.sh /usr/local/bin/static-render-entrypoint
ENTRYPOINT ["/usr/bin/tini", "--", "static-render-entrypoint"]
CMD ["node", "/workspace/packages/static-render/bin/render.mjs", "--help"]

# Optional Slides build image: content, caches and output are mounted at run time.
FROM renderer AS slides-build
COPY apps ./apps
RUN mkdir -p content && pnpm install --frozen-lockfile \
    && pnpm --filter @allmaps/slides --filter @allmaps/static-render --filter @allmaps/iiif check \
    && pnpm --filter @allmaps/slides --filter @allmaps/slides-app --filter @allmaps/svelte-canvas-panel test
CMD ["pnpm", "exec", "slides", "build"]
