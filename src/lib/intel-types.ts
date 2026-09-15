/**
 * Shared, client-safe types for the NEXUS snapshot.
 * Every value in a snapshot is computed from the bundled annotated datasets.
 */
import type { Platform } from "@/data/nexus-data";
import type { DatasetRecord, SentimentClass } from "./dataset";
import type { MapCity, StateActivity } from "@/components/IndiaMap";

export type { Platform, MapCity, StateActivity, SentimentClass };

export type LivePost = {
  id: string;
  platform: Platform;
  author: string;
  handle: string;
  /** Date (or period) label exactly as the dataset provides it. */
  time: string;
  text: string;
  sentiment: SentimentClass | null;
  sentimentRaw: string | null;
  emotion: string | null;
  stance: string | null;
  actorType: string | null;
  topic: string | null;
  narrativeStage: string | null;
  location: string | null;
  mediaType: string | null;
  entities: string[];
  /** Sum of the engagement fields present for this record; null when the dataset has none. */
  engagement: number | null;
  engagementDetail: DatasetRecord["engagement"];
  url: string | null;
  source: string | null;
  sourceType: string | null;
  dataNote: string | null;
  keyEvent: boolean;
  bridgeCandidate: boolean;
};

export type SourceStatus = {
  platform: Platform;
  status: "loaded" | "unavailable";
  count: number;
  note?: string;
};

export type NetworkNode = {
  id: string;
  label: string;
  handle: string;
  platform: Platform;
  posts: number;
  /** Engagement recorded in the dataset for this account; null when the source has no metrics. */
  engagement: number | null;
  /** 0-1, relative to the most active account in the current selection. */
  influence: number;
  url: string | null;
  x: number;
  y: number;
};

export type NetworkEdge = { from: string; to: string; weight: number; kind: string };

export type ReplayEvent = {
  id: string;
  date: string;
  label: string;
  detail: string;
  platform: Platform;
  handle: string;
  url: string | null;
  postsSoFar: number;
  accountsSoFar: number;
  engagementSoFar: number | null;
  x: number;
  y: number;
};

export type CountItem = { name: string; count: number };

export type IntelSnapshot = {
  query: string;
  /** Latest date present in the filtered selection. */
  latestDate: string | null;
  earliestDate: string | null;
  sources: SourceStatus[];
  posts: LivePost[];
  timeline: { time: string; total: number; concerned: number }[];
  platformData: { name: string; value: number; count: number; fill: string }[];
  sentimentMix: { name: string; value: number; count: number; color: string }[];
  emotions: CountItem[];
  topics: CountItem[];
  stages: CountItem[];
  actorTypes: CountItem[];
  mediaTypes: CountItem[];
  influencers: {
    key: string; label: string; handle: string; platform: Platform;
    posts: number; engagement: number | null; url: string | null;
  }[];
  alerts: { title: string; detail: string; time: string; level: string; signal: string; url?: string | null }[];
  network: {
    nodes: NetworkNode[];
    edges: NetworkEdge[];
    communities: number;
    bridges: number;
    connections: number;
  };
  states: StateActivity[];
  cities: MapCity[];
  /** Records whose location is nationwide or outside the map. */
  unmappedLocations: CountItem[];
  replay: ReplayEvent[];
  totals: {
    posts: number;
    accounts: number;
    platforms: number;
    regions: number;
    /** Total engagement across records that carry engagement metrics; null when none do. */
    engagement: number | null;
    /** Share of records labelled with a negative/concerned sentiment, in percent. */
    negativeShare: number;
    withEngagement: number;
    withSentiment: number;
  };
};
