<script lang="ts" module>
  export { default as a } from "$lib/components/Link.svelte";
  export { default as img } from "$lib/components/Image.svelte";
</script>

<script lang="ts">
  let {
    title,
    description,
    children,
  }: {
    title: string;
    description: string;
    children: any;
  } = $props();
</script>

<div class="slide-content clear-both">
  <h1>{title}</h1>
  <p class="slide-description">{description}</p>
  {@render children?.()}
</div>

<style>
  :global(.slide-content) {
    width: 100%;
    max-width: 65ch;
    color: currentColor;
    font-family: var(--font-body);
    font-feature-settings: normal;
    font-size: 18px;
    font-weight: 400;
    letter-spacing: 0;
    line-height: 1.3;
  }

  :global(.slide-content > :first-child) {
    margin-block-start: 0;
  }

  :global(.slide-content > :last-child) {
    margin-block-end: 0;
  }

  :global(.slide-content h1),
  :global(.slide-content h2),
  :global(.slide-content h3),
  :global(.slide-content h4),
  :global(.slide-content h5),
  :global(.slide-content h6) {
    color: currentColor;
    font-family: var(--font-display);
    font-feature-settings: var(--font-display-features);
    font-weight: 400;
    letter-spacing: 0;
  }

  :global(.slide-content h1) {
    margin-block: 0 0.78em;
    font-size: 36px;
    line-height: 1;
  }

  :global(.slide-content h2) {
    margin-block: 1.25em 0.55em;
    font-size: 28px;
    line-height: 1.1;
  }

  :global(.slide-content h3) {
    margin-block: 1.15em 0.5em;
    font-size: 22px;
    line-height: 1.1;
  }

  :global(.slide-content h4),
  :global(.slide-content h5),
  :global(.slide-content h6) {
    margin-block: 1em 0.45em;
    font-size: 18px;
    line-height: 1.1;
  }

  :global(.slide-content p) {
    margin-block: 1em;
  }

  :global(.slide-content .slide-description) {
    margin-block-start: -0.35em;
    font-style: italic;
  }

  :global(.slide-content a) {
    color: var(--highlight-fg);
    font-weight: 400;
    text-decoration-line: underline;
    text-decoration-color: currentColor;
    text-decoration-style: dotted;
    text-decoration-thickness: 0.08em;
    text-underline-offset: 0.16em;
  }

  :global(.slide-content a[data-external="true"]) {
    font-weight: 500;
  }

  :global(.slide-content strong) {
    font-weight: 700;
  }

  :global(.slide-content em) {
    font-style: italic;
  }

  :global(.slide-content ul),
  :global(.slide-content ol) {
    margin-block: 1em;
    padding-inline-start: 1.25em;
  }

  :global(.slide-content ul) {
    list-style-type: disc;
  }

  :global(.slide-content ol) {
    list-style-type: decimal;
  }

  :global(.slide-content li) {
    margin-block: 0.35em;
    padding-inline-start: 0.15em;
  }

  :global(.slide-content li > ul),
  :global(.slide-content li > ol) {
    margin-block: 0.35em;
  }

  :global(.slide-content blockquote) {
    margin-block: 1.25em;
    border-inline-start: 2px solid color-mix(in srgb, currentColor 24%, transparent);
    padding-inline-start: 1em;
    font-style: italic;
  }

  :global(.slide-content hr) {
    margin-block: 1.75em;
    border: 0;
    border-block-start: 1px solid color-mix(in srgb, currentColor 18%, transparent);
  }

  :global(.slide-content figure) {
    margin-block: 1.25em;
  }

  :global(.slide-content img),
  :global(.slide-content picture) {
    display: block;
    max-width: 100%;
  }

  :global(.slide-content figcaption) {
    margin-block-start: 0.45em;
    color: color-mix(in srgb, currentColor 72%, transparent);
    font-size: 0.85em;
    line-height: 1.25;
  }

  :global(.slide-content code) {
    border-radius: 0.2em;
    background: color-mix(in srgb, currentColor 8%, transparent);
    padding: 0.08em 0.22em;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
      "Courier New", monospace;
    font-size: 0.88em;
  }

  :global(.slide-content pre) {
    margin-block: 1.25em;
    overflow-x: auto;
    border-radius: 0.35rem;
    background: color-mix(in srgb, currentColor 8%, transparent);
    padding: 0.9em 1em;
  }

  :global(.slide-content pre code) {
    background: transparent;
    padding: 0;
    font-size: 0.85em;
  }

  :global(.slide-content table) {
    margin-block: 1.25em;
    width: 100%;
    border-collapse: collapse;
    font-size: 0.92em;
  }

  :global(.slide-content th),
  :global(.slide-content td) {
    border-block-end: 1px solid color-mix(in srgb, currentColor 16%, transparent);
    padding: 0.45em 0.6em;
    text-align: start;
    vertical-align: top;
  }

  :global(.slide-content th) {
    font-weight: 700;
  }

  :global(.slide-content .footnotes) {
    margin-block-start: 1.5em;
    font-size: 0.86em;
    line-height: 1.25;
  }
</style>
