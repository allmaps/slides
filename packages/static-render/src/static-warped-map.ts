import { WarpedMap } from "@allmaps/render";

/** Invert a column-major homography, up to its irrelevant overall scale. */
export function invertProjectiveWeights(weights: Float64Array): number[][] {
  const scale = Math.max(...weights.map(Math.abs));
  if (weights.length !== 9 || !Number.isFinite(scale) || scale === 0)
    throw new Error("Invalid projective transformation matrix");
  const [a, d, g, b, e, h, c, f, i] = weights.map((value) => value / scale);
  const inverse = [
    [e * i - f * h, f * g - d * i, d * h - e * g],
    [c * h - b * i, a * i - c * g, b * g - a * h],
    [b * f - c * e, c * d - a * f, a * e - b * d],
  ];
  const terms = [a * inverse[0][0], b * inverse[0][1], c * inverse[0][2]];
  const determinant = terms.reduce((sum, term) => sum + term, 0);
  if (
    !Number.isFinite(determinant) ||
    Math.abs(determinant) <=
      16 * Number.EPSILON * terms.reduce((sum, term) => sum + Math.abs(term), 0)
  )
    throw new Error(
      "Projective transformation is singular; cannot render its inverse",
    );
  // The adjugate represents the same homography as adjugate / determinant.
  // Normalize it instead, avoiding unnecessary overflow for small determinants.
  const inverseScale = Math.max(...inverse.flat().map(Math.abs));
  return inverse.map((column) => column.map((value) => value / inverseScale));
}

/** Keep Allmaps' forward geometry and sample its exact projective inverse. */
export class StaticWarpedMap extends WarpedMap {
  override getProjectedTransformer(
    ...args: Parameters<WarpedMap["getProjectedTransformer"]>
  ) {
    const transformer = super.getProjectedTransformer(...args);
    if (transformer.type === "projective") {
      // beta.83's buffer renderer otherwise fits a second homography with the
      // GCPs reversed. With noisy GCPs this need not invert the live map's fit.
      // Use public transformation APIs so geometry refinement, handedness,
      // projection conversion, tile selection and pixel sampling stay upstream.
      const { weights } = transformer
        .getToGeoTransformation()
        .getTransformationDataAsFloat64Array();
      transformer
        .getToResourceTransformation()
        .setWeightsArrays(invertProjectiveWeights(weights));
    }
    return transformer;
  }
}
