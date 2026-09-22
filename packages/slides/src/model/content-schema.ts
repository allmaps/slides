import { z } from "zod";

import type { MapLibreWarpedMapLayerOptions } from "@allmaps/maplibre";
import type { SlidesConfig } from "./types.ts";
import type { StyleSpecification } from "maplibre-gl";

const nullableToUndefined = (value: unknown) =>
  value === null ? undefined : value;

const emptyOptionalStringToUndefined = (value: unknown) =>
  value === null || (typeof value === "string" && value.trim() === "")
    ? undefined
    : value;

const nonEmptyString = z.string().trim().min(1, "must not be empty");
const optionalString = z.preprocess(
  emptyOptionalStringToUndefined,
  z.string().optional(),
);
const optionalNonEmptyString = z.preprocess(
  emptyOptionalStringToUndefined,
  nonEmptyString.optional(),
);
const optionalSlug = z.preprocess(nullableToUndefined, z.string().optional());

const optionalValue = <Schema extends z.ZodType>(schema: Schema) =>
  z.preprocess(nullableToUndefined, schema.optional());

const optionalArray = <Schema extends z.ZodType>(schema: Schema) =>
  z.preprocess((value) => {
    if (value === undefined || value === null) return undefined;
    if (Array.isArray(value)) return value.length ? value : undefined;
    return [value];
  }, z.array(schema).optional());

const coordinateSchema = z.tuple([z.number(), z.number()]);
const fourNumberTupleSchema = z.tuple([
  z.number(),
  z.number(),
  z.number(),
  z.number(),
]);
const themeModeSchema = z.enum(["light", "dark"]);
const unknownRecordSchema = z.record(z.string(), z.unknown());
const themeStringRecordSchema = z.partialRecord(
  themeModeSchema,
  nonEmptyString,
);
const mapStyleReferenceSchema = z.union([
  nonEmptyString,
  z.custom<StyleSpecification>(
    (value) =>
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      "version" in value &&
      "layers" in value,
    "must be a MapLibre style object",
  ),
]);
const mapStylesSchema = z.partialRecord(
  themeModeSchema,
  mapStyleReferenceSchema,
);
const labelPositionSchema = z.preprocess(
  (value) => {
    if (value === "front") return "aboveWarpedMaps";
    if (value === "back") return "belowWarpedMaps";
    return value;
  },
  z.enum(["aboveWarpedMaps", "belowWarpedMaps"]).optional(),
);
const labelsConfigSchema = z.object({
  visible: z.boolean().optional(),
  position: labelPositionSchema,
});
const protomapsFlavorValueSchema = z.union([
  nonEmptyString,
  unknownRecordSchema,
]);
const protomapsConfigSchema = z
  .object({
    key: optionalString,
    locale: optionalString,
    lang: optionalString,
    glyphs: optionalString,
    sprite: z.union([nonEmptyString, themeStringRecordSchema]).optional(),
    sprites: themeStringRecordSchema.optional(),
    flavor: protomapsFlavorValueSchema.optional(),
    flavors: z
      .partialRecord(themeModeSchema, protomapsFlavorValueSchema)
      .optional(),
    overrides: unknownRecordSchema.optional(),
  })
  .passthrough();
const startScreenTextSchema = z
  .object({
    startButton: optionalString,
    chapterCountSingular: optionalString,
    chapterCountPlural: optionalString,
    madeWith: optionalString,
  })
  .passthrough();
const interfaceConfigSchema = z
  .object({
    startScreen: startScreenTextSchema.optional(),
  })
  .passthrough();
export const mapConfigSchema = z
  .object({
    theme: themeModeSchema.optional(),
    styles: mapStylesSchema.optional(),
    labels: labelsConfigSchema.optional(),
    hiddenLayers: optionalArray(nonEmptyString),
    foreground: themeStringRecordSchema.optional(),
    protomaps: protomapsConfigSchema.optional(),
  })
  .passthrough();

const mapLayerSchema = z.object({
  layer: nonEmptyString,
  opacity: z.number().optional(),
  visibility: z.enum(["visible", "none"]).optional(),
  duration: z.number().optional(),
});

const subslideshowReferenceSchema = z.union([
  nonEmptyString,
  z.object({
    id: nonEmptyString,
    title: optionalString,
  }),
]);

const warpedMapSchema = z
  .object({
    type: z.literal("Image").optional(),
    url: optionalNonEmptyString,
    path: optionalNonEmptyString,
    caption: optionalString,
    provenance: optionalString,
    homepage: optionalString,
    useBearing: z.boolean().optional(),
    useBounds: z.boolean().optional(),
    useZoom: z.boolean().optional(),
    options: z
      .custom<
        Partial<MapLibreWarpedMapLayerOptions>
      >((value) => typeof value === "object" && value !== null && !Array.isArray(value), "must be an object")
      .optional(),
    region: fourNumberTupleSchema.optional(),
    wiggle: z.boolean().optional(),
  })
  .passthrough()
  .refine((warpedMap) => warpedMap.url || warpedMap.path, {
    path: ["url"],
    message: "provide a non-empty url or path",
  })
  .transform(({ path, ...warpedMap }) => ({
    ...warpedMap,
    url: (warpedMap.url ?? path) as string,
  }));

const mapChapterPropsSchema = z
  .object({
    map: mapConfigSchema.optional(),
    location: optionalValue(
      z.object({
        zoom: z.number().optional(),
        center: coordinateSchema.optional(),
        duration: z.number().optional(),
        bearing: z.number().optional(),
      }),
    ),
    sprite: optionalValue(
      z.object({
        json: nonEmptyString,
        image: nonEmptyString,
        dimensions: coordinateSchema,
      }),
    ),
    caption: optionalString,
    freeze: z.boolean().optional(),
    padding: z.number().optional(),
    fit: z.enum(["cover", "contain", "equal"]).optional(),
    hideBasemap: z.boolean().optional(),
    contain: z.boolean().optional(),
    warpedMaps: optionalArray(warpedMapSchema),
    layers: optionalArray(mapLayerSchema),
  })
  .passthrough();

export const slideMetadataSchema = mapChapterPropsSchema
  .extend({
    title: nonEmptyString,
    description: optionalString,
    subslideshows: optionalArray(subslideshowReferenceSchema),
  })
  .passthrough();

export type ParsedSlideMetadata = z.output<typeof slideMetadataSchema>;

const sourceDefinitionSchema = z
  .object({
    type: nonEmptyString,
    path: optionalNonEmptyString,
    url: optionalNonEmptyString,
  })
  .passthrough()
  .refine((source) => source.path || source.url, {
    path: ["url"],
    message: "provide a non-empty url or path",
  });

const slideshowDefinitionSchema = z.object({
  id: nonEmptyString,
  path: nonEmptyString,
  slug: optionalSlug,
  title: optionalString,
  description: optionalString,
  map: mapConfigSchema.optional(),
  start: mapChapterPropsSchema.optional(),
});

export const slidesConfigSchema = z
  .object({
    app: z.object({ directory: optionalString }).optional(),
    site: z
      .object({ basePath: optionalString, publicUrl: optionalString })
      .optional(),
    iiif: z
      .object({
        enabled: z.union([z.boolean(), z.string(), z.number()]).optional(),
        input: optionalString,
        output: optionalString,
        id: optionalString,
        collectionLabel: optionalString,
        sizes: z.union([z.boolean(), z.string(), z.number()]).optional(),
        tiles: z.union([z.boolean(), z.string(), z.number()]).optional(),
        tileSize: z.union([z.string(), z.number()]).optional(),
        webp: z.union([z.boolean(), z.string(), z.number()]).optional(),
      })
      .optional(),
    title: optionalString,
    description: optionalString,
    main: optionalNonEmptyString,
    slideshows: z.array(slideshowDefinitionSchema).optional().default([]),
    sources: z
      .record(z.string(), sourceDefinitionSchema)
      .optional()
      .default({}),
    map: mapConfigSchema.optional(),
    protomaps: protomapsConfigSchema.optional(),
    interface: interfaceConfigSchema.optional(),
  })
  .passthrough();

export type ParsedSlidesConfig = z.output<typeof slidesConfigSchema>;

type ContentSchemaResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
    };

const formatIssuePath = (path: PropertyKey[]) =>
  path.reduce<string>((label, part) => {
    if (typeof part === "number") return `${label}[${part}]`;
    return label ? `${label}.${String(part)}` : String(part);
  }, "");

const formatIssues = (issues: z.core.$ZodIssue[]) =>
  issues
    .map((issue) => {
      const path = formatIssuePath(issue.path);
      const location = path ? path : "frontmatter";

      return `  - ${location}: ${issue.message}`;
    })
    .join("\n");

const warnContentError = (
  message: string,
  path: string,
  issues: z.core.$ZodIssue[],
) => {
  console.warn(`${message}\n${path}\n${formatIssues(issues)}`);
};

export const parseSlideMetadata = (
  metadata: unknown,
  path: string,
): ContentSchemaResult<ParsedSlideMetadata> => {
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    Array.isArray(metadata)
  ) {
    console.warn(
      `Skipping this slide because its frontmatter metadata was not available:\n${path}\n  - Check the YAML frontmatter syntax, especially duplicate keys or indentation errors.`,
    );

    return { success: false };
  }

  const result = slideMetadataSchema.safeParse(metadata);

  if (!result.success) {
    warnContentError(
      "Skipping this slide because its frontmatter could not be parsed:",
      path,
      result.error.issues,
    );

    return { success: false };
  }

  return result;
};

export const parseSlidesConfig = (
  rawConfig: unknown,
  path: string,
): ContentSchemaResult<SlidesConfig> => {
  const result = slidesConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    warnContentError(
      "Ignoring Slides config because it could not be parsed:",
      path,
      result.error.issues,
    );

    return { success: false };
  }

  const config = result.data;

  return {
    success: true,
    data: {
      title: config.title ?? "Slides",
      description: config.description,
      main:
        config.main ??
        (config.slideshows.length === 1 ? config.slideshows[0].id : "main"),
      slideshows: config.slideshows,
      sources: config.sources,
      map: config.map,
      protomaps: config.protomaps,
      interface: config.interface,
    },
  };
};
