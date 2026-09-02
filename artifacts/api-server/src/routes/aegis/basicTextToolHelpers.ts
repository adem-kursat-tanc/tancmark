export function optionalNumberOption(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

export function optionalStringOption(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
