// SPDX-License-Identifier: AGPL-3.0-only

export const DETERMINISTIC_ORDER_ALGORITHM = "UTF8_BYTEWISE_PATH_ORDER_V2";

export function normalizeDeterministicPath(value) {
  return String(value).replaceAll("\\", "/");
}

export function compareUtf8Bytewise(left, right) {
  return Buffer.compare(
    Buffer.from(normalizeDeterministicPath(left), "utf8"),
    Buffer.from(normalizeDeterministicPath(right), "utf8"),
  );
}

export function compareUtf8By(selector) {
  return (left, right) => compareUtf8Bytewise(selector(left), selector(right));
}

export function sortUtf8Bytewise(values) {
  return [...values].sort(compareUtf8Bytewise);
}
