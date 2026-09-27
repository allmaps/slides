import sharp from "sharp";
import path from "node:path";
import { atomicWrite } from "./cache.ts";
import type { RenderJob } from "./types.ts";

type Font = { family: string; filename?: string };

// Authored text is literal text, never Pango markup.
const escapeText = (text: string) => text
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

let fontConfig: Promise<void> | undefined;
/** Sharp's bundled Fontconfig can lack a default config, notably on macOS. */
export function prepareTextFonts(cacheRoot: string) {
  return fontConfig ??= (async () => {
    // Core Text ignores fontfile; use the same backend as Linux for supplied fonts.
    process.env.PANGOCAIRO_BACKEND ??= "fontconfig";
    if (process.env.FONTCONFIG_FILE) return;
    const root = path.resolve(cacheRoot, "fonts");
    const filename = path.join(root, "fonts.conf");
    await atomicWrite(filename, `<?xml version="1.0"?>
      <!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
      <fontconfig>
        <include ignore_missing="yes">/etc/fonts/fonts.conf</include>
        <include ignore_missing="yes">/opt/homebrew/etc/fonts/fonts.conf</include>
        <include ignore_missing="yes">/usr/local/etc/fonts/fonts.conf</include>
        <dir>/System/Library/Fonts</dir><dir>/Library/Fonts</dir>
        <dir>/usr/share/fonts</dir><dir>/usr/local/share/fonts</dir>
        <cachedir>${escapeText(root)}</cachedir>
      </fontconfig>`);
    process.env.FONTCONFIG_FILE = filename;
  })();
}

async function textImage(
  text: string, font: Font, size: number, weight: number, width: number, height: number,
) {
  const input = {
    text: `<span foreground="#ffffff" weight="${weight}">${escapeText(text.trim())}</span>`,
    font: `${font.family} ${size}`,
    fontfile: font.filename,
    width,
    rgba: true,
    wrap: "word-char" as const,
  };
  const image = await sharp({ text: input }).png().toBuffer({ resolveWithObject: true });
  // Keep short copy at the intended size, but fit longer copy without clipping.
  return image.info.height <= height ? image
    : sharp({ text: { ...input, height } }).png().toBuffer({ resolveWithObject: true });
}

/** Composition only: independent of Slides, map rendering and font distribution. */
export async function renderTextOverlay(
  image: Buffer,
  size: [number, number],
  text: NonNullable<RenderJob["textOverlay"]>,
  font: Font = { family: "sans-serif" },
) {
  const [width, height] = size;
  const scale = Math.min(width / 1200, height / 630);
  const padding = Math.max(1, Math.round(56 * scale));
  const textWidth = width - 2 * padding;
  const title = await textImage(text.title, font, 76 * scale, 500, textWidth, Math.max(1, Math.round(height * 0.29)));
  const subtitle = text.subtitle?.trim()
    ? await textImage(text.subtitle, font, 34 * scale, 400, textWidth, Math.max(1, Math.round(height * 0.18)))
    : undefined;
  const gap = subtitle ? Math.round(24 * scale) : 0;
  const top = height - padding - title.info.height - gap - (subtitle?.info.height ?? 0);
  const lettering = await sharp({ create: {
    width, height, channels: 4, background: "#00000000",
  } }).composite([
    { input: title.data, left: padding, top },
    ...(subtitle ? [{ input: subtitle.data, left: padding, top: top + title.info.height + gap }] : []),
  ]).png().toBuffer();
  // A soft halo follows the glyphs, leaving the map outside the text untouched.
  const haloAlpha = await sharp(lettering).extractChannel("alpha")
    .blur(Math.max(0.3, 6 * scale)).linear(2.5).png().toBuffer();
  const halo = await sharp({ create: {
    width, height, channels: 3, background: "#08151b",
  } }).joinChannel(haloAlpha).png().toBuffer();
  return sharp(image).composite([
    { input: halo, left: 0, top: 0 },
    { input: lettering, left: 0, top: 0 },
  ]).png().toBuffer();
}
