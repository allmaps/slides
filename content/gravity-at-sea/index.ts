type MarkdownModule = {
  default: any;
  metadata: Record<string, unknown>;
};

export const projectFiles = import.meta.glob(
  ["./project.yml", "./*/project.yml"],
  {
    eager: true,
    query: "?raw",
    import: "default",
  },
) as Record<string, string>;

export const assetUrls = import.meta.glob(
  [
    "./assets/**/*.{avif,AVIF,gif,GIF}",
    "./assets/**/*.{geojson,GEOJSON,json,JSON}",
    "./assets/**/*.{jpeg,JPEG,jpg,JPG,png,PNG}",
    "./assets/**/*.{svg,SVG,tif,TIF,tiff,TIFF,webp,WEBP}",
    "./*/assets/**/*.{avif,AVIF,gif,GIF}",
    "./*/assets/**/*.{geojson,GEOJSON,json,JSON}",
    "./*/assets/**/*.{jpeg,JPEG,jpg,JPG,png,PNG}",
    "./*/assets/**/*.{svg,SVG,tif,TIF,tiff,TIFF,webp,WEBP}",
  ],
  {
    eager: true,
    query: "?url",
    import: "default",
  },
) as Record<string, string>;

export const slideFiles = import.meta.glob(
  ["./slideshows/**/*.md", "./*/slideshows/**/*.md"],
  {
    eager: true,
  },
) as Record<string, MarkdownModule>;
