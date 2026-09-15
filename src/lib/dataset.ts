/**
 * Unified NEXUS data model.
 *
 * Four annotated datasets (X, Instagram, Reddit, Telegram) are normalised into a
 * single record shape at build time (see src/data/nexus-dataset.json).
 * Nothing here invents values: every field is read straight from the source files,
 * and derived fields are clearly marked as derived.
 */
import raw from "@/data/nexus-dataset.json";
import type { Platform } from "@/data/nexus-data";

export type SentimentClass = "Concerned" | "Neutral" | "Supportive";

export type DatasetRecord = {
  id: string;
  platform: Platform;
  /** Display name of the account/channel/subreddit, as given by the dataset. */
  author: string | null;
  /** Handle/username as given by the dataset. */
  handle: string | null;
  actorType: string | null;
  /** Exact date (YYYY-MM-DD) when the dataset provides one. */
  date: string | null;
  /** Coarse period label (e.g. "2026-07") when the dataset only gives a period. */
  period: string | null;
  timestamp?: string | null;
  /** Summary text supplied by the dataset (datasets carry summaries, not verbatim posts). */
  text: string | null;
  topic: string | null;
  narrative: string | null;
  event: string | null;
  narrativeStage: string | null;
  stance: string | null;
  /** Sentiment label exactly as written in the dataset. */
  sentimentRaw: string | null;
  /** Sentiment label folded into the three classes the UI renders. */
  sentiment: SentimentClass | null;
  emotion: string | null;
  location: string | null;
  entities: string[];
  engagement: Partial<Record<"likes" | "comments" | "shares" | "views" | "reactions" | "forwards" | "upvotes", number>>;
  mediaType: string | null;
  sourceUrl: string | null;
  source: string | null;
  sourceType: string | null;
  dataNote: string | null;
  keyEvent: boolean;
  bridgeCandidate: boolean;
  isCrosspost?: boolean;
  subreddit?: string | null;
};

export const records = raw as DatasetRecord[];

/** Stable account key — same handle on two platforms stays two nodes. */
export const accountKey = (r: DatasetRecord) => `${r.platform}:${r.handle ?? r.author ?? "unknown"}`;

/** Sum of the engagement fields the dataset actually provides. Null when none exist. */
export function engagementTotal(r: DatasetRecord): number | null {
  const values = Object.values(r.engagement ?? {});
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0);
}

/** Sortable timestamp; records with only a period sort at the start of that period. */
export function sortTime(r: DatasetRecord): number {
  if (r.timestamp) return Date.parse(r.timestamp.replace(" ", "T") + "Z");
  if (r.date) return Date.parse(`${r.date}T00:00:00Z`);
  if (r.period && /^\d{4}-\d{2}$/.test(r.period)) return Date.parse(`${r.period}-01T00:00:00Z`);
  return 0;
}

/** Human date label for a record — falls back to the period label the dataset gives. */
export function dateLabel(r: DatasetRecord): string {
  if (r.date) return r.date;
  if (r.period) return r.period;
  return "Date unavailable";
}

export const uniqueSorted = (values: (string | null | undefined)[]) =>
  [...new Set(values.filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b));
