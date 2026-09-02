export type PlatformMode = "noop" | "planned" | "production";

export type PlatformHealthStatus = "not_configured" | "healthy" | "degraded" | "unavailable";

export type PlatformOperationStatus =
  | "not_configured"
  | "accepted"
  | "found"
  | "not_found"
  | "deleted"
  | "unavailable"
  | "rejected";

export type PlatformSafetyEnvelope = Readonly<{
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  canChangePreSeal: false;
  canChangeCoreWatermark: false;
  canAutoApplyProductChange: false;
  storesSecretsInPlaintext: false;
  sendsCustomerContentExternally: false;
}>;

export const PLATFORM_SAFETY_ENVELOPE: PlatformSafetyEnvelope = Object.freeze({
  canOpenVault: false,
  canConfirmFinal: false,
  canChangeThreshold: false,
  canChangeOwnership: false,
  canChangePreSeal: false,
  canChangeCoreWatermark: false,
  canAutoApplyProductChange: false,
  storesSecretsInPlaintext: false,
  sendsCustomerContentExternally: false,
});

export type PlatformNoopImplementationNotice = Readonly<{
  mode: "noop";
  configured: false;
  integrationActive: false;
  externalServiceCalled: false;
  runtimeBehaviorChanged: false;
  reason: "not_configured";
  safety: PlatformSafetyEnvelope;
}>;

export const PLATFORM_NOOP_NOTICE: PlatformNoopImplementationNotice = Object.freeze({
  mode: "noop",
  configured: false,
  integrationActive: false,
  externalServiceCalled: false,
  runtimeBehaviorChanged: false,
  reason: "not_configured",
  safety: PLATFORM_SAFETY_ENVELOPE,
});

export type PlatformOperationResult<T = undefined> = Readonly<{
  ok: boolean;
  status: PlatformOperationStatus;
  adapter: string;
  reason: string;
  data?: T;
  notice: PlatformNoopImplementationNotice;
  safety: PlatformSafetyEnvelope;
}>;

export function noopResult<T>(
  adapter: string,
  reason: string,
  data?: T,
): PlatformOperationResult<T> {
  return Object.freeze({
    ok: false,
    status: "not_configured" as const,
    adapter,
    reason,
    ...(data === undefined ? {} : { data }),
    notice: PLATFORM_NOOP_NOTICE,
    safety: PLATFORM_SAFETY_ENVELOPE,
  });
}

export function noopHealth(adapter: string): PlatformOperationResult<{
  health: "not_configured";
  mode: "noop";
}> {
  return noopResult(adapter, `${adapter}_not_configured`, {
    health: "not_configured",
    mode: "noop",
  });
}
