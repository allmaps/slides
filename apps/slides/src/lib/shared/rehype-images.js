/**
 * @typedef {Object} HastNode
 * @property {string} type
 * @property {string} [tagName]
 * @property {string} [value]
 * @property {Record<string, unknown>} [properties]
 * @property {HastNode[]} [children]
 */

/** Keep Markdown captions semantic; IIIF loading belongs to the viewer. */
export default function rehypeImages() {
  /** @param {HastNode} tree */
  return (tree) => {
    /** @param {HastNode} parent @param {number} [figureDepth] @param {boolean} [inline] */
    const visit = (parent, figureDepth = 0, inline = false) => {
      if (!parent.children) return;
      parent.children = parent.children.map((child) => {
        // mdsvex preserves HTML block tags as raw siblings, while Markdown
        // between the tags becomes regular HAST elements.
        if (child.type === "raw") {
          const html = (child.value ?? "").replace(/<!--[\s\S]*?-->/g, "");
          for (const tag of html.matchAll(/<\/?figure\b[^>]*>/gi)) {
            figureDepth = Math.max(0, figureDepth + (tag[0].startsWith("</") ? -1 : 1));
          }
          return child;
        }
        if (child.type !== "element") return child;
        // A viewer is a block: images embedded in text keep ordinary img markup.
        if (inline && child.tagName === "img") child.properties = { ...child.properties, "data-inline": true };
        const inlineChildren = inline || (child.tagName === "p"
          && !(child.children?.length === 1 && child.children[0].tagName === "img"));
        visit(child, figureDepth + (child.tagName === "figure" ? 1 : 0), inlineChildren);

        const image = child.tagName === "p" && child.children?.length === 1
          && child.children[0].tagName === "img" ? child.children[0] : undefined;
        if (!image) return child;
        if (figureDepth) return image;

        const caption = image.properties?.alt;
        return {
          type: "element",
          tagName: "figure",
          properties: {},
          children: [image, ...(typeof caption === "string" && caption.trim() ? [{
            type: "element",
            tagName: "figcaption",
            properties: {},
            // Preserve legacy captions with embedded HTML, while new explicit
            // figcaptions support normal Markdown links and emphasis.
            children: [{ type: "raw", value: caption.replace(/\{/g, "&#123;").replace(/\}/g, "&#125;") }],
          }] : [])],
        };
      });
    };
    visit(tree);
  };
}
