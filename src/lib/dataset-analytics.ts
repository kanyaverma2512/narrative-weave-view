/**
 * Derived analytics for NEXUS.
 *
 * Raw datasets -> unified records (src/lib/dataset.ts) -> this analytics layer -> UI.
 * All numbers come from dataset fields. Where a dataset has no value for something
 * (for example X carries no engagement metrics), the result is null/empty so the UI
 * can show a "data unavailable" state instead of a made-up number.
 */
import { accountKey, dateLabel, engagementTotal, records, sortTime, uniqueSorted, type DatasetRecord } from "./dataset";
import { geoFor } from "./dataset-geo";
import type {
  CountItem, IntelSnapshot, LivePost, MapCity, NetworkEdge, NetworkNode,
  Platform, ReplayEvent, SourceStatus, StateActivity,
} from "./intel-types";

export type Filters = {
  search: string;
  platform: Platform | "All";
  sentiment: string;
  topic: string;
  stage: string;
  from: string;
  to: string;
};

export const emptyFilters: Filters = { search: "", platform: "All", sentiment: "All", topic: "All", stage: "All", from: "", to: "" };

export const ALL_PLATFORMS: Platform[] = ["X", "Instagram", "Reddit", "Telegram"];

export const filterOptions = {
  sentiments: uniqueSorted(records.map((r) => r.sentimentRaw)),
  topics: uniqueSorted(records.map((r) => r.topic)),
  stages: uniqueSorted(records.map((r) => r.narrativeStage)),
  dates: uniqueSorted(records.map((r) => r.date)),
};

const PLATFORM_FILL: Record<Platform, string> = {
  X: "var(--platform-x)",
  Telegram: "var(--platform-telegram)",
  Reddit: "var(--platform-reddit)",
  Instagram: "var(--platform-instagram)",
};

const SENTIMENT_COLOR: Record<string, string> = {
  Concerned: "var(--chart-anxiety)",
  Neutral: "var(--chart-neutral)",
  Supportive: "var(--chart-fear)",
};

const tally = (values: (string | null | undefined)[]): CountItem[] => {
  const map = new Map<string, number>();
  for (const v of values) if (v) map.set(v, (map.get(v) ?? 0) + 1);
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

export function applyFilters(all: DatasetRecord[], f: Filters): DatasetRecord[] {
  const needle = f.search.trim().toLowerCase();
  return all.filter((r) => {
    if (f.platform !== "All" && r.platform !== f.platform) return false;
    if (f.sentiment !== "All" && r.sentimentRaw !== f.sentiment) return false;
    if (f.topic !== "All" && r.topic !== f.topic) return false;
    if (f.stage !== "All" && r.narrativeStage !== f.stage) return false;
    if (f.from && (!r.date || r.date < f.from)) return false;
    if (f.to && (!r.date || r.date > f.to)) return false;
    if (needle) {
      const hay = [r.author, r.handle, r.text, r.topic, r.narrativeStage, r.location, r.event, ...r.entities].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

function toPost(r: DatasetRecord): LivePost {
  return {
    id: r.id,
    platform: r.platform,
    author: r.author ?? r.handle ?? "Unknown account",
    handle: r.handle ?? r.author ?? "Unknown account",
    time: dateLabel(r),
    text: r.text ?? "No summary in dataset",
    sentiment: r.sentiment,
    sentimentRaw: r.sentimentRaw,
    emotion: r.emotion,
    stance: r.stance,
    actorType: r.actorType,
    topic: r.topic,
    narrativeStage: r.narrativeStage,
    location: r.location,
    mediaType: r.mediaType,
    entities: r.entities,
    engagement: engagementTotal(r),
    engagementDetail: r.engagement ?? {},
    url: r.sourceUrl,
    source: r.source,
    sourceType: r.sourceType,
    dataNote: r.dataNote,
    keyEvent: r.keyEvent,
    bridgeCandidate: r.bridgeCandidate,
  };
}

function buildTimeline(rows: DatasetRecord[]) {
  const map = new Map<string, { total: number; concerned: number }>();
  for (const r of rows) {
    const key = r.date ?? r.period;
    if (!key) continue;
    const entry = map.get(key) ?? { total: 0, concerned: 0 };
    entry.total += 1;
    if (r.sentiment === "Concerned") entry.concerned += 1;
    map.set(key, entry);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([time, v]) => ({ time, total: v.total, concerned: v.concerned }));
}

function buildNetwork(rows: DatasetRecord[]) {
  const accounts = new Map<string, { rows: DatasetRecord[]; platform: Platform }>();
  for (const r of rows) {
    const key = accountKey(r);
    const entry = accounts.get(key) ?? { rows: [], platform: r.platform };
    entry.rows.push(r);
    accounts.set(key, entry);
  }

  const ranked = [...accounts.entries()].map(([key, v]) => {
    const engagements = v.rows.map(engagementTotal).filter((n): n is number => n !== null);
    return {
      key,
      label: v.rows[0]!.author ?? v.rows[0]!.handle ?? key,
      handle: v.rows[0]!.handle ?? v.rows[0]!.author ?? key,
      platform: v.platform,
      posts: v.rows.length,
      engagement: engagements.length ? engagements.reduce((a, b) => a + b, 0) : null,
      url: v.rows.find((r) => r.sourceUrl)?.sourceUrl ?? null,
      rows: v.rows,
    };
  }).sort((a, b) => b.posts - a.posts || (b.engagement ?? 0) - (a.engagement ?? 0));

  const maxPosts = Math.max(1, ...ranked.map((r) => r.posts));
  // Layout: one sector per platform lane, accounts spread over concentric rings
  // inside that sector so nodes never sit on top of each other.
  const laneTotals = new Map<Platform, number>();
  for (const r of ranked) laneTotals.set(r.platform, (laneTotals.get(r.platform) ?? 0) + 1);
  const byPlatform = new Map<Platform, number>();
  const nodes: NetworkNode[] = ranked.map((r) => {
    const lane = ALL_PLATFORMS.indexOf(r.platform);
    const slot = byPlatform.get(r.platform) ?? 0;
    byPlatform.set(r.platform, slot + 1);
    const total = laneTotals.get(r.platform) ?? 1;
    const perRing = 7;
    const ring = Math.floor(slot / perRing);
    const inRing = slot % perRing;
    const ringCount = Math.min(perRing, total - ring * perRing);
    const sector = (Math.PI * 2) / ALL_PLATFORMS.length;
    const angle = lane * sector + ((inRing + 0.5) / Math.max(1, ringCount)) * sector * 0.86 + sector * 0.07;
    const radius = 17 + ring * 10;
    return {
      id: r.key,
      label: r.label,
      handle: r.handle,
      platform: r.platform,
      posts: r.posts,
      engagement: r.engagement,
      influence: Math.max(0.2, r.posts / maxPosts),
      url: r.url,
      x: Math.round(50 + Math.cos(angle) * radius),
      y: Math.round(50 + Math.sin(angle) * radius * 0.92),
    };
  });

  // Edges only from explicit dataset evidence.
  const edgeMap = new Map<string, NetworkEdge>();
  const addEdge = (a: string, b: string, kind: string) => {
    if (a === b) return;
    const [from, to] = a < b ? [a, b] : [b, a];
    const id = `${from}|${to}|${kind}`;
    const existing = edgeMap.get(id);
    if (existing) existing.weight += 1;
    else edgeMap.set(id, { from, to, weight: 1, kind });
  };

  // 1. Shared source URL (same archived page / same Reddit thread / same channel).
  const bySource = new Map<string, Set<string>>();
  // 2. Shared event label recorded in the dataset.
  const byEvent = new Map<string, Set<string>>();
  for (const r of rows) {
    if (r.sourceUrl) {
      const set = bySource.get(r.sourceUrl) ?? new Set();
      set.add(accountKey(r));
      bySource.set(r.sourceUrl, set);
    }
    if (r.event) {
      const set = byEvent.get(r.event) ?? new Set();
      set.add(accountKey(r));
      byEvent.set(r.event, set);
    }
  }
  for (const set of bySource.values()) {
    const list = [...set];
    list.forEach((a, i) => list.slice(i + 1).forEach((b) => addEdge(a, b, "Shared source")));
  }
  for (const set of byEvent.values()) {
    const list = [...set];
    list.forEach((a, i) => list.slice(i + 1).forEach((b) => addEdge(a, b, "Shared event")));
  }

  // 3. Entity mentions that name another account present in the data.
  const nameIndex = new Map<string, string[]>();
  for (const n of nodes) {
    for (const alias of [n.label, n.handle.replace(/^[@u_]+/, "")]) {
      const norm = alias.toLowerCase().replace(/[._]/g, " ").trim();
      if (norm.length < 4) continue;
      nameIndex.set(norm, [...(nameIndex.get(norm) ?? []), n.id]);
    }
  }
  for (const r of rows) {
    for (const entity of r.entities) {
      const norm = entity.toLowerCase().replace(/^#/, "").replace(/[._]/g, " ").trim();
      for (const [name, ids] of nameIndex) {
        if (name === norm) for (const id of ids) addEdge(accountKey(r), id, "Mention");
      }
    }
  }

  const edges = [...edgeMap.values()].filter((e) => nodes.some((n) => n.id === e.from) && nodes.some((n) => n.id === e.to));

  // Communities = connected components of the evidence graph.
  const parent = new Map(nodes.map((n) => [n.id, n.id]));
  const find = (x: string): string => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x)!)), parent.get(x)!));
  for (const e of edges) parent.set(find(e.from), find(e.to));
  const communities = new Set(nodes.map((n) => find(n.id))).size;

  // Bridges = accounts linked to at least two different platforms.
  const neighbourPlatforms = new Map<string, Set<Platform>>();
  const platformOf = new Map(nodes.map((n) => [n.id, n.platform]));
  for (const e of edges) {
    for (const [a, b] of [[e.from, e.to], [e.to, e.from]] as const) {
      const set = neighbourPlatforms.get(a) ?? new Set<Platform>();
      set.add(platformOf.get(b)!);
      neighbourPlatforms.set(a, set);
    }
  }
  const bridges = nodes.filter((n) => {
    const set = neighbourPlatforms.get(n.id);
    return set ? [...set].some((p) => p !== n.platform) : false;
  }).length;

  return { nodes, edges, communities, bridges, connections: edges.length };
}

function buildGeo(rows: DatasetRecord[]) {
  const stateTally = new Map<string, { posts: number; concerned: number }>();
  const cityTally = new Map<string, MapCity>();
  const unmapped = new Map<string, number>();
  for (const r of rows) {
    const point = geoFor(r.location);
    if (!point) {
      if (r.location) unmapped.set(r.location, (unmapped.get(r.location) ?? 0) + 1);
      continue;
    }
    const s = stateTally.get(point.state) ?? { posts: 0, concerned: 0 };
    s.posts += 1;
    if (r.sentiment === "Concerned") s.concerned += 1;
    stateTally.set(point.state, s);
    const c = cityTally.get(point.city) ?? { name: point.city, lon: point.lon, lat: point.lat, posts: 0 };
    c.posts += 1;
    cityTally.set(point.city, c);
  }
  const states: StateActivity[] = [...stateTally.entries()]
    .map(([state, v]) => ({
      state,
      posts: v.posts,
      sentiment: v.posts === 0 ? "Unknown" : v.concerned / v.posts > 0.5 ? "Mostly negative" : v.concerned > 0 ? "Mixed" : "Non-negative",
    }))
    .sort((a, b) => b.posts - a.posts);
  const cities = [...cityTally.values()].sort((a, b) => b.posts - a.posts);
  const unmappedLocations = [...unmapped.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  return { states, cities, unmappedLocations };
}

function buildAlerts(rows: DatasetRecord[], timeline: IntelSnapshot["timeline"], states: StateActivity[]): IntelSnapshot["alerts"] {
  const out: IntelSnapshot["alerts"] = [];
  const keyEvents = rows.filter((r) => r.keyEvent).sort((a, b) => sortTime(a) - sortTime(b));
  for (const r of keyEvents) {
    out.push({
      title: r.event ?? r.topic ?? "Key event",
      detail: r.text ?? "No summary in dataset",
      time: dateLabel(r),
      level: "High",
      signal: `Flagged key_event · ${r.platform} · ${r.handle ?? r.author ?? ""}`.trim(),
      url: r.sourceUrl,
    });
  }
  const peak = timeline.reduce<IntelSnapshot["timeline"][number] | null>((a, b) => (!a || b.total > a.total ? b : a), null);
  if (peak) {
    out.push({
      title: `Volume peak — ${peak.time}`,
      detail: `${peak.total} records dated ${peak.time}, of which ${peak.concerned} carry a negative sentiment label.`,
      time: peak.time,
      level: peak.concerned / Math.max(1, peak.total) > 0.5 ? "High" : "Medium",
      signal: "Dated record volume",
    });
  }
  const bridgeRows = rows.filter((r) => r.bridgeCandidate);
  if (bridgeRows.length) {
    const who = uniqueSorted(bridgeRows.map((r) => r.handle ?? r.author));
    out.push({
      title: "Bridge accounts flagged",
      detail: `${who.length} accounts are marked as bridge candidates in the datasets: ${who.slice(0, 5).join(", ")}${who.length > 5 ? "…" : ""}.`,
      time: dateLabel(bridgeRows[bridgeRows.length - 1]!),
      level: "Medium",
      signal: "Dataset bridge_candidate field",
    });
  }
  const platforms = uniqueSorted(rows.map((r) => r.platform));
  if (platforms.length > 1) {
    out.push({
      title: "Cross-platform presence",
      detail: `This selection spans ${platforms.join(", ")}.`,
      time: timeline[timeline.length - 1]?.time ?? "—",
      level: "Low",
      signal: "Platform field",
    });
  }
  const top = states[0];
  if (top) {
    out.push({
      title: `Regional concentration — ${top.state}`,
      detail: `${top.posts} records carry a mappable location in ${top.state}. Sentiment mix: ${top.sentiment}.`,
      time: timeline[timeline.length - 1]?.time ?? "—",
      level: "Low",
      signal: "Dataset location field",
    });
  }
  return out;
}

function buildReplay(rows: DatasetRecord[]): ReplayEvent[] {
  const ordered = [...rows].sort((a, b) => sortTime(a) - sortTime(b));
  const keyRows = ordered.filter((r) => r.keyEvent);
  const milestones = keyRows.length ? keyRows : ordered.filter((r, i, arr) => i === 0 || r.narrativeStage !== arr[i - 1]!.narrativeStage);
  const accounts = new Set<string>();
  let posts = 0;
  let engagement = 0;
  let hasEngagement = false;
  let cursor = 0;
  const out: ReplayEvent[] = [];
  milestones.forEach((m, i) => {
    while (cursor < ordered.length && sortTime(ordered[cursor]!) <= sortTime(m)) {
      const r = ordered[cursor]!;
      posts += 1;
      accounts.add(accountKey(r));
      const e = engagementTotal(r);
      if (e !== null) { engagement += e; hasEngagement = true; }
      cursor += 1;
    }
    out.push({
      id: m.id,
      date: dateLabel(m),
      label: m.event ?? m.narrativeStage ?? m.topic ?? "Event",
      detail: m.text ?? "No summary in dataset",
      platform: m.platform,
      handle: m.handle ?? m.author ?? "Unknown account",
      url: m.sourceUrl,
      postsSoFar: posts,
      accountsSoFar: accounts.size,
      engagementSoFar: hasEngagement ? engagement : null,
      x: Math.round(8 + (i / Math.max(1, milestones.length - 1)) * 84),
      y: 20 + ALL_PLATFORMS.indexOf(m.platform) * 18,
    });
  });
  return out;
}

export function buildSnapshot(filters: Filters): IntelSnapshot {
  const rows = applyFilters(records, filters);
  const posts = [...rows].sort((a, b) => sortTime(b) - sortTime(a)).map(toPost);
  const timeline = buildTimeline(rows);
  const network = buildNetwork(rows);
  const geo = buildGeo(rows);

  const total = rows.length;
  const platformCounts = tally(rows.map((r) => r.platform));
  const platformData = platformCounts.map((p) => ({
    name: p.name,
    count: p.count,
    value: total ? Math.round((p.count / total) * 1000) / 10 : 0,
    fill: PLATFORM_FILL[p.name as Platform] ?? "var(--primary)",
  }));

  const sentimentCounts = tally(rows.map((r) => r.sentiment));
  const withSentiment = sentimentCounts.reduce((n, s) => n + s.count, 0);
  const sentimentMix = sentimentCounts.map((s) => ({
    name: s.name,
    count: s.count,
    value: withSentiment ? Math.round((s.count / withSentiment) * 1000) / 10 : 0,
    color: SENTIMENT_COLOR[s.name] ?? "var(--primary)",
  }));

  const engagementValues = rows.map(engagementTotal).filter((n): n is number => n !== null);
  const negative = rows.filter((r) => r.sentiment === "Concerned").length;

  const sources: SourceStatus[] = ALL_PLATFORMS.map((platform) => {
    const count = rows.filter((r) => r.platform === platform).length;
    const sample = records.find((r) => r.platform === platform);
    const note = count > 0 ? sample?.sourceType : "No records match the current filters";
    return {
      platform,
      status: count > 0 ? "loaded" : "unavailable",
      count,
      ...(note ? { note } : {}),
    };
  });

  const influencers = [...network.nodes]
    .sort((a, b) => (b.engagement ?? -1) - (a.engagement ?? -1) || b.posts - a.posts)
    .slice(0, 12)
    .map((n) => ({ key: n.id, label: n.label, handle: n.handle, platform: n.platform, posts: n.posts, engagement: n.engagement, url: n.url }));

  const dates = rows.map((r) => r.date).filter((d): d is string => Boolean(d)).sort();

  return {
    query: filters.search.trim() || "Cockroach Janta Party dataset",
    latestDate: dates[dates.length - 1] ?? null,
    earliestDate: dates[0] ?? null,
    sources,
    posts,
    timeline,
    platformData,
    sentimentMix,
    emotions: tally(rows.map((r) => r.emotion)),
    topics: tally(rows.map((r) => r.topic)),
    stages: tally(rows.map((r) => r.narrativeStage)),
    actorTypes: tally(rows.map((r) => r.actorType)),
    mediaTypes: tally(rows.map((r) => r.mediaType)),
    influencers,
    alerts: buildAlerts(rows, timeline, geo.states),
    network,
    states: geo.states,
    cities: geo.cities,
    unmappedLocations: geo.unmappedLocations,
    replay: buildReplay(rows),
    totals: {
      posts: total,
      accounts: network.nodes.length,
      platforms: platformCounts.length,
      regions: geo.states.length,
      engagement: engagementValues.length ? engagementValues.reduce((a, b) => a + b, 0) : null,
      negativeShare: withSentiment ? Math.round((negative / withSentiment) * 1000) / 10 : 0,
      withEngagement: engagementValues.length,
      withSentiment,
    },
  };
}
