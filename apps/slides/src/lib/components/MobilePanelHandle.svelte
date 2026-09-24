<script lang="ts">
  import { getInterfaceText } from "$lib/shared/interface-context";
  const t = getInterfaceText();
  import { snapMobilePanel, type MobilePanelSize, type MobilePanelHeights } from "$lib/shared/mobile-panel";

  let { panel, size, onDragStart, onDrag, onSnap }: {
    panel?: HTMLDivElement;
    size: MobilePanelSize;
    onDragStart: () => void;
    onDrag: (height: number) => void;
    onSnap: (size: MobilePanelSize) => void;
  } = $props();

  const descriptionId = $props.id();
  const label = $derived(t(size === "collapsed" ? "showTextPanel" : size === "full" ? "reduceTextPanel" : "expandTextPanel"));
  let ignoreClick = false;
  let gesture: {
    pointerId: number;
    button: HTMLButtonElement;
    start: MobilePanelSize;
    heights: MobilePanelHeights;
    startY: number;
    startHeight: number;
    lastY: number;
    lastTime: number;
    velocity: number;
    height: number;
    dragging: boolean;
  } | undefined;

  const startDrag = (event: PointerEvent) => {
    if (!panel || !event.isPrimary || event.button !== 0 || gesture) return;
    const button = event.currentTarget as HTMLButtonElement;
    const style = getComputedStyle(panel);
    const inset = parseFloat(style.bottom) || 0;
    const full = (panel.parentElement?.clientHeight ?? window.innerHeight) - 2 * inset;
    const collapsed = parseFloat(style.getPropertyValue("--navigator-height"))
      - parseFloat(style.getPropertyValue("--panel-outset"));
    const heights = { collapsed, half: Math.max(collapsed, full / 2), full };
    ignoreClick = false;
    gesture = {
      pointerId: event.pointerId, button, start: size, heights,
      startY: event.clientY, startHeight: size === "collapsed" ? collapsed : panel.offsetHeight,
      lastY: event.clientY, lastTime: event.timeStamp,
      velocity: 0, height: size === "collapsed" ? collapsed : panel.offsetHeight,
      dragging: false,
    };
    button.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: PointerEvent) => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const delta = gesture.startY - event.clientY;
    if (!gesture.dragging && Math.abs(delta) < 5) return;
    if (!gesture.dragging) {
      gesture.dragging = true;
      onDragStart();
    }
    event.preventDefault();
    const elapsed = event.timeStamp - gesture.lastTime;
    if (elapsed > 0) gesture.velocity = (gesture.lastY - event.clientY) / elapsed;
    gesture.lastY = event.clientY;
    gesture.lastTime = event.timeStamp;
    gesture.height = Math.max(gesture.heights.collapsed,
      Math.min(gesture.heights.full, gesture.startHeight + delta));
    onDrag(gesture.height);
  };

  const finishDrag = (event?: PointerEvent, cancelled = false) => {
    if (!gesture || (event && event.pointerId !== gesture.pointerId)) return;
    const finished = gesture;
    gesture = undefined;
    if (finished.button.hasPointerCapture(finished.pointerId)) finished.button.releasePointerCapture(finished.pointerId);
    if (!finished.dragging) return;
    ignoreClick = !cancelled;
    const velocity = event && event.timeStamp - finished.lastTime < 100 ? finished.velocity : 0;
    onSnap(cancelled ? finished.start : snapMobilePanel(finished.heights, finished.start, finished.height, velocity));
  };

  const resizeWithKeyboard = (event: KeyboardEvent) => {
    let next: MobilePanelSize;
    if (event.key === "ArrowUp") next = size === "collapsed" ? "half" : "full";
    else if (event.key === "ArrowDown") next = size === "full" ? "half" : "collapsed";
    else if (event.key === "Home") next = "collapsed";
    else if (event.key === "End") next = "full";
    else return;
    event.preventDefault();
    onSnap(next);
  };
</script>

<svelte:window onresize={() => finishDrag(undefined, true)} />

<button
  type="button"
  class="panel-handle"
  class:panel-handle--collapsed={size === "collapsed"}
  aria-label={label}
  aria-expanded={size !== "collapsed"}
  aria-controls="slideshow-reading-panel"
  aria-describedby={descriptionId}
  title={t("panelDragHint")}
  onpointerdown={startDrag}
  onpointermove={moveDrag}
  onpointerup={(event) => finishDrag(event)}
  onpointercancel={(event) => finishDrag(event, true)}
  onlostpointercapture={(event) => finishDrag(event, true)}
  onkeydown={resizeWithKeyboard}
  onclick={() => {
    if (ignoreClick) { ignoreClick = false; return; }
    onSnap(size === "half" ? "full" : "half");
  }}
>
  <span class="panel-handle__grip" aria-hidden="true"></span>
  <span id={descriptionId} class="sr-only">{t("panelDragInstructions")}</span>
</button>

<style>
  .panel-handle { display: none; }
  @media (max-width: 767px) {
    .panel-handle {
      position: absolute;
      bottom: calc(100% + var(--panel-outset) - var(--panel-handle-height));
      left: calc(-1 * var(--panel-outset));
      z-index: 30;
      display: flex;
      align-items: center;
      justify-content: center;
      width: calc(100% + 2 * var(--panel-outset));
      height: var(--panel-handle-height);
      border-radius: 24px 24px 0 0;
      color: var(--app-text);
      cursor: grab;
      pointer-events: auto;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      transition: bottom 550ms cubic-bezier(.22, 1.3, .36, 1), left 550ms cubic-bezier(.22, 1.3, .36, 1), width 550ms cubic-bezier(.22, 1.3, .36, 1), height 550ms cubic-bezier(.22, 1.3, .36, 1);
    }
    .panel-handle:active { cursor: grabbing; }
    .panel-handle:focus-visible { outline: 2px solid var(--highlight-fg); outline-offset: -3px; }
    .panel-handle--collapsed {
      z-index: 51;
      bottom: calc((var(--navigator-height) - 44px) / 2);
      left: calc(50% - 35px);
      width: 70px;
      height: 44px;
      align-items: flex-start;
      padding-top: 5px;
      border-radius: 10px;
      color: var(--app-text);
    }
    .panel-handle__grip {
      width: 40px;
      height: 4px;
      border-radius: 2px;
      background: currentColor;
      opacity: 0.5;
    }
    :global(.story-panel--dragging) .panel-handle { transition: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .panel-handle { transition: none; }
  }
</style>
