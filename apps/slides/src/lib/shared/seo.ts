import type { Project, Slideshow } from "@allmaps/slides/model/types";

// Paths are app-relative. Preserve the entire deployment URL independently of
// the local router's base path, including when publicUrl has no trailing slash.
export const absolutePublicUrl = (path: string, publicUrl?: string) => {
  try {
    const base = new URL(publicUrl ?? "");
    if (!["https:", "http:"].includes(base.protocol)) return undefined;
    base.pathname = `${base.pathname.replace(/\/+$/, "")}/`;
    base.search = "";
    base.hash = "";
    return new URL(path.replace(/^\/+/, ""), base).href;
  } catch {
    return undefined;
  }
};

type SlideshowSeoOptions = {
  project: Project;
  slideshow: Slideshow;
  publicUrl?: string;
  imagePath?: string;
};

export const getSlideshowPageTitle = (project: Project, slideshow?: Slideshow) => {
  const mainTitle = project.slideshows.find((candidate) => candidate.id === project.main)?.title ?? project.title;
  return slideshow && slideshow.id !== project.main && slideshow.title !== mainTitle
    ? `${mainTitle} — ${slideshow.title}`
    : mainTitle;
};

export const createSlideshowSeo = ({
  project,
  slideshow,
  publicUrl,
  imagePath,
}: SlideshowSeoOptions) => {
  const canonical = absolutePublicUrl(slideshow.slug, publicUrl);
  const siteUrl = absolutePublicUrl("", publicUrl);
  const image = imagePath ? absolutePublicUrl(imagePath, publicUrl) : undefined;
  const description = (
    slideshow.description ?? slideshow.chapters[0]?.description ?? project.description
  )?.trim();

  return {
    title: getSlideshowPageTitle(project, slideshow),
    canonical,
    description,
    image,
    jsonLd: canonical && siteUrl ? {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": canonical,
      url: canonical,
      name: slideshow.title,
      description,
      isPartOf: {
        "@type": "WebSite",
        "@id": `${siteUrl}#website`,
        url: siteUrl,
        name: project.title,
        description: project.description,
      },
      primaryImageOfPage: image ? { "@type": "ImageObject", url: image } : undefined,
      mainEntity: {
        "@type": "PresentationDigitalDocument",
        "@id": `${canonical}#presentation`,
        url: canonical,
        name: slideshow.title,
        description,
        image,
        hasPart: slideshow.chapters.map((chapter, index) => ({
          // Chapter is specifically a book chapter in schema.org. These are
          // sections of an interactive presentation, so use CreativeWork.
          "@type": "CreativeWork",
          "@id": `${canonical}#${encodeURIComponent(chapter.slug)}`,
          url: `${canonical}#${encodeURIComponent(chapter.slug)}`,
          name: chapter.title,
          description: chapter.description?.trim(),
          position: index + 1,
        })),
      },
      breadcrumb: slideshow.id !== project.main ? {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: project.title, item: siteUrl },
          { "@type": "ListItem", position: 2, name: slideshow.title, item: canonical },
        ],
      } : undefined,
    } : undefined,
  };
};

// JSON-LD lives in an HTML raw-text element: a title containing </script> must
// remain data, not terminate the element. Preserve the original JSON values.
export const serializeJsonLd = (value: unknown) =>
  JSON.stringify(value).replace(/</g, "\\u003c");
