export interface LiveCdnPlan {
  cdnStrategy: "external_cdn_future";
  candidates: readonly ["BunnyCDN", "Cloudflare", "future_external_cdn"];
  buildOwnGlobalCdnThisPhase: false;
  realCdnEnabled: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
}

export function getLiveCdnPlan(): LiveCdnPlan {
  return {
    cdnStrategy: "external_cdn_future",
    candidates: ["BunnyCDN", "Cloudflare", "future_external_cdn"],
    buildOwnGlobalCdnThisPhase: false,
    realCdnEnabled: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}
