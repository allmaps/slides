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

export const projectFiles = import.meta.glob(
  ["./project.yml", "./*/project.yml"],
  {
    eager: true,
    query: "?raw",
    import: "default",
  },
) as Record<string, string>;

export const dataAssetUrls = import.meta.glob(
  [
    "./assets/**/*.{geojson,GEOJSON,json,JSON}",
    "./*/assets/**/*.{geojson,GEOJSON,json,JSON}",
  ],
  {
    eager: true,
    query: "?url",
    import: "default",
  },
) as Record<string, string>;

export const imageAssetUrls = import.meta.glob(
  [
    "./assets/images/**/*.{avif,AVIF,gif,GIF}",
    "./assets/images/**/*.{jpeg,JPEG,jpg,JPG,png,PNG}",
    "./assets/images/**/*.{tif,TIF,tiff,TIFF,webp,WEBP}",
    "./*/assets/images/**/*.{avif,AVIF,gif,GIF}",
    "./*/assets/images/**/*.{jpeg,JPEG,jpg,JPG,png,PNG}",
    "./*/assets/images/**/*.{tif,TIF,tiff,TIFF,webp,WEBP}",
  ],
  {
    eager: true,
    query: "?url&iiif",
    import: "default",
  },
) as Record<string, ImageModule>;

export const slideFiles = import.meta.glob(
  ["./slideshows/**/*.md", "./*/slideshows/**/*.md"],
  {
    eager: true,
  },
) as Record<string, MarkdownModule>;
