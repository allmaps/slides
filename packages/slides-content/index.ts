type MarkdownModule = {
  default: any;
  metadata: Record<string, unknown>;
};

type IiifImageModule = {
  relativePath?: string;
  width?: number;
  height?: number;
  sizes?: Array<{
    width: number;
    height: number;
    size: string;
  }>;
  formats?: string[];
};

type ImageModule = IiifImageModule | string;

export const projectFiles = {} as Record<string, string>;

export const dataAssetUrls = {} as Record<string, string>;

export const imageAssetUrls = {} as Record<string, ImageModule>;

export const slideFiles = {} as Record<string, MarkdownModule>;
