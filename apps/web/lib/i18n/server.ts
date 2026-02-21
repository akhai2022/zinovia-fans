import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, SUPPORTED_LOCALES, type Locale } from "./config";
import { getDictionary } from "./dictionaries";

/**
 * Resolve the user's locale and return the corresponding dictionary.
 * For use in server components that need translated strings.
 */
export async function getServerDictionary() {
  const localeCookie = cookies().get(LOCALE_COOKIE)?.value ?? DEFAULT_LOCALE;
  const locale: Locale = (SUPPORTED_LOCALES as readonly string[]).includes(localeCookie)
    ? (localeCookie as Locale)
    : DEFAULT_LOCALE;
  const dictionary = await getDictionary(locale);
  return { locale, dictionary };
}
