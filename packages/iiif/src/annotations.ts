type JsonObject = Record<string, unknown>;

/** Visit image services, leaving provenance (partOf/provider) and GCPs intact. */
export function annotationImageServices(document: unknown): JsonObject[] {
  if (Array.isArray(document)) return document.flatMap(annotationImageServices);
  if (!document || typeof document !== "object") return [];
  const object = document as JsonObject;
  if (/^ImageService[123]$/.test(String(object.type ?? object["@type"]))) return [object];
  return Object.entries(object).filter(([key]) => !["partOf", "provider", "_allmaps"].includes(key))
    .flatMap(([, value]) => annotationImageServices(value));
}

/** Authored local image paths become absolute IIIF service URLs when published. */
export function resolveAnnotationImages(document: unknown, resolve: (image: string) => string | undefined) {
  const copy = structuredClone(document);
  for (const service of annotationImageServices(copy)) {
    const key = "id" in service ? "id" : "@id";
    const id = service[key];
    if (typeof id !== "string") continue;
    const resolved = resolve(id);
    if (resolved) {
      service[key] = resolved;
      service.type = "ImageService3";
    }
  }
  return copy;
}
