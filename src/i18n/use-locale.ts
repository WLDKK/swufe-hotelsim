"use client";

import { useEffect, useMemo, useState } from "react";
import { localeMessages, type SupportedLocale } from "@/i18n/messages";

const STORAGE_KEY = "swufe-hotelsim-locale";

export function resolvePreferredLocale(
  value: string | null | undefined
): SupportedLocale {
  if (!value) {
    return "zh-CN";
  }

  const normalized = value.toLowerCase();
  return normalized.startsWith("zh") ? "zh-CN" : "en-US";
}

export function useLocale() {
  const [locale, setLocaleState] = useState<SupportedLocale>("zh-CN");

  useEffect(() => {
    const storedLocale =
      typeof window !== "undefined"
        ? window.localStorage.getItem(STORAGE_KEY)
        : null;

    const nextLocale = resolvePreferredLocale(
      storedLocale ?? (typeof navigator !== "undefined" ? navigator.language : null)
    );

    setLocaleState(nextLocale);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = (nextLocale: SupportedLocale) => {
    setLocaleState(nextLocale);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, nextLocale);
    }
  };

  // Keep the return shape intentionally tiny so later route-level i18n work
  // can swap in richer dictionaries without forcing page components to change
  // how they read locale-aware content.
  const messages = useMemo(() => localeMessages[locale], [locale]);

  return {
    locale,
    messages,
    setLocale,
  };
}
