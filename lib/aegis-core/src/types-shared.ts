/**
 * Shared enums used across multiple aegis-core modules to avoid circular
 * imports between `dataCloak.ts` and `sensitiveTopic.ts`.
 */

export type SensitiveTopic =
  | "none"
  | "saglik"
  | "afet"
  | "secim"
  | "hukuk"
  | "yatirim"
  | "savas"
  | "acil";

export type CloakStrength = "low" | "medium" | "high";
