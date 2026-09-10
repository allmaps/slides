<script lang="ts" module>
  export type ImageControls = {
    zoomIn(): void;
    zoomOut(): void;
    snapshot(): string | undefined;
    download(): Promise<void>;
  };
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import { canvasRotation } from "./rotation.ts";
  import type { CanvasPanelProps } from "./types.ts";
  import type { IiifResource } from "./iiif-resource.ts";

  let { resource, label, target, transitioning = false, rotation, runtimeOptions, onactivate, onready, onerror }: {
    resource: IiifResource;
    label: string;
    target?: HTMLElement;
    transitioning?: boolean;
    rotation: number;
    runtimeOptions: CanvasPanelProps["runtimeOptions"];
    onactivate: () => void;
    onready: (controls: ImageControls) => void;
    onerror: () => void;
  } = $props();
  let home: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let relocate = $state<((destination?: HTMLElement) => void)>();
  let configureRuntime = $state<((options: CanvasPanelProps["runtimeOptions"]) => void)>();

  $effect(() => { relocate?.(target); });
  $effect(() => { configureRuntime?.(runtimeOptions); });

  onMount(() => {
    let disposed = false;
    let cleanup = () => {};
    const timeout = setTimeout(() => { if (!disposed) onerror(); }, 30000);

    async function start() {
      const [atlas, { createIiifWorld }, { cancelAtlasMotion, createAtlasInteraction }] = await Promise.all([
        import("@atlas-viewer/atlas/standalone"), import("./atlas-world.ts"),
        import("./atlas-interaction.ts"),
      ]);
      if (disposed) return;
      const world = createIiifWorld(resource, rotation);
      const renderer = new atlas.CanvasRenderer(canvas, {
        dpi: window.devicePixelRatio || 1,
        crossOrigin: true,
        onImageError: (event) => {
          if (!disposed && event.severity === "fatal" && !renderer.isReady()) onerror();
        },
      });
      let width = Math.max(1, canvas.clientWidth);
      let height = Math.max(1, canvas.clientHeight);
      canvas.width = Math.round(width * renderer.dpi);
      canvas.height = Math.round(height * renderer.dpi);
      renderer.ctx.setTransform(renderer.dpi, 0, 0, renderer.dpi, 0, 0);
      const runtime = new atlas.Runtime(renderer, world, { width, height, x: 0, y: 0, scale: 1 });
      // Leave room to pan past an image edge before Atlas pulls it back.
      configureRuntime = (options) => {
        const ratio = options?.visibilityRatio ?? 0.8;
        const positive = (value: number | undefined) => value !== undefined && Number.isFinite(value) && value > 0 ? value : 1;
        runtime.setOptions({
          visibilityRatio: Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0.8,
          maxOverZoom: positive(options?.maxOverZoom),
          maxUnderZoom: positive(options?.maxUnderZoom),
        });
      };
      configureRuntime(runtimeOptions);
      runtime.stopControllers();
      // Keep zoom/pan controllers paused while showing the preview.
      runtime.addController(atlas.popmotionController({ parentElement: canvas, maxZoomFactor: 3, enableHoldToHome: false }));
      let expanded = false;
      const interaction = createAtlasInteraction(runtime, canvas);
      let previewPoster: string | undefined;
      const view = canvasRotation(resource, rotation);
      const region = view.bounds(resource.region ?? { x: 0, y: 0, width: resource.width, height: resource.height });
      const fitRegion = () => {
        cancelAtlasMotion(runtime);
        const scale = Math.min(width / region.width, height / region.height);
        runtime.setViewport({
          x: region.x - (width / scale - region.width) / 2,
          y: region.y - (height / scale - region.height) / 2,
          width: width / scale, height: height / scale,
        });
        runtime.updateNextFrame();
      };
      const controls: ImageControls = {
        zoomIn: () => world.zoomIn(), zoomOut: () => world.zoomOut(),
        snapshot: () => {
          try { return canvas.toDataURL("image/png"); } catch { return undefined; }
        },
        download: async () => {
          const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Image export failed.")), "image/png");
          });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${label.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 100) || "image"}.png`;
          document.body.append(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
      };
      let ready = false;
      const unsubscribe = world.addLayoutSubscriber((event) => {
        if (event !== "ready" || disposed || ready) return;
        ready = true;
        clearTimeout(timeout);
        onready(controls);
      });
      const afterFrame = runtime.registerHook("useAfterFrame", () => {
        // Cached tiles paint directly, without pendingDrawCall (offscreen tile
        // preparation). The resize snapshot expires after any rendered frame.
        if (canvas.style.backgroundImage) canvas.style.backgroundImage = "";
      });
      const resizeCanvas = () => {
        const nextWidth = Math.max(1, canvas.clientWidth);
        const nextHeight = Math.max(1, canvas.clientHeight);
        const dpi = window.devicePixelRatio || 1;
        if (width === nextWidth && height === nextHeight && renderer.dpi === dpi) return;
        renderer.dpi = dpi;
        canvas.width = Math.round(nextWidth * dpi);
        canvas.height = Math.round(nextHeight * dpi);
        renderer.ctx.setTransform(dpi, 0, 0, dpi, 0, 0);
        runtime.resize(width, nextWidth, height, nextHeight);
        width = nextWidth;
        height = nextHeight;
        if (!expanded) fitRegion();
        interaction.updateBounds();
      };
      const resize = new ResizeObserver(resizeCanvas);
      resize.observe(canvas);

      // Move the actual canvas into the dialog, retaining its runtime and tiles.
      // Its last rendered frame covers the synchronous canvas resize/clear.
      relocate = (destination) => {
        const parent = destination ?? home;
        if (canvas.parentElement === parent) return;
        if (destination) previewPoster = controls.snapshot();
        // Use the original preview on both transitions, never the modal's zoom.
        if (previewPoster) canvas.style.backgroundImage = `url(${previewPoster})`;
        interaction.stop();
        cancelAtlasMotion(runtime);
        expanded = Boolean(destination);
        parent.append(canvas);
        resizeCanvas();
        fitRegion();
        interaction.updateBounds();
        if (expanded) {
          interaction.start();
          canvas.focus({ preventScroll: true });
        } else {
          previewPoster = undefined;
        }
      };
      const click = () => { if (!expanded && ready) onactivate(); };
      const keydown = (event: KeyboardEvent) => {
        if (!expanded) {
          if (!ready || (event.key !== "Enter" && event.key !== " ")) return;
          onactivate();
        } else if (event.key === "+" || event.key === "=") controls.zoomIn();
        else if (event.key === "-") controls.zoomOut();
        else if (event.key === "0" || event.key === "Home") {
          cancelAtlasMotion(runtime);
          runtime.goHome();
          runtime.updateNextFrame();
        } else return;
        event.preventDefault();
      };
      canvas.addEventListener("click", click);
      canvas.addEventListener("keydown", keydown);
      fitRegion();
      cleanup = () => {
        resize.disconnect();
        unsubscribe();
        afterFrame();
        canvas.removeEventListener("click", click);
        canvas.removeEventListener("keydown", keydown);
        interaction.destroy();
        cancelAtlasMotion(runtime);
        runtime.stop();
        runtime.reset();
        // Restore Svelte's DOM ownership before the component is destroyed.
        home.append(canvas);
      };
    }

    void start().catch(() => { if (!disposed) { clearTimeout(timeout); onerror(); } });
    return () => { disposed = true; clearTimeout(timeout); cleanup(); };
  });
</script>

<div class="canvas-home" bind:this={home}>
  <!-- The open button is the keyboard entry point; programmatic canvas focus
    enables zoom shortcuts without adding an invisible tab stop. -->
  <canvas bind:this={canvas} class:interactive={Boolean(target)} data-background="transparent"
    style:view-transition-name={transitioning ? "canvas-panel-image" : "none"}
    role={target ? "img" : "button"} aria-label={target ? label : `Enlarge image: ${label}`} tabindex="-1"></canvas>
</div>

<style>
  .canvas-home, canvas { display: block; width: 100%; height: 100%; }
  canvas { cursor: zoom-in; background: center / contain no-repeat; outline: none; }
  canvas.interactive { touch-action: none; cursor: grab; }
  canvas.interactive:active { cursor: grabbing; }
</style>
