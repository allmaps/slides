import { mount, unmount } from "svelte";
import { writable } from "svelte/store";
import CanvasFigure from "$lib/components/CanvasFigure.svelte";
import { getContentAssetUrl, getContentIiifImage, joinUrl, withBaseUrl } from "./paths";
import type { CanvasPanelProps } from "@allmaps/svelte-canvas-panel";

const resolveUrl = (value: string) => getContentAssetUrl(value) ?? withBaseUrl(value);

/** Enhance authored HTML without requiring component imports in Markdown. */
export function enhanceFigures(content: HTMLElement) {
  const cleanups: (() => void)[] = [];
  let destroyed = false;
  const root = content.closest<HTMLElement>("[data-slideshow-scroll]");
  const pending = new Map<HTMLElement, () => void>();
  let observer: IntersectionObserver | undefined;
  let resize: ResizeObserver | undefined;
  let preloadHeight = -1;

  function updateObserver() {
    if (destroyed || !pending.size) return;
    const height = root?.clientHeight ?? document.documentElement.clientHeight;
    if (height === preloadHeight) return;
    preloadHeight = height;
    observer?.disconnect();
    // rootMargin is immutable and percentages use width, so measure the panel's
    // current height in pixels and reobserve only figures that haven't loaded.
    observer = new IntersectionObserver((entries, current) => {
      if (destroyed || current !== observer) return;
      for (const entry of entries) {
        const figure = entry.target as HTMLElement;
        const load = pending.get(figure);
        if (entry.isIntersecting && load) {
          pending.delete(figure);
          current.unobserve(figure);
          load();
        }
      }
      if (!pending.size) { current.disconnect(); resize?.disconnect(); }
    }, { root, rootMargin: `${height}px 0px` });
    pending.forEach((_, figure) => observer!.observe(figure));
  }

  function enhance(figure: HTMLElement) {
    const marker = figure.querySelector<HTMLElement>("[data-iiif-image]");
    const manifest = figure.dataset.manifest;
    const imageSource = figure.dataset.image ?? marker?.dataset.iiifImage;
    if (!manifest && !imageSource) return;

    const local = imageSource ? getContentIiifImage(imageSource.split("#")[0]) : undefined;
    let source: CanvasPanelProps;
    if (manifest) {
      source = { manifest: resolveUrl(manifest), startCanvas: figure.dataset.canvas };
    } else if (local) {
      const fragment = imageSource!.includes("#") ? imageSource!.slice(imageSource!.indexOf("#")) : "";
      source = { imageService: withBaseUrl(joinUrl("iiif", local.servicePath)) + fragment };
    } else {
      // Image.svelte's marker is already resolved, including the site's base path.
      source = { imageService: figure.dataset.image ? resolveUrl(imageSource!) : imageSource! };
    }
    // The component resolves IIIF request paths and xywh fragments itself.
    source.region = figure.dataset.region;
    source.rotation = figure.dataset.rotation ? Number(figure.dataset.rotation) : 0;
    const loadImage = writable(false);
    pending.set(figure, () => loadImage.set(true));
    const caption = figure.querySelector("figcaption");
    const target = document.createElement("div");
    figure.insertBefore(target, figure.firstChild);
    const component = mount(CanvasFigure, {
      target,
      props: {
        source, loadImage,
        label: figure.getAttribute("aria-label") || marker?.dataset.alt || caption?.textContent?.trim() || "Image",
        caption: caption?.innerHTML ?? "",
      },
    });
    cleanups.push(() => {
      void unmount(component);
      target.remove();
    });
  }

  // Defer until the Markdown children have mounted.
  queueMicrotask(() => {
    if (destroyed) return;
    // Mount every panel now: metadata establishes dimensions before scrolling.
    // Only activate Atlas when the figure reaches the measured preload range.
    for (const figure of content.querySelectorAll<HTMLElement>("figure")) enhance(figure);
    if (!pending.size) return;
    resize = new ResizeObserver(updateObserver);
    resize.observe(root ?? document.documentElement);
    updateObserver();
  });
  return { destroy() {
    destroyed = true;
    observer?.disconnect();
    resize?.disconnect();
    pending.clear();
    cleanups.forEach((cleanup) => cleanup());
  } };
}
