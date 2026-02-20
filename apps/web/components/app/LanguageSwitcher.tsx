"use client";

import { useTranslation } from "@/lib/i18n";
import { SUPPORTED_LOCALES, LOCALE_NAMES, LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";

export function LanguageSwitcher() {
  const { locale } = useTranslation();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLocale = e.target.value as Locale;
    document.cookie = `${LOCALE_COOKIE}=${newLocale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    window.location.reload();
  };

  return (
    <select
      value={locale}
      onChange={handleChange}
      aria-label="Select language"
      className="h-8 rounded-lg border border-white/10 bg-white/5 px-2 text-xs text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
    >
      {SUPPORTED_LOCALES.map((loc) => (
        <option key={loc} value={loc} className="bg-card text-foreground">
          {LOCALE_NAMES[loc]}
        </option>
      ))}
    </select>
  );
}
