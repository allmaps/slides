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
    // Keep native dragging from cancelling the captured handle gesture.
    event.preventDefault();
    button.focus({ preventScroll: true });
    const style = getComputedStyle(panel);
    const inset = parseFloat(style.getPropertyValue("--app-edge-spacing"));
    const full = parseFloat(style.maxHeight);
    const collapsed = parseFloat(style.getPropertyValue("--navigator-height"))
      + parseFloat(style.getPropertyValue("--panel-handle-height")) + inset;
    const heights = { collapsed, half: Math.min(full, Math.max(collapsed, window.innerHeight / 2)), full };
    const startHeight = panel.offsetHeight;
    ignoreClick = false;
    gesture = {
      pointerId: event.pointerId, button, start: size, heights,
      startY: event.clientY, startHeight,
      lastY: event.clientY, lastTime: event.timeStamp,
      velocity: 0, height: startHeight,
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
      top: 0;
      left: 0;
      z-index: 30;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: var(--panel-handle-height);
      border-radius: 24px 24px 0 0;
      color: var(--app-text);
      cursor: grab;
      pointer-events: auto;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }
    .panel-handle:active { cursor: grabbing; }
    .panel-handle:focus-visible { outline: 2px solid var(--highlight-fg); outline-offset: -3px; }
    .panel-handle__grip {
      width: 40px;
      height: 4px;
      border-radius: 2px;
      background: currentColor;
      opacity: 0.5;
    }
  }
</style>
