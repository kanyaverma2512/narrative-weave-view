/**
 * Cyber threat detection & early warning layer for NEXUS Alerts.
 *
 * Every alert here is derived from the SAME unified dataset used by all other
 * views (src/lib/dataset.ts + applyFilters in dataset-analytics.ts). No threat,
 * account, URL, metric or relationship is invented: each alert lists the record
 * ids it was computed from, and each evidence item carries the record's own
 * source URL (or null when the dataset has none).
 */
import { accountKey, dateLabel, engagementTotal, records, sortTime, type DatasetRecord } from "./dataset";
import { applyFilters, type Filters } from "./dataset-analytics";
import type { Platform } from "./intel-types";

export type Severity = "Critical" | "High" | "Medium" | "Low";
export type ThreatStatus = "New" | "Investigating" | "Confirmed" | "Resolved";
export type ThreatType =
  | "Coordinated Activity"
  | "Misinformation/Disinformation"
  | "Suspicious Activity"
  | "Threat/Violence"
  | "Spam/Bot-like Activity"
  | "Cross-Platform Activity"
  | "Key Event";

export const SEVERITIES: Severity[] = ["Critical", "High", "Medium", "Low"];
export const STATUSES: ThreatStatus[] = ["New", "Investigating", "Confirmed", "Resolved"];
export const THREAT_TYPES: ThreatType[] = [
  "Coordinated Activity", "Misinformation/Disinformation", "Suspicious Activity",
  "Threat/Violence", "Spam/Bot-like Activity", "Cross-Platform Activity", "Key Event",
];

export type Evidence = {
  id: string;
  platform: Platform;
  handle: string;
  date: string;
  summary: string;
  /** Exactly the dataset's source URL for this record; null when absent. */
  url: string | null;
  source: string | null;
  sourceType: string | null;
  sentiment: string | null;
  stage: string | null;
};

export type ThreatAlert = {
  id: string;
  title: string;
  threatType: ThreatType;
  severity: Severity;
  riskScore: number;
  status: ThreatStatus;
  /** Plain description of the observed activity, built from dataset fields. */
  whatHappened: string;
  /** The detection rule and the dataset fields that satisfied it. */
  whyFlagged: string;
  platforms: Platform[];
  accounts: { handle: string; platform: Platform; records: number }[];
  firstSeen: string;
  lastSeen: string;
  recordCount: number;
  recordIds: string[];
  evidence: Evidence[];
  timeline: { time: string; total: number }[];
  crossPlatform: boolean;
  entities: string[];
  locations: string[];
};

const uniq = <T,>(v: T[]) => [...new Set(v)];

const toEvidence = (r: DatasetRecord): Evidence => ({
  id: r.id,
  platform: r.platform,
  handle: r.handle ?? r.author ?? "Unknown account",
  date: dateLabel(r),
  summary: r.text ?? "No summary in dataset",
  url: r.sourceUrl ?? null,
  source: r.source,
  sourceType: r.sourceType,
  sentiment: r.sentimentRaw,
  stage: r.narrativeStage,
});

const negativeShare = (rows: DatasetRecord[]) => {
  const labelled = rows.filter((r) => r.sentiment);
  if (!labelled.length) return 0;
  return labelled.filter((r) => r.sentiment === "Concerned").length / labelled.length;
};

/** Deterministic 0-100 score from real dataset signals only. */
function riskScore(rows: DatasetRecord[]): number {
  const accounts = uniq(rows.map(accountKey)).length;
  const platforms = uniq(rows.map((r) => r.platform)).length;
  const keyEvents = rows.filter((r) => r.keyEvent).length;
  const bridges = uniq(rows.filter((r) => r.bridgeCandidate).map(accountKey)).length;
  const engagement = rows.map(engagementTotal).filter((n): n is number => n !== null).reduce((a, b) => a + b, 0);

  const score =
    Math.min(24, rows.length * 3) +            // volume of supporting records
    Math.min(18, accounts * 3) +               // distinct accounts involved
    (platforms - 1) * 9 +                      // cross-platform spread
    Math.round(negativeShare(rows) * 20) +     // share of negative sentiment labels
    Math.min(16, keyEvents * 8) +              // dataset-flagged key events
    Math.min(8, bridges * 4) +                 // dataset-flagged bridge accounts
    (engagement > 0 ? Math.min(9, Math.round(Math.log10(engagement + 1) * 2)) : 0);

  return Math.max(1, Math.min(100, score));
}

const severityOf = (score: number): Severity => (score >= 75 ? "Critical" : score >= 55 ? "High" : score >= 35 ? "Medium" : "Low");

const RESOLVED_STAGES = ["de-escalation", "deescalation", "resolution"];

function statusOf(rows: DatasetRecord[]): ThreatStatus {
  const ordered = [...rows].sort((a, b) => sortTime(a) - sortTime(b));
  const last = ordered[ordered.length - 1];
  const lastStage = (last?.narrativeStage ?? "").toLowerCase();
  if (RESOLVED_STAGES.some((s) => lastStage.includes(s))) return "Resolved";
  if (rows.some((r) => r.keyEvent)) return "Confirmed";
  const accounts = uniq(rows.map(accountKey)).length;
  const platforms = uniq(rows.map((r) => r.platform)).length;
  if (platforms > 1 || accounts >= 3) return "Investigating";
  return "New";
}

function accountsOf(rows: DatasetRecord[]) {
  const map = new Map<string, { handle: string; platform: Platform; records: number }>();
  for (const r of rows) {
    const key = accountKey(r);
    const entry = map.get(key) ?? { handle: r.handle ?? r.author ?? "Unknown account", platform: r.platform, records: 0 };
    entry.records += 1;
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => b.records - a.records);
}

function timelineOf(rows: DatasetRecord[]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = r.date ?? r.period;
    if (key) map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([time, total]) => ({ time, total }));
}

function makeAlert(args: {
  id: string; title: string; threatType: ThreatType; whatHappened: string; whyFlagged: string; rows: DatasetRecord[];
}): ThreatAlert {
  const { rows } = args;
  const ordered = [...rows].sort((a, b) => sortTime(a) - sortTime(b));
  const score = riskScore(rows);
  const platforms = uniq(rows.map((r) => r.platform));
  return {
    id: args.id,
    title: args.title,
    threatType: args.threatType,
    severity: severityOf(score),
    riskScore: score,
    status: statusOf(rows),
    whatHappened: args.whatHappened,
    whyFlagged: args.whyFlagged,
    platforms,
    accounts: accountsOf(rows),
    firstSeen: dateLabel(ordered[0]!),
    lastSeen: dateLabel(ordered[ordered.length - 1]!),
    recordCount: rows.length,
    recordIds: rows.map((r) => r.id),
    evidence: [...ordered].reverse().map(toEvidence),
    timeline: timelineOf(rows),
    crossPlatform: platforms.length > 1,
    entities: uniq(rows.flatMap((r) => r.entities)).slice(0, 12),
    locations: uniq(rows.map((r) => r.location).filter((l): l is string => Boolean(l))),
  };
}

/** Words that appear in the datasets' own text/topic/event fields. */
const VIOLENCE_TERMS = ["police", "lathi", "baton", "detain", "detention", "arrest", "custody", "clash", "violence", "violent", "force", "crackdown", "assault", "fir "];

function matchesViolence(r: DatasetRecord) {
  const hay = [r.text, r.topic, r.event, r.narrative].filter(Boolean).join(" ").toLowerCase();
  return VIOLENCE_TERMS.some((t) => hay.includes(t));
}

const NARRATIVE_SHIFT_TERMS = ["narrative_shift", "narrative shift", "narrative transition"];

function matchesNarrativeShift(r: DatasetRecord) {
  const hay = [r.narrativeStage, r.topic, r.narrative].filter(Boolean).join(" ").toLowerCase();
  return NARRATIVE_SHIFT_TERMS.some((t) => hay.includes(t));
}

export function buildThreatAlerts(filters: Filters): ThreatAlert[] {
  const rows = applyFilters(records, filters);
  const out: ThreatAlert[] = [];

  /* --- Event clusters: coordinated / cross-platform / key event --- */
  const byEvent = new Map<string, DatasetRecord[]>();
  for (const r of rows) if (r.event) byEvent.set(r.event, [...(byEvent.get(r.event) ?? []), r]);

  for (const [event, group] of byEvent) {
    const accounts = uniq(group.map(accountKey));
    const platforms = uniq(group.map((r) => r.platform));
    const hasKeyEvent = group.some((r) => r.keyEvent);
    if (platforms.length > 1) {
      out.push(makeAlert({
        id: `cross:${event}`,
        title: `Cross-platform incident — ${event}`,
        threatType: "Cross-Platform Activity",
        rows: group,
        whatHappened: `${group.length} records from ${accounts.length} account${accounts.length === 1 ? "" : "s"} across ${platforms.join(", ")} are tagged with the same event "${event}".`,
        whyFlagged: `The dataset's own event field groups these records, and they span ${platforms.length} platforms. No inferred links were added.`,
      }));
    } else if (accounts.length >= 3) {
      out.push(makeAlert({
        id: `coord:${event}`,
        title: `Coordinated activity — ${event}`,
        threatType: "Coordinated Activity",
        rows: group,
        whatHappened: `${accounts.length} separate ${platforms[0]} accounts posted ${group.length} records tagged with the same event "${event}".`,
        whyFlagged: `Three or more distinct accounts share one dataset event label. Coordination is asserted only from that shared label.`,
      }));
    } else if (hasKeyEvent) {
      out.push(makeAlert({
        id: `key:${event}`,
        title: `Key event — ${event}`,
        threatType: "Key Event",
        rows: group,
        whatHappened: `${group.length} record${group.length === 1 ? "" : "s"} on ${platforms.join(", ")} document the event "${event}".`,
        whyFlagged: `At least one record carries the dataset's key_event flag.`,
      }));
    }
  }

  /* --- Shared source URL used by more than one account --- */
  const bySource = new Map<string, DatasetRecord[]>();
  for (const r of rows) if (r.sourceUrl) bySource.set(r.sourceUrl, [...(bySource.get(r.sourceUrl) ?? []), r]);
  for (const [url, group] of bySource) {
    const accounts = uniq(group.map(accountKey));
    if (accounts.length < 2) continue;
    out.push(makeAlert({
      id: `src:${url}`,
      title: `Shared source amplification — ${group[0]!.topic ?? "multiple accounts"}`,
      threatType: "Coordinated Activity",
      rows: group,
      whatHappened: `${accounts.length} of the ${uniq(rows.map(accountKey)).length} accounts in this selection have ${group.length} records recorded against the same source URL on ${uniq(group.map((r) => r.platform)).join(", ")}.`,
      whyFlagged: `Identical source_url across multiple accounts in the dataset.`,
    }));
  }

  /* --- Threat / violence language present in the dataset text --- */
  const violence = rows.filter(matchesViolence);
  if (violence.length) {
    const byEv = new Map<string, DatasetRecord[]>();
    for (const r of violence) byEv.set(r.event ?? r.topic ?? "Unlabelled", [...(byEv.get(r.event ?? r.topic ?? "Unlabelled") ?? []), r]);
    for (const [label, group] of byEv) {
      out.push(makeAlert({
        id: `violence:${label}`,
        title: `Threat / violence reporting — ${label}`,
        threatType: "Threat/Violence",
        rows: group,
        whatHappened: `${group.length} record${group.length === 1 ? "" : "s"} describe policing, detention or confrontation around "${label}".`,
        whyFlagged: `The dataset's own summary/topic/event text contains confrontation terms. Quoted from the records, not inferred.`,
      }));
    }
  }

  /* --- Narrative shift recorded in the dataset --- */
  const shift = rows.filter(matchesNarrativeShift);
  if (shift.length) {
    out.push(makeAlert({
      id: "narrative-shift",
      title: "Narrative shift under way",
      threatType: "Misinformation/Disinformation",
      rows: shift,
      whatHappened: `${shift.length} records are annotated as a narrative shift/transition across ${uniq(shift.map((r) => r.platform)).join(", ")}.`,
      whyFlagged: `Dataset narrative_stage / topic marks these records as a narrative shift. NEXUS does not judge truthfulness — only that the framing changed.`,
    }));
  }

  /* --- Bot-like posting: one account, many records on a single day --- */
  const byAccountDay = new Map<string, DatasetRecord[]>();
  for (const r of rows) {
    if (!r.date) continue;
    const key = `${accountKey(r)}|${r.date}`;
    byAccountDay.set(key, [...(byAccountDay.get(key) ?? []), r]);
  }
  for (const [key, group] of byAccountDay) {
    if (group.length < 3) continue;
    const r0 = group[0]!;
    out.push(makeAlert({
      id: `burst:${key}`,
      title: `Posting burst — ${r0.handle ?? r0.author ?? "account"}`,
      threatType: "Spam/Bot-like Activity",
      rows: group,
      whatHappened: `${r0.handle ?? r0.author} published ${group.length} records on ${r0.date} on ${r0.platform}.`,
      whyFlagged: `Three or more records from one account carry the same date in the dataset. Volume only — no bot classification is claimed.`,
    }));
  }

  /* --- Bridge accounts flagged by the dataset --- */
  const bridgeRows = rows.filter((r) => r.bridgeCandidate);
  if (bridgeRows.length) {
    const byAccount = new Map<string, DatasetRecord[]>();
    for (const r of bridgeRows) byAccount.set(accountKey(r), [...(byAccount.get(accountKey(r)) ?? []), r]);
    for (const [key, group] of byAccount) {
      const r0 = group[0]!;
      out.push(makeAlert({
        id: `bridge:${key}`,
        title: `Suspicious bridge account — ${r0.handle ?? r0.author ?? key}`,
        threatType: "Suspicious Activity",
        rows: group,
        whatHappened: `${r0.handle ?? r0.author} has ${group.length} record${group.length === 1 ? "" : "s"} marked as bridging content between communities on ${r0.platform}.`,
        whyFlagged: `Dataset bridge_candidate flag is set on these records.`,
      }));
    }
  }

  // Highest risk first, then most recent, then largest.
  return out.sort((a, b) => b.riskScore - a.riskScore || b.lastSeen.localeCompare(a.lastSeen) || b.recordCount - a.recordCount);
}

export type ThreatFilters = {
  severity: Severity | "All";
  threatType: ThreatType | "All";
  platform: Platform | "All";
  status: ThreatStatus | "All";
  from: string;
  to: string;
};

export const emptyThreatFilters: ThreatFilters = { severity: "All", threatType: "All", platform: "All", status: "All", from: "", to: "" };

export function applyThreatFilters(alerts: ThreatAlert[], f: ThreatFilters): ThreatAlert[] {
  return alerts.filter((a) => {
    if (f.severity !== "All" && a.severity !== f.severity) return false;
    if (f.threatType !== "All" && a.threatType !== f.threatType) return false;
    if (f.platform !== "All" && !a.platforms.includes(f.platform)) return false;
    if (f.status !== "All" && a.status !== f.status) return false;
    if (f.from && a.lastSeen < f.from) return false;
    if (f.to && a.firstSeen > f.to) return false;
    return true;
  });
}

export function threatSummary(alerts: ThreatAlert[]) {
  return {
    active: alerts.filter((a) => a.status !== "Resolved").length,
    criticalHigh: alerts.filter((a) => a.severity === "Critical" || a.severity === "High").length,
    investigating: alerts.filter((a) => a.status === "Investigating").length,
    crossPlatform: alerts.filter((a) => a.crossPlatform).length,
    resolved: alerts.filter((a) => a.status === "Resolved").length,
    records: uniq(alerts.flatMap((a) => a.recordIds)).length,
  };
}
