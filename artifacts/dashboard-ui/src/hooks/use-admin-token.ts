import { useEffect, useState } from "react";
import { hasAdminToken, subscribeAdminToken } from "@/lib/admin-token-store";

export function useAdminToken(): { hasToken: boolean } {
  const [hasTokenState, setHasTokenState] = useState<boolean>(() => hasAdminToken());

  useEffect(() => {
    const sync = () => setHasTokenState(hasAdminToken());
    return subscribeAdminToken(sync);
  }, []);

  return { hasToken: hasTokenState };
}
