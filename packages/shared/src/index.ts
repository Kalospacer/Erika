/** Shared query-param schema and resource limits (design doc section 7.2 / 10.1). */

import { z } from "zod";

export const LIMITS = {
  titleChars: 80,
  descriptionChars: 300,
  /** absolute request URL cap. The legal worst case is a 300-character CJK
   * description (~2.7 KB once percent-encoded) plus path and host, so 2 KB
   * rejected requests the schema accepted. Measured: GitHub's camo chain
   * rewrites image URLs by hex-encoding them (~2x + ~100 chars) and accepted a
   * 4 KB source URL / 8.2 KB camo URL without complaint. */
  urlLength: 4096,
  scaleMax: 1,
  scaleMin: 0.1,
  iconMaxBytes: 5 * 1024 * 1024,
  iconMaxPixels: 4096,
  iconTimeoutMs: 5000,
  iconPathChars: 128,
  renderCacheMB: 512,
  avatarCacheMB: 64,
} as const;

/** Metadata fields a template can declare in its topline/footer zones. */
export const META_FIELDS = ["stars", "forks", "issues", "release", "full_name"] as const;
export type MetaField = (typeof META_FIELDS)[number];

export const FORMATS = ["webp", "png"] as const;
export type ImageFormat = (typeof FORMATS)[number];

/** Icon sources: auto = the subject repo's own icon, falling back to the
 * template's default Grokbot icon (never the avatar); avatars always take the
 * avatar template. */
export const ICON_SOURCES = ["auto", "avatar", "builtin"] as const;
export type IconSource = (typeof ICON_SOURCES)[number];

export const bannerQuerySchema = z.object({
  theme: z.string().max(32).optional(),
  title: z.string().max(LIMITS.titleChars).optional(),
  description: z.string().max(LIMITS.descriptionChars).optional(),
  /** csv of metadata fields, e.g. "stars,release"; empty = show none */
  meta: z.string().max(96).optional(),
  icon: z.enum(ICON_SOURCES).optional(),
  /** repo-relative override for the project icon (e.g. "assets/mine.webp") */
  iconPath: z
    .string()
    .max(LIMITS.iconPathChars)
    .regex(/^[A-Za-z0-9._][A-Za-z0-9._/-]*$/, "relative path only")
    .refine((p) => !p.includes(".."), "no parent traversal")
    .optional(),
  /** explicit display mode; overrides template/preset icon config */
  iconFit: z.enum(["contain", "cover"]).optional(),
  /** explicit circle mask; overrides template/preset icon config */
  iconRound: z.enum(["0", "1"]).optional(),
  /** lower bound keeps the smallest render at a sane size (300x180 on classic) */
  scale: z.coerce.number().gte(0.1).lte(LIMITS.scaleMax).optional(),
  lang: z.enum(["en", "zh"]).optional(),
  fresh: z.string().optional(),
});

export type BannerQuery = z.infer<typeof bannerQuerySchema>;

export interface NormalizedQuery {
  theme: string;
  scale: number;
  lang: "en" | "zh";
  title?: string;
  description?: string;
  meta?: string[];
  icon?: IconSource;
  iconPath?: string;
  iconFit?: "contain" | "cover";
  iconRound?: "0" | "1";
  fresh?: string;
}

/** Normalize a query object into the canonical form used for cache keys. */
export function normalizeQuery(q: BannerQuery): NormalizedQuery {
  return {
    theme: q.theme ?? "",
    scale: q.scale ?? 0.5,
    lang: q.lang ?? "en",
    title: q.title,
    description: q.description,
    meta: q.meta
      ? q.meta.split(",").map((s) => s.trim()).filter(Boolean)
      : q.meta === ""
        ? []
        : undefined,
    icon: q.icon,
    iconPath: q.iconPath,
    iconFit: q.iconFit,
    iconRound: q.iconRound,
    fresh: q.fresh,
  };
}

export function parseMetaFields(meta: string[] | undefined): MetaField[] {
  const list = meta ?? [];
  return list.filter((s): s is MetaField => (META_FIELDS as readonly string[]).includes(s));
}
