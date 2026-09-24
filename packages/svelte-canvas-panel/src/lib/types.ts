import type { Snippet } from "svelte";

/** The supported subset of React IIIF Vault's CanvasPanel API. */
export type CanvasPanelProps = (
  | { manifest: string; startCanvas?: string; imageService?: never }
  | { imageService: string; manifest?: never; startCanvas?: never }
) & {
  label?: string;
  text?: CanvasPanelText;
  caption?: Snippet;
  embedded?: boolean;
  /** Preview height in CSS pixels; otherwise follows the canvas or region ratio. */
  height?: number;
  /** Clockwise degrees. Rotation happens in Atlas, including for level 0 images. */
  rotation?: number;
  /** Pixel or percentage xywh in the original, unrotated canvas coordinates. */
  region?: string;
  runtimeOptions?: {
    /** Fraction of the viewport kept inside the image, clamped to 0–1. Default 0.8. */
    visibilityRatio?: number;
    maxOverZoom?: number;
    maxUnderZoom?: number;
  };
  enableDownloads?: boolean;
  enableViewTransitions?: boolean;
  /** Metadata always loads on mount. Set false to defer Atlas and image pixels. */
  loadImage?: boolean;
  /** Opt into small service images while waiting for Atlas. Default false. */
  preloadThumbnail?: boolean;
  /** Called after metadata has settled and preview dimensions are applied, even
   * on failure. Does not wait for the lazily loaded Atlas image pixels. */
  onLayoutReady?: () => void;
};

export type CanvasPanelText = Partial<Record<
  'image' | 'enlargeImage' | 'openImage' | 'imageZoom' | 'zoomIn' | 'zoomOut' | 'closeImage' |
  'loadingImage' | 'imageLoadError' | 'tryAgain' | 'downloadPreview' | 'downloadView' |
  'previewDownloadError' | 'viewDownloadError', string>>;
