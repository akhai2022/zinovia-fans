/**
 * Replace {key} placeholders in a template string with values.
 * Example: interpolate("Unlock for {price}", { price: "4.99 EUR" }) → "Unlock for 4.99 EUR"
 */
export function interpolate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    vars[key] !== undefined ? String(vars[key]) : `{${key}}`,
  );
}
