import * as slidesContent from "@allmaps/slides-content";

type MarkdownModule = {
  default: any;
  metadata: Record<string, unknown>;
};

type IiifImageModule = {
  relativePath?: string;
  width?: number;
  height?: number;
};

type ImageModule = IiifImageModule | string;

type SlidesContentModule = Partial<{
  slidesConfigFiles: Record<string, string>;
  dataAssetFiles: Record<string, () => Promise<string>>;
  mapStyleFiles: Record<string, unknown>;
  imageAssetUrls: Record<string, ImageModule>;
  slideFiles: Record<string, MarkdownModule>;
}>;

const content = slidesContent as SlidesContentModule;

const asRecord = <Value>(value: unknown): Record<string, Value> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Value>)
    : {};

export const slidesConfigFiles = asRecord<string>(content.slidesConfigFiles);
export const dataAssetFiles = asRecord<() => Promise<string>>(
  content.dataAssetFiles,
);
export const mapStyleFiles = asRecord<unknown>(content.mapStyleFiles);
export const imageAssetUrls = asRecord<ImageModule>(content.imageAssetUrls);
export const slideFiles = asRecord<MarkdownModule>(content.slideFiles);
