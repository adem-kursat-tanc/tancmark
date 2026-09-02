import type { NextFunction, Request, Response } from "express";

export function productRuntimeActive(): boolean {
  return process.env["NODE_ENV"] === "production" || process.env["AEGIS_PRODUCT_RUNTIME"] === "1";
}

export function assertLegacyFfmpegLabAllowed(scope: string): void {
  if (productRuntimeActive()) {
    throw new Error(`legacy_ffmpeg_lab_blocked_in_product:${scope}`);
  }
}

export function blockLegacyFfmpegLabInProduct(req: Request, res: Response, next: NextFunction): void {
  if (!productRuntimeActive()) {
    next();
    return;
  }
  res.status(410).json({
    error: "legacy_ffmpeg_lab_disabled_in_product",
    route: req.originalUrl.split("?")[0] ?? req.originalUrl,
    nativeProductPathRequired: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
  });
}

export function blockDirectCanonicalVideoReaderInProduct(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!productRuntimeActive()) {
    next();
    return;
  }
  res.status(410).json({
    error: "canonical_video_reader_internal_live_only",
    route: req.originalUrl.split("?")[0] ?? req.originalUrl,
    ownership: false,
    vault: false,
    confirmed: false,
    final: false,
  });
}
