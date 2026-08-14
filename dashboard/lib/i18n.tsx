"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import esDict from "@/locales/es.json";
import enDict from "@/locales/en.json";

export type Lang = "es" | "en";

const DICTS: Record<Lang, Record<string, string>> = {
  es: esDict as Record<string, string>,
  en: enDict as Record<string, string>
};

const STORAGE_KEY = "liniers.lang";
const DEFAULT_LANG: Lang = "es";

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** UI string by dictionary key (falls back to es, then to the key itself). */
  t: (key: string) => string;
  /** Content value that may be a string or a per-language map. */
  pick: (value: unknown) => string;
  fmtDateTime: (ts?: string | null) => string;
  fmtDate: (ts?: string | null) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "es" || stored === "en") setLangState(stored);
    } catch {
      /* localStorage unavailable: keep default */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang;
    document.title = DICTS[lang]["app.docTitle"] ?? "Liniers";
  }, [lang]);

  const setLang = useCallback((next: Lang) => setLangState(next), []);

  const t = useCallback(
    (key: string): string => DICTS[lang][key] ?? DICTS.es[key] ?? key,
    [lang]
  );

  const pick = useCallback(
    (value: unknown): string => {
      if (typeof value === "string") return value;
      if (value && typeof value === "object") {
        const map = value as Record<string, unknown>;
        const candidate = map[lang] ?? map.es ?? Object.values(map)[0];
        if (typeof candidate === "string") return candidate;
      }
      return "";
    },
    [lang]
  );

  const locale = lang === "es" ? "es-AR" : "en-US";

  const fmtDateTime = useCallback(
    (ts?: string | null): string => {
      if (!ts) return "";
      const date = new Date(ts);
      if (Number.isNaN(date.getTime())) return String(ts);
      return new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }).format(date);
    },
    [locale]
  );

  const fmtDate = useCallback(
    (ts?: string | null): string => {
      if (!ts) return "";
      const date = new Date(ts);
      if (Number.isNaN(date.getTime())) return String(ts);
      return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(date);
    },
    [locale]
  );

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang, t, pick, fmtDateTime, fmtDate }),
    [lang, setLang, t, pick, fmtDateTime, fmtDate]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
