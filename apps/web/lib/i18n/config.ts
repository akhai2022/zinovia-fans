export const SUPPORTED_LOCALES = ["en", "es", "fr", "de", "pt", "tr", "ro", "pl", "it"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "zinovia_locale";

/** Map ISO-3166 country codes to our supported locales. */
export const COUNTRY_TO_LOCALE: Record<string, Locale> = {
  // English
  US: "en", GB: "en", AU: "en", NZ: "en", IE: "en", ZA: "en", IN: "en",
  // Spanish
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", VE: "es",
  EC: "es", GT: "es", CU: "es", DO: "es", HN: "es", PA: "es", UY: "es",
  PY: "es", SV: "es", NI: "es", CR: "es", BO: "es",
  // French
  FR: "fr", BE: "fr", MC: "fr", LU: "fr", SN: "fr", CI: "fr", ML: "fr",
  CM: "fr", MG: "fr", HT: "fr",
  // German
  DE: "de", AT: "de", LI: "de",
  // Portuguese
  BR: "pt", PT: "pt", AO: "pt", MZ: "pt",
  // Turkish
  TR: "tr",
  // Romanian
  RO: "ro", MD: "ro",
  // Polish
  PL: "pl",
  // Italian
  IT: "it", SM: "it",
  // Swiss users: default to German
  CH: "de",
  // Canadian users: default to English (large French minority, but English majority)
  CA: "en",
};

/** Display names for the language picker. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  tr: "Türkçe",
  ro: "Română",
  pl: "Polski",
  it: "Italiano",
};
