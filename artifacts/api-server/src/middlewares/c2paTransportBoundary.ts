// SPDX-License-Identifier: AGPL-3.0-only

import type { NextFunction, Request, Response } from "express";

function socketIsEncrypted(req: Request): boolean {
  return (req.socket as typeof req.socket & { encrypted?: boolean }).encrypted === true;
}

function socketIsLoopback(req: Request): boolean {
  const address = req.socket.remoteAddress;
  if (!address) return false;
  const normalized = address.toLowerCase().split("%")[0] as string;
  return normalized === "::1"
    || normalized === "127.0.0.1"
    || /^127\.(?:\d{1,3}\.){2}\d{1,3}$/.test(normalized)
    || normalized.startsWith("::ffff:127.");
}

/**
 * C2PA signing and inspection accept plaintext only from the local machine.
 * Remote clients must arrive over the actual TLS socket. Forwarded headers,
 * Express proxy trust and req.ip are deliberately not authority inputs.
 */
export function requireC2paTransportBoundary(req: Request, res: Response, next: NextFunction): void {
  if (socketIsLoopback(req) || socketIsEncrypted(req)) {
    next();
    return;
  }
  res.status(403).json({ ok: false, error: "c2pa_transport_boundary_rejected" });
}
