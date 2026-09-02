import type { ApiKey, Client } from "@workspace/db";
import type { VerifiedSealPrincipal } from "../middlewares/verifiedSealPrincipal";

declare global {
  namespace Express {
    interface Request {
      apiClient?: Client;
      apiKey?: ApiKey;
      verifiedSealPrincipal?: VerifiedSealPrincipal;
    }
  }
}

export {};
