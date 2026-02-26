import type { Locale } from "../config";
import type { Dictionary } from "../types";
import { en } from "./en";

const loaders: Record<Locale, () => Promise<Dictionary>> = {
  en: () => Promise.resolve(en),
  es: () => import("./es").then((m) => m.es),
  fr: () => import("./fr").then((m) => m.fr),
  de: () => import("./de").then((m) => m.de),
  pt: () => import("./pt").then((m) => m.pt),
  tr: () => import("./tr").then((m) => m.tr),
  ro: () => import("./ro").then((m) => m.ro),
  pl: () => import("./pl").then((m) => m.pl),
  it: () => import("./it").then((m) => m.it),
  ru: () => import("./ru").then((m) => m.ru),
  ar: () => import("./ar").then((m) => m.ar),
};

/** Resolve the dictionary for a given locale. Falls back to English. */
export async function getDictionary(locale: Locale): Promise<Dictionary> {
  const loader = loaders[locale] ?? loaders.en;
  return loader();
}
