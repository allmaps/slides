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

export const slidesConfigFiles = import.meta.glob(
  ["./slides.config.yml", "./slides.config.yaml", "./slides.config.json"],
  {
    eager: true,
    query: "?raw",
    import: "default",
  },
) as Record<string, string>;

export const projectFiles = import.meta.glob(
  ["./project.yml", "./*/project.yml"],
  {
    eager: true,
    query: "?raw",
    import: "default",
  },
) as Record<string, string>;

export const dataAssetFiles = import.meta.glob(
  [
    "./assets/**/*.{geojson,GEOJSON,json,JSON}",
    "./*/assets/**/*.{geojson,GEOJSON,json,JSON}",
  ],
  {
    query: "?raw",
    import: "default",
  },
) as Record<string, () => Promise<string>>;

export const mapStyleFiles = import.meta.glob(
  [
    "./assets/map-styles/**/*.json",
    "./assets/styles/**/*.json",
    "./*/assets/map-styles/**/*.json",
    "./*/assets/styles/**/*.json",
  ],
  {
    eager: true,
    import: "default",
  },
) as Record<string, unknown>;

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
