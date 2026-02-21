/**
 * Return the localized display name of a country given its ISO-3166 alpha-2 code.
 * Uses the built-in Intl.DisplayNames API — zero translation data required.
 */
export function getCountryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
