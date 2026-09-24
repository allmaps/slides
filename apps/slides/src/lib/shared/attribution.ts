export type AttributionPart = { text: string; href?: string };

/** Retain attribution text and links without rendering provider HTML directly. */
export function parseAttribution(html: string): AttributionPart[] {
  const document = new DOMParser().parseFromString(html, "text/html");
  document.querySelectorAll("script, style, iframe, object").forEach((node) => node.remove());
  const parts: AttributionPart[] = [];
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push({ text: node.textContent ?? "" });
    } else if (node instanceof HTMLAnchorElement) {
      const href = node.getAttribute("href") ?? "";
      parts.push({ text: node.textContent ?? "", href: /^https?:\/\//i.test(href) ? href : undefined });
    } else {
      node.childNodes.forEach(visit);
    }
  };
  visit(document.body);
  return parts;
}
