declare module "virtual:slides/iiif-server" {
	const catalog: import("@allmaps/iiif").IiifCatalog;
	export default catalog;
}

declare module "virtual:slides/content" {
  export const project: import("@allmaps/slides/model/types").Project;
  export const slidesConfig: import("@allmaps/slides/model/types").SlidesConfig;
  export const dataAssetFiles: Record<string, () => Promise<string>>;
  export const mapStyleFiles: Record<string, unknown>;
  export const imageAssetUrls: Record<string, string | { relativePath: string; width: number; height: number }>;
}

declare module "virtual:slides/markdown" {
  export const slideFiles: Record<string, { default: any; metadata: Record<string, unknown> }>;
}
