import { AsyncLocalStorage } from "node:async_hooks";

const canonicalLiveExactScope = new AsyncLocalStorage<true>();

function productRuntimeActive(): boolean {
  return process.env["NODE_ENV"] === "production" || process.env["AEGIS_PRODUCT_RUNTIME"] === "1";
}

export function runWithinCanonicalLiveExactVerification<T>(operation: () => Promise<T>): Promise<T> {
  return canonicalLiveExactScope.run(true, operation);
}

export function assertCanonicalReaderInvocationAllowed(): void {
  if (productRuntimeActive() && canonicalLiveExactScope.getStore() !== true) {
    throw new Error("canonical_video_reader_live_scope_required");
  }
}
