import sharp from "sharp";
import type { WarpedMapEffects } from "./map-options.ts";

const clamp = (value: number) => Math.max(0, Math.min(1, value));

async function rgb(color: string) {
  const pixel = await sharp({ create: { width: 1, height: 1, channels: 3, background: color } })
    .raw().toBuffer();
  return [pixel[0] / 255, pixel[1] / 255, pixel[2] / 255];
}

/** Apply map effects to unassociated RGBA before Sharp composites the map. */
export async function applyMapEffects(rgba: Uint8Array | Uint8ClampedArray, effects: WarpedMapEffects, label: string) {
  // Defaults and RGB math follow Allmaps render beta.84's map fragment shader.
  // Sharp's HSL saturation/tint operations use different math, so use raw pixels.
  const color = async (option: "removeColorColor" | "colorizeColor", fallback: string) => {
    try { return await rgb(effects[option] ?? fallback); }
    catch {
      console.warn(`[static-render] ${label}: invalid ${option}; generating preview without ${option === "colorizeColor" ? "colorization" : "color removal"}.`);
      return undefined;
    }
  };
  const background = effects.removeColor ? await color("removeColorColor", "#222222") : undefined;
  const tint = effects.colorize ? await color("colorizeColor", "#ff56ba") : undefined;
  const threshold = effects.removeColorThreshold ?? 0.3;
  const hardness = clamp(effects.removeColorHardness ?? 0.7);
  const saturation = effects.saturation ?? 1;
  const opacity = clamp(effects.opacity ?? 1);
  for (let i = 0; i < rgba.length; i += 4) {
    if (!rgba[i + 3]) continue;
    let r = rgba[i] / 255, g = rgba[i + 1] / 255, b = rgba[i + 2] / 255;
    let alpha = rgba[i + 3] / 255;
    if (background && threshold > 0) {
      const distance = Math.hypot(r - background[0], g - background[1], b - background[2]);
      if (distance < threshold) {
        const t = hardness === 1 ? 0 : clamp((distance - threshold * hardness) / (threshold * (1 - hardness)));
        alpha *= t * t * (3 - 2 * t);
      }
    }
    const gray = 0.21 * r + 0.71 * g + 0.07 * b;
    r = r * saturation + gray * (1 - saturation);
    g = g * saturation + gray * (1 - saturation);
    b = b * saturation + gray * (1 - saturation);
    if (tint) { r += tint[0]; g += tint[1]; b += tint[2]; }
    rgba[i] = Math.round(clamp(r) * 255);
    rgba[i + 1] = Math.round(clamp(g) * 255);
    rgba[i + 2] = Math.round(clamp(b) * 255);
    rgba[i + 3] = Math.round(alpha * opacity * 255);
  }
}
