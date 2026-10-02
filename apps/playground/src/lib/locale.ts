export type Locale = "zh-CN" | "en";

export function isLocale(value: string | null): value is Locale {
  return value === "zh-CN" || value === "en";
}

export function resolveLocale(query: string | null, saved: string | null, languages: readonly string[]): Locale {
  if (isLocale(query)) return query;
  if (isLocale(saved)) return saved;
  for (const language of languages) {
    if (/^zh(?:-|$)/i.test(language)) return "zh-CN";
    if (/^en(?:-|$)/i.test(language)) return "en";
  }
  return "en";
}
