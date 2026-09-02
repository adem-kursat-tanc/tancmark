const TOKEN_CHANGED_EVENT = "aegis-admin-token-changed";

let adminToken: string | null = null;

function notifyTokenChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(TOKEN_CHANGED_EVENT));
}

export function getAdminToken(): string | null {
  return adminToken;
}

export function hasAdminToken(): boolean {
  return !!adminToken;
}

export function setAdminToken(value: string): void {
  const trimmed = value.trim();
  adminToken = trimmed.length > 0 ? trimmed : null;
  notifyTokenChanged();
}

export function clearAdminToken(): void {
  adminToken = null;
  notifyTokenChanged();
}

export function subscribeAdminToken(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(TOKEN_CHANGED_EVENT, listener);
  return () => window.removeEventListener(TOKEN_CHANGED_EVENT, listener);
}
