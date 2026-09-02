import sharp from "sharp";

export type VisibleImageBrandPosition =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left";

export type VisibleImageBrandOpacityPreset = "low" | "medium" | "high";

export type VisibleImageBrandLogoVariant = "light" | "dark" | "icon";

export interface VisibleImageBrandTextConfig {
  productName?: string;
  appName?: string;
  brandName?: string;
  visibleText?: string;
}

export interface VisibleImageBrandLayerOptions {
  enabled: boolean;
  position?: VisibleImageBrandPosition;
  opacity?: VisibleImageBrandOpacityPreset | number;
  marginPx?: number;
  brand?: VisibleImageBrandTextConfig;
  logoPngBuffer?: Buffer | Uint8Array | null;
  logoSvgBuffer?: Buffer | Uint8Array | string | null;
  logoVariant?: VisibleImageBrandLogoVariant;
  logoMaxWidthPx?: number;
}

export interface VisibleImageBrandLayerResult {
  applied: boolean;
  outputBuffer: Buffer;
  position: VisibleImageBrandPosition;
  opacity: number;
  visibleText: string;
  usedUserLogo: boolean;
  safety: {
    visibleOnly: true;
    hiddenIdDecision: false;
    ownershipDecision: false;
    preSealBlockReason: false;
    confirmed: false;
    canOpenVault: false;
    vaultEligible: false;
  };
}

const DEFAULT_VISIBLE_TEXT = "TancMark";
const DEFAULT_POSITION: VisibleImageBrandPosition = "bottom-right";
const DEFAULT_MARGIN_PX = 24;
const DEFAULT_LOGO_MAX_WIDTH_PX = 260;
const DEFAULT_LOGO_VARIANT: VisibleImageBrandLogoVariant = "light";

export const TANCMARK_BRAND_COLORS = {
  navy: "#13243a",
  teal: "#1fd6e0",
  tealDark: "#16a8b0",
  sealRed: "#ff3b6b",
} as const;

export const TANCMARK_VISIBLE_BRAND_ASSETS = {
  lightLogo: "tancmark-logo.svg",
  darkLogo: "tancmark-logo-dark.svg",
  icon: "tancmark-icon.svg",
} as const;

const OPACITY_PRESETS: Record<VisibleImageBrandOpacityPreset, number> = {
  low: 0.22,
  medium: 0.45,
  high: 0.75,
};

export function supportsVisibleImageBrandLayerMimeType(mimeType: string | null | undefined): boolean {
  return typeof mimeType === "string" && mimeType.toLowerCase().startsWith("image/");
}

export function visibleVideoBrandLayerSupported(): false {
  return false;
}

function opacityValue(value: VisibleImageBrandLayerOptions["opacity"]): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0.05, Math.min(0.95, value));
  }
  if (typeof value === "string" && value in OPACITY_PRESETS) return OPACITY_PRESETS[value];
  return OPACITY_PRESETS.medium;
}

function visibleText(brand: VisibleImageBrandTextConfig | undefined): string {
  const value = brand?.visibleText ?? brand?.brandName ?? brand?.productName ?? brand?.appName ?? DEFAULT_VISIBLE_TEXT;
  const normalized = value.trim().slice(0, 80);
  return normalized || DEFAULT_VISIBLE_TEXT;
}

function containsLegacyVisibleName(value: string): boolean {
  return /\bAEGIS\b/i.test(value);
}

function svgWithOpacity(svg: Buffer | Uint8Array | string, opacity: number): Buffer {
  const text = Buffer.from(svg).toString("utf8").trim();
  if (!/^<svg\b/i.test(text) || !/<\/svg>$/i.test(text)) return Buffer.from(svg);
  const safeOpacity = Math.max(0.15, Math.min(0.95, opacity));
  return Buffer.from(
    text
      .replace(/(<svg\b[^>]*>)/i, `$1\n<g opacity="${safeOpacity}">`)
      .replace(/<\/svg>$/i, "</g>\n</svg>"),
  );
}

function officialTancMarkLogoSvg(
  text: string,
  opacity: number,
  variant: VisibleImageBrandLogoVariant,
  width = DEFAULT_LOGO_MAX_WIDTH_PX,
): Buffer {
  const logoOpacity = Math.max(0.15, Math.min(0.95, opacity));
  const safeText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  if (variant === "icon") {
    return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width}" viewBox="0 0 120 120" role="img" aria-label="${safeText} icon">
  <g opacity="${logoOpacity}">
    <rect x="0" y="0" width="120" height="120" rx="26" fill="${TANCMARK_BRAND_COLORS.navy}"/>
    <g transform="translate(60,62)">
      <path d="M-30 -24 L30 -24 L24 -15 L-24 -15 Z" fill="${TANCMARK_BRAND_COLORS.teal}"/>
      <path d="M-5 -15 L5 -15 L5 28 L-5 28 Z" fill="${TANCMARK_BRAND_COLORS.teal}"/>
      <path d="M-24 -5 L-35 8 L-19 3 Z" fill="${TANCMARK_BRAND_COLORS.tealDark}"/>
      <path d="M24 -5 L35 8 L19 3 Z" fill="${TANCMARK_BRAND_COLORS.tealDark}"/>
      <circle cx="0" cy="6" r="6.5" fill="${TANCMARK_BRAND_COLORS.sealRed}"/>
    </g>
  </g>
</svg>`);
  }

  const textFill = variant === "dark" ? "#ffffff" : TANCMARK_BRAND_COLORS.navy;
  const textAccent = variant === "dark" ? TANCMARK_BRAND_COLORS.teal : TANCMARK_BRAND_COLORS.tealDark;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${Math.round(width * 120 / 520)}" viewBox="0 0 520 120" role="img" aria-label="${safeText} logo">
  <g opacity="${logoOpacity}">
    <rect x="6" y="14" width="92" height="92" rx="16" fill="${TANCMARK_BRAND_COLORS.navy}"/>
    <g transform="translate(52,60)">
      <path d="M-22 -18 L22 -18 L18 -11 L-18 -11 Z" fill="${TANCMARK_BRAND_COLORS.teal}"/>
      <path d="M-3.5 -11 L3.5 -11 L3.5 20 L-3.5 20 Z" fill="${TANCMARK_BRAND_COLORS.teal}"/>
      <path d="M-18 -4 L-26 6 L-14 2 Z" fill="${TANCMARK_BRAND_COLORS.tealDark}"/>
      <path d="M18 -4 L26 6 L14 2 Z" fill="${TANCMARK_BRAND_COLORS.tealDark}"/>
      <circle cx="0" cy="4" r="4.5" fill="${TANCMARK_BRAND_COLORS.sealRed}"/>
    </g>
    <text x="118" y="72" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="600" fill="${textFill}">${safeText.replace(/Mark$/i, "")}<tspan fill="${textAccent}">Mark</tspan></text>
  </g>
</svg>`);
}

async function logoBuffer(options: {
  text: string;
  opacity: number;
  logoVariant: VisibleImageBrandLogoVariant;
  logoPngBuffer?: Buffer | Uint8Array | null;
  logoSvgBuffer?: Buffer | Uint8Array | string | null;
  logoMaxWidthPx: number;
}): Promise<{ buffer: Buffer; usedUserLogo: boolean }> {
  if (options.logoPngBuffer && options.logoPngBuffer.byteLength > 0) {
    const userLogo = await sharp(Buffer.from(options.logoPngBuffer))
      .ensureAlpha()
      .resize({ width: options.logoMaxWidthPx, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    return { buffer: userLogo, usedUserLogo: true };
  }

  if (options.logoSvgBuffer && options.logoSvgBuffer.toString().trim()) {
    const userLogo = await sharp(svgWithOpacity(options.logoSvgBuffer, options.opacity))
      .resize({ width: options.logoMaxWidthPx, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    return { buffer: userLogo, usedUserLogo: true };
  }

  const generated = await sharp(officialTancMarkLogoSvg(
    options.text,
    options.opacity,
    options.logoVariant,
    options.logoMaxWidthPx,
  ))
    .png()
    .toBuffer();
  return { buffer: generated, usedUserLogo: false };
}

async function overlayCoordinates(inputBuffer: Buffer, logo: Buffer, position: VisibleImageBrandPosition, marginPx: number) {
  const [imageMeta, logoMeta] = await Promise.all([sharp(inputBuffer).metadata(), sharp(logo).metadata()]);
  const imageWidth = imageMeta.width ?? 0;
  const imageHeight = imageMeta.height ?? 0;
  const logoWidth = logoMeta.width ?? 0;
  const logoHeight = logoMeta.height ?? 0;
  if (!imageWidth || !imageHeight || !logoWidth || !logoHeight) {
    throw new Error("visible image brand layer requires readable image and logo dimensions");
  }
  const left = position === "bottom-right" || position === "top-right"
    ? Math.max(0, imageWidth - logoWidth - marginPx)
    : marginPx;
  const top = position === "bottom-left" || position === "bottom-right"
    ? Math.max(0, imageHeight - logoHeight - marginPx)
    : marginPx;
  return { left: Math.min(left, Math.max(0, imageWidth - logoWidth)), top: Math.min(top, Math.max(0, imageHeight - logoHeight)) };
}

export async function applyVisibleImageBrandLayer(
  imageBuffer: Buffer | Uint8Array,
  options: VisibleImageBrandLayerOptions,
): Promise<VisibleImageBrandLayerResult> {
  const position = options.position ?? DEFAULT_POSITION;
  const opacity = opacityValue(options.opacity);
  const text = visibleText(options.brand);
  const marginPx = Math.max(0, Math.round(options.marginPx ?? DEFAULT_MARGIN_PX));
  const logoMaxWidthPx = Math.max(80, Math.round(options.logoMaxWidthPx ?? DEFAULT_LOGO_MAX_WIDTH_PX));
  const logoVariant = options.logoVariant ?? DEFAULT_LOGO_VARIANT;

  if (!options.enabled) {
    return {
      applied: false,
      outputBuffer: Buffer.from(imageBuffer),
      position,
      opacity,
      visibleText: text,
      usedUserLogo: false,
      safety: {
        visibleOnly: true,
        hiddenIdDecision: false,
        ownershipDecision: false,
        preSealBlockReason: false,
        confirmed: false,
        canOpenVault: false,
        vaultEligible: false,
      },
    };
  }

  if (containsLegacyVisibleName(text)) {
    throw new Error("visible image brand layer requires configurable product naming; legacy visible name is not allowed");
  }

  const logo = await logoBuffer({
    text,
    opacity,
    logoVariant,
    logoPngBuffer: options.logoPngBuffer,
    logoSvgBuffer: options.logoSvgBuffer,
    logoMaxWidthPx,
  });

  const inputBuffer = Buffer.from(imageBuffer);
  const coordinates = await overlayCoordinates(inputBuffer, logo.buffer, position, marginPx);
  const outputBuffer = await sharp(inputBuffer)
    .composite([
      {
        input: logo.buffer,
        left: coordinates.left,
        top: coordinates.top,
        blend: "over",
      },
    ])
    .png()
    .toBuffer();

  return {
    applied: true,
    outputBuffer,
    position,
    opacity,
    visibleText: text,
    usedUserLogo: logo.usedUserLogo,
    safety: {
      visibleOnly: true,
      hiddenIdDecision: false,
      ownershipDecision: false,
      preSealBlockReason: false,
      confirmed: false,
      canOpenVault: false,
      vaultEligible: false,
    },
  };
}
