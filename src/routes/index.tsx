import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRight, Bell, CalendarDays, ChevronRight, CirclePlay, Clock3, ExternalLink, FileText,
  Filter, Globe2, Instagram, LayoutDashboard, Map, MessageCircle, Network, Pause, Play, Radio, RefreshCw, RotateCcw,
  Search, Send, Share2, ShieldAlert, SkipBack, SkipForward, Sparkles, TrendingUp, Users, X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLiveWeb } from "@/lib/live-web.functions";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Platform } from "@/data/nexus-data";
import { cn } from "@/lib/utils";
import { IndiaMap } from "@/components/IndiaMap";
import { useIntel } from "@/lib/use-intel";
import { ALL_PLATFORMS, emptyFilters, filterOptions, type Filters } from "@/lib/dataset-analytics";
import type { IntelSnapshot, LivePost, SourceStatus } from "@/lib/intel-types";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "NEXUS — From Conversations to Clarity" },
    { name: "description", content: "Narrative, sentiment and network intelligence built from annotated X, Instagram, Reddit and Telegram datasets on the Cockroach Janta Party movement." },
    { property: "og:title", content: "NEXUS — From Conversations to Clarity" },
    { property: "og:description", content: "Narrative, sentiment and network intelligence from annotated social-media datasets." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ]}),
  component: Index,
});

type View = "Overview" | "Live Feed" | "Narratives" | "Network" | "Geo Intelligence" | "Analytics" | "Alerts" | "Reports" | "Investigation Replay" | "Live Web Data";

const views: { label: View; icon: typeof LayoutDashboard }[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Live Feed", icon: MessageCircle },
  { label: "Narratives", icon: TrendingUp },
  { label: "Network", icon: Network },
  { label: "Geo Intelligence", icon: Map },
  { label: "Analytics", icon: Globe2 },
  { label: "Alerts", icon: Bell },
  { label: "Reports", icon: FileText },
  { label: "Investigation Replay", icon: CirclePlay },
  { label: "Live Web Data", icon: Radio },
];

/* ---------- shared shell pieces ---------- */

function Blobs() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <span className="blob left-[-8rem] top-[-6rem] h-[26rem] w-[30rem] bg-blush/70 opacity-70" style={{ animation: "float-slow 18s ease-in-out infinite" }} />
      <span className="blob right-[-10rem] top-[4rem] h-[24rem] w-[26rem] bg-sky/70 opacity-60" style={{ animation: "float-slow 22s ease-in-out infinite reverse" }} />
      <span className="blob bottom-[-8rem] left-[18%] h-[22rem] w-[34rem] bg-peach/60 opacity-60" style={{ animation: "float-slow 26s ease-in-out infinite" }} />
      <span className="blob bottom-[6rem] right-[6%] h-[18rem] w-[20rem] bg-lavender/60 opacity-55" style={{ animation: "float-slow 20s ease-in-out infinite reverse" }} />
      <span className="blob left-[38%] top-[-4rem] h-[14rem] w-[22rem] bg-butter/60 opacity-50" />
    </div>
  );
}

function Note({ children, className, rotate = -6 }: { children: React.ReactNode; className?: string; rotate?: number }) {
  return (
    <span aria-hidden className={cn("hand pointer-events-none select-none text-[1.35rem] leading-tight text-primary/80", className)} style={{ transform: `rotate(${rotate}deg)` }}>
      {children}
    </span>
  );
}

function Logo() {
  return (
    <div className="flex flex-col">
      <span className="font-display text-2xl font-extrabold tracking-tight text-ink">NEXUS</span>
      <span className="text-[10px] font-medium tracking-wide text-muted-foreground">From Conversations to Clarity</span>
    </div>
  );
}

function PlatformGlyph({ platform, className }: { platform: string; className?: string }) {
  const styles: Record<string, string> = {
    X: "bg-[var(--platform-x)] text-white",
    Telegram: "bg-[var(--platform-telegram)] text-white",
    Reddit: "bg-[var(--platform-reddit)] text-white",
    Instagram: "bg-gradient-to-br from-[var(--platform-instagram)] to-[var(--platform-reddit)] text-white",
  };
  const icons: Record<string, React.ReactNode> = { X: <X />, Telegram: <Send />, Reddit: <MessageCircle />, Instagram: <Instagram /> };
  return (
    <span className={cn("pop-3d flex h-10 w-10 shrink-0 items-center justify-center rounded-full [&_svg]:h-4 [&_svg]:w-4", styles[platform] ?? styles["X"], className)}>
      {icons[platform] ?? icons["X"]}
    </span>
  );
}

const compact = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;

function SourceBar({ snapshot }: { snapshot: IntelSnapshot }) {
  const empty = snapshot.sources.filter((s) => s.status !== "loaded");
  return (
    <section className="glass-panel mb-5 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Dataset coverage</p>
          <p className="mt-1 text-sm font-bold text-ink">
            {snapshot.totals.posts} records in the current selection
            {snapshot.earliestDate && snapshot.latestDate ? ` · ${snapshot.earliestDate} → ${snapshot.latestDate}` : ""}
          </p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-secondary-foreground">
          {snapshot.totals.platforms} of 4 platforms
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {snapshot.sources.map((s: SourceStatus) => (
          <div key={s.platform} className={cn("flex items-start gap-3 rounded-3xl p-3", s.status === "loaded" ? "bg-mint/50" : "bg-blush/45")}>
            <PlatformGlyph platform={s.platform} className="h-9 w-9" />
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-ink">{s.platform}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-ink/70">{s.count} records</p>
              {s.note && <p className="mt-0.5 text-[10px] leading-snug text-ink/60">{s.note}</p>}
            </div>
          </div>
        ))}
      </div>
      {empty.length > 0 && (
        <p className="mt-3 rounded-2xl bg-peach/50 px-3 py-2 text-[11px] font-semibold text-ink/80">
          {empty.map((b) => b.platform).join(", ")} {empty.length > 1 ? "have" : "has"} no records under the current filters, so {empty.length > 1 ? "those lanes are" : "that lane is"} missing from every view.
        </p>
      )}
    </section>
  );
}

function FilterBar({ filters, setFilters }: { filters: Filters; setFilters: (f: Filters) => void }) {
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });
  const selectClass = "rounded-full border border-border bg-white/70 px-3 py-1.5 text-xs font-semibold text-ink outline-hidden";
  const dirty = JSON.stringify(filters) !== JSON.stringify(emptyFilters);
  return (
    <section className="glass-panel mb-5 flex flex-wrap items-center gap-2 p-3">
      <span className="flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"><Filter className="h-3.5 w-3.5" /> Filters</span>
      <select aria-label="Platform" className={selectClass} value={filters.platform} onChange={(e) => set({ platform: e.target.value as Platform | "All" })}>
        <option value="All">All platforms</option>
        {ALL_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <select aria-label="Sentiment label" className={selectClass} value={filters.sentiment} onChange={(e) => set({ sentiment: e.target.value })}>
        <option value="All">All sentiment labels</option>
        {filterOptions.sentiments.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <select aria-label="Topic" className={selectClass} value={filters.topic} onChange={(e) => set({ topic: e.target.value })}>
        <option value="All">All topics</option>
        {filterOptions.topics.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <select aria-label="Narrative stage" className={selectClass} value={filters.stage} onChange={(e) => set({ stage: e.target.value })}>
        <option value="All">All narrative stages</option>
        {filterOptions.stages.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <label className="flex items-center gap-1.5 rounded-full border border-border bg-white/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
        From <input type="date" className="bg-transparent text-ink outline-hidden" value={filters.from} onChange={(e) => set({ from: e.target.value })} />
      </label>
      <label className="flex items-center gap-1.5 rounded-full border border-border bg-white/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
        To <input type="date" className="bg-transparent text-ink outline-hidden" value={filters.to} onChange={(e) => set({ to: e.target.value })} />
      </label>
      {dirty && <Button size="sm" variant="secondary" className="ml-auto rounded-full" onClick={() => setFilters(emptyFilters)}><RotateCcw /> Reset</Button>}
    </section>
  );
}

function Index() {
  const [view, setView] = useState<View>("Overview");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [term, setTerm] = useState("");
  const snapshot = useIntel(filters);

  const alertCount = snapshot.alerts.length;

  return (
    <TooltipProvider>
      <Blobs />
      <div className="min-h-screen p-3 text-foreground lg:p-6">
        <header className="glass-panel sticky top-3 z-30 mx-auto flex max-w-[1620px] items-center gap-4 px-5 py-3">
          <button className="flex items-center gap-3" onClick={() => setView("Overview")} aria-label="Open overview">
            <span className="relative flex h-10 w-12 items-center">
              <span className="pop-3d absolute left-0 h-8 w-8 rounded-full bg-gradient-to-br from-blush to-primary/80" />
              <span className="pop-3d absolute right-0 h-8 w-8 rounded-full bg-gradient-to-br from-sky to-lavender mix-blend-multiply" />
            </span>
            <Logo />
          </button>
          <form
            className="ml-2 hidden min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-white/70 px-4 py-2.5 md:flex"
            onSubmit={(e) => { e.preventDefault(); setFilters({ ...filters, search: term.trim() }); }}
          >
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={term} onChange={(e) => setTerm(e.target.value)} className="w-full bg-transparent text-sm outline-hidden placeholder:text-muted-foreground" placeholder="Search accounts, summaries, topics, entities — press Enter…" />
          </form>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full border border-border bg-white/70 px-3 py-2 text-xs font-semibold text-muted-foreground lg:flex">
              <CalendarDays className="h-3.5 w-3.5" /> {snapshot.latestDate ?? "No dated records"}
            </span>
            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="relative rounded-full bg-white/70" aria-label="Notifications" onClick={() => setView("Alerts")}>
                <Bell />{alertCount > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />}
              </Button>
            </TooltipTrigger><TooltipContent>{alertCount} active alerts</TooltipContent></Tooltip>
            <div className="pop-3d flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-ink to-primary font-display text-sm font-bold text-white">A</div>
          </div>
        </header>

        <div className="mx-auto mt-5 grid max-w-[1620px] gap-5 lg:grid-cols-[248px_minmax(0,1fr)]">
          <aside className="glass-panel hidden h-[calc(100vh-118px)] overflow-y-auto p-3 lg:sticky lg:top-[98px] lg:block">
            <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Workspace</p>
            <div className="space-y-1.5">
              {views.map(({ label, icon: Icon }) => {
                const badge = label === "Alerts" && alertCount ? String(alertCount) : label === "Live Feed" ? String(snapshot.totals.posts) : undefined;
                return (
                  <button key={label} onClick={() => setView(label)}
                    className={cn("flex w-full items-center gap-3 rounded-full px-4 py-3 text-left text-sm font-semibold transition",
                      view === label ? "bg-gradient-to-r from-primary to-blush text-primary-foreground shadow-[0_10px_22px_-10px_var(--primary)]" : "text-muted-foreground hover:bg-secondary/60 hover:text-ink")}>
                    <Icon className="h-4 w-4" />
                    <span className="truncate">{label}</span>
                    {badge && <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold", view === label ? "bg-white/25" : "bg-primary text-primary-foreground")}>{badge}</span>}
                  </button>
                );
              })}
            </div>
            <div className="mt-6 rounded-3xl bg-gradient-to-br from-lavender/80 via-sky/70 to-mint/70 p-4">
              <div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-widest text-ink/70">Current selection</span><span className="h-2 w-2 rounded-full bg-primary" /></div>
              <p className="font-display text-sm font-extrabold text-ink">{snapshot.query}</p>
              <p className="mt-1 text-xs text-ink/65">{snapshot.totals.platforms} platforms · {snapshot.totals.accounts} accounts</p>
            </div>
            <Note className="mt-6 block px-3 text-left text-primary/70" rotate={-4}>People.<br />Patterns.<br />Possibilities.</Note>
          </aside>

          <main className="min-w-0">
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {views.map(({ label, icon: Icon }) => (
                <Button key={label} size="sm" variant={view === label ? "default" : "secondary"} onClick={() => setView(label)} className="shrink-0 rounded-full">
                  <Icon />{label}
                </Button>
              ))}
            </div>

            <div className="relative mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary"><Sparkles className="h-3.5 w-3.5" /> Dataset intelligence workspace</p>
                <h1 className="font-display text-3xl font-extrabold leading-tight text-ink sm:text-4xl">
                  {view === "Overview" ? <>Good morning, <span className="hand block text-[2.6rem] text-primary sm:text-[3.2rem]">Analyst!</span></> : view}
                </h1>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">{viewSubtitle(view)}</p>
              </div>
              <div className="hidden items-center gap-3 sm:flex">
                <Note rotate={-8} className="text-right">Real conversations.<br />Real impact.</Note>
                <span className="flex items-center gap-2 rounded-full bg-success-soft px-3 py-2 text-xs font-bold text-success">
                  <span className="h-2 w-2 rounded-full bg-success" /> Annotated datasets
                </span>
              </div>
            </div>

            {view !== "Live Web Data" && <SourceBar snapshot={snapshot} />}
            {view !== "Live Web Data" && <FilterBar filters={filters} setFilters={setFilters} />}

            {view === "Live Web Data" && <LiveWebView query={filters.search.trim()} />}
            {view === "Overview" && <Overview snapshot={snapshot} onOpen={setView} />}
            {view === "Live Feed" && <SocialFeed snapshot={snapshot} filters={filters} setFilters={setFilters} />}
            {view === "Narratives" && <TimelineView snapshot={snapshot} />}
            {view === "Network" && <NetworkView snapshot={snapshot} />}
            {view === "Geo Intelligence" && <GeographicView snapshot={snapshot} />}
            {view === "Analytics" && <AnalyticsView snapshot={snapshot} />}
            {view === "Alerts" && <AlertsView snapshot={snapshot} />}
            {view === "Reports" && <ReportsView snapshot={snapshot} />}
            {view === "Investigation Replay" && <ReplayView snapshot={snapshot} />}

            <footer className="mt-8 flex flex-wrap items-center justify-between gap-4 px-1 pb-2">
              <span className="font-display text-3xl font-extrabold tracking-tight text-ink/15">NEXUS</span>
              <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-muted-foreground">People · Communities · Safer Tomorrow</p>
            </footer>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

function viewSubtitle(view: View) {
  const copy: Record<View, string> = {
    Overview: "Tracking conversations. Detecting risks. Building safer communities.",
    "Live Feed": "Every annotated record with its sentiment, topic and original source link.",
    Narratives: "Narrative volume, stages and sentiment over the dated records.",
    Network: "Accounts from the datasets, connected only where the data shows a shared source, shared event or a mention.",
    "Geo Intelligence": "Locations recorded in the datasets, mapped where a place is identifiable.",
    Analytics: "Platform mix, sentiment labels, emotions and narrative stages.",
    Alerts: "Warnings derived from flagged key events, volume peaks and bridge accounts.",
    Reports: "Export findings, timelines and network analysis.",
    "Investigation Replay": "Step through the movement using the dataset's key events.",
    "Live Web Data": "Current public web results fetched live from Reddit search, Google News and public Telegram channels.",
  };
  return copy[view];
}

function Panel({ title, eyebrow, action, children, className }: { title: string; eyebrow?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("glass-panel min-w-0 p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-extrabold text-ink">{title}</h2>
          {eyebrow && <p className="mt-0.5 text-xs font-medium text-primary/80">{eyebrow}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

function Stat({ icon: Icon, label, value, delta, tone }: { icon: typeof Activity; label: string; value: string; delta: string; tone: "blush" | "sky" | "mint" | "lavender" }) {
  const bg = { blush: "from-blush/85 to-peach/70", sky: "from-sky/85 to-lavender/60", mint: "from-mint/85 to-sky/55", lavender: "from-lavender/85 to-blush/55" }[tone];
  return (
    <div className={cn("rounded-3xl bg-gradient-to-br p-4 shadow-[0_16px_34px_-20px_oklch(0.45_0.1_20/45%)]", bg)}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="pop-3d flex h-9 w-9 items-center justify-center rounded-2xl bg-white/85 text-ink"><Icon className="h-4 w-4" /></span>
          <span className="text-xs font-bold text-ink/80">{label}</span>
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between">
        <strong className="font-display text-3xl font-extrabold text-ink">{value}</strong>
        <span className="text-xs font-bold text-ink/70">{delta}</span>
      </div>
    </div>
  );
}

function Overview({ snapshot, onOpen }: { snapshot: IntelSnapshot; onOpen: (view: View) => void }) {
  const { totals } = snapshot;
  const keyEvents = snapshot.posts.filter((p) => p.keyEvent).length;
  const peak = snapshot.timeline.reduce<IntelSnapshot["timeline"][number] | null>((a, b) => (!a || b.total > a.total ? b : a), null);
  return (
    <div className="grid gap-5 xl:grid-cols-12">
      <div className="grid gap-4 sm:grid-cols-2 xl:col-span-8 xl:grid-cols-4">
        <Stat icon={ShieldAlert} label="Negative share" value={`${totals.negativeShare.toFixed(1)}%`} delta={`${totals.withSentiment} labelled`} tone="blush" />
        <Stat icon={FileText} label="Records" value={compact(totals.posts)} delta={`${keyEvents} key events`} tone="sky" />
        <Stat icon={Users} label="Accounts & Channels" value={String(totals.accounts)} delta="unique" tone="mint" />
        <Stat icon={Share2} label="Platforms" value={String(totals.platforms)} delta={`${totals.regions} mapped regions`} tone="lavender" />
      </div>

      <Panel title="Sentiment posture" eyebrow="From the dataset sentiment labels" className="xl:col-span-4">
        <div className="flex items-center gap-5">
          <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full shadow-[0_14px_26px_-14px_var(--primary)]"
            style={{ background: `conic-gradient(var(--primary) 0 ${totals.negativeShare}%, var(--risk-soft) ${totals.negativeShare}%)` }}>
            <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-white">
              <strong className="font-display text-xl text-ink">{totals.negativeShare.toFixed(0)}%</strong>
              <span className="text-[9px] font-bold text-primary">NEGATIVE</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-ink">{totals.negativeShare > 45 ? "Predominantly negative" : "Mixed conversation"}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Share of the {totals.withSentiment} sentiment-labelled records marked negative, angry, critical or concerned.</p>
          </div>
        </div>
      </Panel>

      <Panel title="Most engaged record" eyebrow="Ranked by the engagement fields in the data" className="xl:col-span-7"
        action={<Button size="sm" className="rounded-full" onClick={() => onOpen("Investigation Replay")}><Play /> Investigate</Button>}>
        {snapshot.posts.length === 0 ? <Empty>No records match the current filters.</Empty> : (
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex h-28 w-full items-end overflow-hidden rounded-3xl bg-gradient-to-br from-sky via-lavender to-blush p-3 sm:w-44">
              <div className="flex w-full items-end gap-1">
                {snapshot.timeline.map((t) => (
                  <span key={t.time} className="flex-1 rounded-t-md bg-white/75" style={{ height: `${Math.max(8, (t.total / Math.max(1, peak?.total ?? 1)) * 100)}%` }} />
                ))}
              </div>
            </div>
            <div className="flex-1">
              {(() => {
                const top = [...snapshot.posts].sort((a, b) => (b.engagement ?? -1) - (a.engagement ?? -1))[0]!;
                return (
                  <>
                    <h3 className="font-display text-xl font-extrabold text-ink">{top.handle}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{top.text}</p>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <MiniMetric label="Records" value={compact(totals.posts)} />
                      <MiniMetric label="Peak day" value={peak?.time ?? "—"} />
                      <MiniMetric label="Engagement" value={compact(totals.engagement)} />
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Narrative timeline" eyebrow="Records per date in the datasets" className="xl:col-span-5"
        action={<Button variant="ghost" size="sm" className="rounded-full" onClick={() => onOpen("Narratives")}>Open</Button>}>
        {snapshot.timeline.length === 0 ? <Empty>No dated records in this selection.</Empty> : <TimelineChart data={snapshot.timeline} compact />}
        <Note className="mt-2 block text-center" rotate={-3}>Watch narratives unfold.</Note>
      </Panel>

      <Panel title="Dataset feed" eyebrow="Different platforms. A safer world." className="xl:col-span-5"
        action={<Button variant="ghost" size="sm" className="rounded-full" onClick={() => onOpen("Live Feed")}>View all <ChevronRight /></Button>}>
        <div className="space-y-3">{snapshot.posts.slice(0, 3).map((post) => <FeedRow key={post.id} post={post} compact />)}</div>
        {snapshot.posts.length === 0 && <Empty>No records match the current filters.</Empty>}
      </Panel>

      <Panel title="Platform distribution" eyebrow="Share of records by platform" className="xl:col-span-4"><PlatformDonut snapshot={snapshot} /></Panel>

      <Panel title="Sentiment mix" eyebrow="From dataset sentiment labels" className="xl:col-span-3"><SentimentDonut snapshot={snapshot} /></Panel>

      <Panel title="Alerts & reports" eyebrow="Derived from flagged events and volume" className="xl:col-span-5"
        action={<Button variant="ghost" size="sm" className="rounded-full" onClick={() => onOpen("Alerts")}>View all <ArrowRight /></Button>}>
        <div className="space-y-2">{snapshot.alerts.slice(0, 4).map((a, i) => <AlertRow key={`${a.title}-${i}`} alert={a} />)}</div>
        {snapshot.alerts.length === 0 && <Empty>No alert conditions in this selection.</Empty>}
      </Panel>

      <Panel title="Geographic intelligence" eyebrow="Locations recorded in the datasets" className="xl:col-span-7"
        action={<Button variant="ghost" size="sm" className="rounded-full" onClick={() => onOpen("Geo Intelligence")}>Open map <ChevronRight /></Button>}>
        <div className="flex items-center gap-4">
          <IndiaMap className="h-[300px] flex-1" regions={snapshot.states} cities={snapshot.cities} />
          <Note rotate={-7}>Local insights.<br />National safety.</Note>
        </div>
        {snapshot.states.length === 0 && <Empty>No mappable locations in this selection.</Empty>}
      </Panel>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-muted/80 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><strong className="font-display text-sm text-ink">{value}</strong></div>;
}

function FeedRow({ post, compact: dense = false }: { post: LivePost; compact?: boolean }) {
  const engagementLabel = post.engagement === null
    ? "Engagement not in dataset"
    : Object.entries(post.engagementDetail).map(([k, v]) => `${k} ${compact(v)}`).join(" · ");
  return (
    <article className={cn("rounded-3xl border border-white/70 bg-white/70 p-4 transition hover:-translate-y-0.5 hover:shadow-[0_18px_30px_-20px_oklch(0.45_0.1_20/50%)]", dense && "p-3")}>
      <div className="flex items-start gap-3">
        <PlatformGlyph platform={post.platform} />
        <div className="min-w-0 flex-1">
          <div className="flex justify-between gap-2">
            <p className="truncate text-sm font-bold text-ink">{post.handle}</p>
            <span className="shrink-0 text-xs text-muted-foreground">{post.time}</span>
          </div>
          <p className={cn("mt-1.5 text-sm leading-relaxed text-foreground/85", dense && "line-clamp-2")}>{post.text}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {post.keyEvent && <span className="rounded-full bg-risk-soft px-2.5 py-1 text-[10px] font-bold text-risk">Key event</span>}
            {post.bridgeCandidate && <span className="rounded-full bg-peach px-2.5 py-1 text-[10px] font-bold text-ink">Bridge candidate</span>}
            {post.sentimentRaw && <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold text-secondary-foreground">{post.sentimentRaw}</span>}
            {post.topic && <span className="rounded-full bg-sky/60 px-2.5 py-1 text-[10px] font-bold text-ink">{post.topic}</span>}
            {post.narrativeStage && <span className="rounded-full bg-lavender/60 px-2.5 py-1 text-[10px] font-bold text-ink">{post.narrativeStage}</span>}
            {post.url ? (
              <a href={post.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-primary hover:underline">
                Source <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">No source URL in dataset</span>
            )}
            <span className="ml-auto text-xs font-semibold text-muted-foreground">{engagementLabel}</span>
          </div>
          {!dense && (post.location || post.mediaType || post.actorType || post.emotion) && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {[post.location && `Location: ${post.location}`, post.actorType && `Actor: ${post.actorType}`, post.emotion && `Emotion: ${post.emotion}`, post.mediaType && `Media: ${post.mediaType}`].filter(Boolean).join(" · ")}
            </p>
          )}
          {!dense && post.dataNote && <p className="mt-1 text-[10px] italic text-muted-foreground">{post.dataNote}</p>}
        </div>
      </div>
    </article>
  );
}

function SocialFeed({ snapshot, filters, setFilters }: { snapshot: IntelSnapshot; filters: Filters; setFilters: (f: Filters) => void }) {
  const list = snapshot.posts;
  return (
    <Panel title="Dataset Feed" eyebrow={`${list.length} matching records`} action={<span className="flex items-center gap-2 rounded-full bg-success-soft px-3 py-1.5 text-xs font-bold text-success"><span className="h-2 w-2 rounded-full bg-success" /> Annotated</span>}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["All", ...ALL_PLATFORMS] as const).map((p) => (
          <button key={p} onClick={() => setFilters({ ...filters, platform: p as Platform | "All" })}
            className={cn("rounded-full px-4 py-2 text-xs font-bold transition",
              filters.platform === p ? "bg-gradient-to-r from-primary to-blush text-primary-foreground shadow-[0_10px_20px_-12px_var(--primary)]" : "bg-white/70 text-muted-foreground hover:text-ink")}>{p}</button>
        ))}
        <span className="ml-auto flex items-center gap-2 rounded-full border border-border bg-white/70 px-3 py-1.5">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Filter these records" className="w-40 bg-transparent text-xs outline-hidden" />
        </span>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">{list.map((post) => <FeedRow key={post.id} post={post} />)}</div>
      {list.length === 0 && <Empty>No records match these filters. Try another platform, topic or date range.</Empty>}
    </Panel>
  );
}

function NetworkView({ snapshot }: { snapshot: IntelSnapshot }) {
  const { nodes, edges, communities, bridges, connections } = snapshot.network;
  const [selected, setSelected] = useState<string | null>(null);
  const active = nodes.find((n) => n.id === selected) ?? nodes[0] ?? null;
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const edgeKinds = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of edges) map.set(e.kind, (map.get(e.kind) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [edges]);

  // Links that actually touch the selected account, straight from the evidence graph.
  const activeLinks = useMemo(() => {
    if (!active) return [];
    return edges
      .filter((e) => e.from === active.id || e.to === active.id)
      .map((e) => ({ other: byId.get(e.from === active.id ? e.to : e.from) ?? null, kind: e.kind, weight: e.weight }))
      .filter((l) => l.other !== null)
      .sort((a, b) => b.weight - a.weight);
  }, [active, edges, byId]);

  const activePosts = useMemo(
    () => (active ? snapshot.posts.filter((p) => `${p.platform}:${p.handle}` === active.id || `${p.platform}:${p.author}` === active.id) : []),
    [active, snapshot.posts],
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
      <Panel title="Narrative Network" eyebrow="Accounts from the datasets; links only where the data records a shared source, shared event or mention">
        <div className="relative h-[560px] overflow-hidden rounded-3xl bg-gradient-to-br from-white via-sky/30 to-lavender/40">
          <svg className="pointer-events-none absolute inset-0 h-full w-full">
            {edges.map((e, i) => {
              const a = byId.get(e.from); const b = byId.get(e.to);
              if (!a || !b) return null;
              const touches = active && (e.from === active.id || e.to === active.id);
              return <line key={i} x1={`${a.x}%`} y1={`${a.y}%`} x2={`${b.x}%`} y2={`${b.y}%`} stroke={touches ? "var(--primary)" : "var(--primary)"} strokeWidth={touches ? 2.4 : Math.min(2.2, 0.7 + e.weight * 0.25)} opacity={touches ? 0.7 : Math.min(0.28, 0.08 + e.weight * 0.04)} />;
            })}
          </svg>
          {nodes.map((n) => {
            const size = 14 + Math.round(n.influence * 18);
            const linked = active ? edges.some((e) => (e.from === active.id && e.to === n.id) || (e.to === active.id && e.from === n.id)) : false;
            return (
              <Tooltip key={n.id}><TooltipTrigger asChild>
                <button aria-label={n.label} onClick={() => setSelected(n.id)}
                  className={cn("pop-3d absolute z-10 flex items-center justify-center rounded-full border-4 border-white transition hover:scale-110",
                    active?.id === n.id && "ring-4 ring-primary/40", linked && "ring-2 ring-primary/25")}
                  style={{ left: `calc(${n.x}% - ${size}px)`, top: `calc(${n.y}% - ${size}px)`, width: size * 2, height: size * 2 }}>
                  <PlatformGlyph platform={n.platform} className="h-full w-full border-0 shadow-none" />
                </button>
              </TooltipTrigger><TooltipContent><strong>{n.label}</strong><br />{n.platform} · {n.posts} records · engagement {compact(n.engagement)}</TooltipContent></Tooltip>
            );
          })}
          {active && (
            <div className="absolute bottom-4 left-4 max-w-[280px] rounded-2xl bg-white/90 p-3 text-xs shadow-lg">
              <p className="font-display font-extrabold text-ink">{active.label}</p>
              <p className="mt-1 text-muted-foreground">{active.platform} · {active.handle} · {active.posts} records</p>
              <p className="mt-1 text-muted-foreground">{activeLinks.length} evidence link{activeLinks.length === 1 ? "" : "s"} in this selection</p>
              {active.url
                ? <a href={active.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline">Open source <ExternalLink className="h-3 w-3" /></a>
                : <p className="mt-2 text-[10px] font-semibold text-muted-foreground">No source URL in dataset</p>}
            </div>
          )}
          <div className="absolute right-4 top-4 space-y-1.5 rounded-2xl bg-white/85 p-3 text-[11px] font-semibold">
            {ALL_PLATFORMS.map((p) => (
              <p key={p} className="flex items-center gap-2 text-muted-foreground"><i className={cn("h-2.5 w-2.5 rounded-full", `bg-[var(--platform-${p.toLowerCase()})]`)} />{p}</p>
            ))}
          </div>
          {nodes.length === 0 && <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">No accounts match the current filters.</p>}
        </div>
        <Note className="mt-3 block" rotate={-4}>Connected conversations. Bigger pictures.</Note>
      </Panel>
      <Panel title="Key structure" eyebrow="Computed from dataset evidence">
        <div className="space-y-3">
          <MiniMetric label="Connected groups" value={`${communities} detected`} />
          <MiniMetric label="Cross-platform bridges" value={`${bridges} accounts`} />
          <MiniMetric label="Accounts" value={String(nodes.length)} />
          <MiniMetric label="Evidence links" value={connections.toLocaleString()} />
        </div>
        <div className="mt-4 space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Link evidence</p>
          {edgeKinds.length === 0 ? <p className="text-xs text-muted-foreground">No relationship evidence in this selection.</p> :
            edgeKinds.map(([kind, n]) => <p key={kind} className="flex justify-between text-xs font-semibold"><span className="text-muted-foreground">{kind}</span><strong className="text-ink">{n}</strong></p>)}
        </div>
        {active && (
          <div className="mt-5 space-y-3">
            <div className="rounded-3xl bg-gradient-to-br from-blush/70 to-peach/60 p-4">
              <p className="text-xs font-bold text-ink">Selected account</p>
              <p className="mt-1 font-display text-sm font-extrabold text-ink">{active.label}</p>
              <p className="mt-1 text-xs text-ink/70">{active.handle} · {active.platform}</p>
              <p className="mt-1 text-xs text-ink/70">{active.posts} records · engagement {active.engagement === null ? "not in dataset" : compact(active.engagement)}</p>
            </div>
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Connected accounts</p>
              {activeLinks.length === 0 ? (
                <p className="text-xs text-muted-foreground">The datasets record no relationship for this account.</p>
              ) : (
                <div className="space-y-1.5">
                  {activeLinks.map((l, i) => (
                    <button key={`${l.other!.id}-${l.kind}-${i}`} onClick={() => setSelected(l.other!.id)} className="flex w-full items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 text-left text-xs hover:bg-white">
                      <span className="min-w-0 flex-1 truncate font-semibold text-ink">{l.other!.label}</span>
                      <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">{l.kind} ×{l.weight}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Records from this account</p>
              {activePosts.length === 0 ? <p className="text-xs text-muted-foreground">No records in this selection.</p> : (
                <div className="space-y-1.5">
                  {activePosts.slice(0, 5).map((p) => (
                    <div key={p.id} className="rounded-2xl bg-muted/70 p-2.5">
                      <p className="text-[10px] font-bold text-primary">{p.time}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{p.text}</p>
                      {p.url
                        ? <a href={p.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline">Source <ExternalLink className="h-3 w-3" /></a>
                        : <p className="mt-1 text-[10px] font-semibold text-muted-foreground">No source URL in dataset</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function TimelineChart({ data, compact: dense = false }: { data: IntelSnapshot["timeline"]; compact?: boolean }) {
  return (
    <div className={dense ? "h-48" : "h-[420px]"}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="total" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--primary)" stopOpacity={0.5} /><stop offset="1" stopColor="var(--primary)" stopOpacity={0.03} /></linearGradient>
            <linearGradient id="sus" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--platform-telegram)" stopOpacity={0.45} /><stop offset="1" stopColor="var(--platform-telegram)" stopOpacity={0.02} /></linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
          <YAxis hide={dense} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
          <ChartTooltip contentStyle={{ borderRadius: 16, border: "1px solid var(--border)", background: "white", boxShadow: "0 14px 28px -18px rgba(0,0,0,.35)" }} />
          <Area type="monotone" dataKey="total" name="Records" stroke="var(--primary)" strokeWidth={3} fill="url(#total)" dot={{ r: 3, fill: "var(--primary)", strokeWidth: 0 }} />
          <Area type="monotone" dataKey="concerned" name="Negative sentiment" stroke="var(--platform-telegram)" strokeWidth={2} fill="url(#sus)" dot={{ r: 2.5, fill: "var(--platform-telegram)", strokeWidth: 0 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function TimelineView({ snapshot }: { snapshot: IntelSnapshot }) {
  const peak = snapshot.timeline.reduce<IntelSnapshot["timeline"][number] | null>((a, b) => (!a || b.total > a.total ? b : a), null);
  const keyMoments = snapshot.posts.filter((p) => p.keyEvent);
  const shown = keyMoments.length ? keyMoments : snapshot.posts.slice(0, 6);
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
      <Panel title="Narrative Timeline" eyebrow="Records per date across all four datasets"
        action={peak ? <span className="rounded-full bg-blush/70 px-3 py-1.5 text-xs font-bold text-ink">Peak: {peak.total} records / {peak.time}</span> : undefined}>
        {snapshot.timeline.length === 0 ? <Empty>No dated records in this selection.</Empty> : <TimelineChart data={snapshot.timeline} />}
        <div className="mt-4 flex gap-5 text-xs font-semibold">
          <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-primary" />Total records</span>
          <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[var(--platform-telegram)]" />Negative-sentiment records</span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {snapshot.stages.slice(0, 3).map((s) => (
            <div key={s.name} className="rounded-3xl bg-gradient-to-br from-white to-sky/40 p-3">
              <p className="font-display text-sm font-extrabold text-ink">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.count} records at this narrative stage</p>
            </div>
          ))}
          {snapshot.stages.length === 0 && <Empty>No narrative stages recorded.</Empty>}
        </div>
      </Panel>
      <Panel title="Key moments" eyebrow={keyMoments.length ? "Records flagged as key events" : "Most recent records"}>
        <div className="space-y-5">
          {shown.map((post) => (
            <div key={post.id} className="relative border-l-2 border-primary/25 pl-4">
              <span className="absolute -left-1.5 top-0 h-2.5 w-2.5 rounded-full bg-primary" />
              <p className="text-[10px] font-bold text-primary">{post.time} · {post.platform}</p>
              <p className="text-sm font-bold text-ink">{post.handle}</p>
              <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{post.text}</p>
              {post.url
                ? <a href={post.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline">Source <ExternalLink className="h-3 w-3" /></a>
                : <p className="mt-1 text-[10px] font-semibold text-muted-foreground">No source URL in dataset</p>}
            </div>
          ))}
          {shown.length === 0 && <Empty>No records in this selection.</Empty>}
        </div>
        <Note className="mt-6 block" rotate={-5}>Watch narratives unfold.</Note>
      </Panel>
    </div>
  );
}

function SentimentDonut({ snapshot }: { snapshot: IntelSnapshot }) {
  const data = snapshot.sentimentMix;
  if (data.length === 0) return <Empty>No sentiment labels in this selection.</Empty>;
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-44 flex-1 raised-chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="name" innerRadius={50} outerRadius={74} paddingAngle={3} cornerRadius={8} stroke="white" strokeWidth={2}>
              {data.map((e) => <Cell key={e.name} fill={e.color} />)}
            </Pie>
            <ChartTooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <strong className="font-display text-xl text-ink">{compact(snapshot.totals.withSentiment)}</strong>
          <span className="text-[10px] text-muted-foreground">labelled</span>
        </div>
      </div>
      <div className="space-y-2">
        {data.map((e) => (
          <div key={e.name} className="flex min-w-28 items-center gap-2 text-xs font-semibold">
            <i className="h-2.5 w-2.5 rounded-full" style={{ background: e.color }} /><span className="flex-1 text-muted-foreground">{e.name}</span><strong className="text-ink">{e.value}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlatformDonut({ snapshot }: { snapshot: IntelSnapshot }) {
  const data = snapshot.platformData;
  if (data.length === 0) return <Empty>No records in this selection.</Empty>;
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-44 flex-1 raised-chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="name" innerRadius={46} outerRadius={72} paddingAngle={2} cornerRadius={8} stroke="white" strokeWidth={2}>
              {data.map((p) => <Cell key={p.name} fill={p.fill} />)}
            </Pie>
            <ChartTooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <strong className="font-display text-lg text-ink">{compact(snapshot.totals.posts)}</strong>
          <span className="text-[10px] text-muted-foreground">records</span>
        </div>
      </div>
      <div className="space-y-2">
        {data.map((p) => (
          <div key={p.name} className="flex min-w-28 items-center gap-2 text-xs font-semibold">
            <i className="h-2.5 w-2.5 rounded-full" style={{ background: p.fill }} /><span className="flex-1 text-muted-foreground">{p.name}</span><strong className="text-ink">{p.value}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function RegionalList({ regions, selected, onSelect }: { regions: IntelSnapshot["states"]; selected: string | null; onSelect: (s: string | null) => void }) {
  const top = regions.slice(0, 8);
  const max = top[0]?.posts ?? 1;
  if (top.length === 0) return <Empty>No mappable locations in this selection.</Empty>;
  return (
    <div className="flex-1 space-y-2.5">
      {top.map((s) => {
        const active = selected === s.state;
        return (
          <button key={s.state} onClick={() => onSelect(active ? null : s.state)} className={cn("w-full rounded-2xl px-2.5 py-2 text-left transition", active ? "bg-white shadow-[0_14px_26px_-20px_oklch(0.45_0.1_20/60%)]" : "hover:bg-white/60")}>
            <div className="mb-1 flex justify-between text-xs font-semibold">
              <span className="text-ink">{s.state}</span>
              <span className="text-muted-foreground">{s.posts.toLocaleString()}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-sky via-lavender to-primary" style={{ width: `${(s.posts / max) * 100}%` }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function GeographicView({ snapshot }: { snapshot: IntelSnapshot }) {
  const [selected, setSelected] = useState<string | null>(null);
  const detail = useMemo(() => snapshot.states.find((s) => s.state === selected) ?? null, [selected, snapshot.states]);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
      <Panel title="Geographic Intelligence" eyebrow="Locations recorded in the datasets"
        action={<span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-bold text-ink">{selected ?? "India"}</span>}>
        <IndiaMap className="h-[560px]" selected={selected} onSelect={setSelected} regions={snapshot.states} cities={snapshot.cities} />
        <Note className="mt-3 block" rotate={-5}>Local insights. National safety.</Note>
      </Panel>
      <Panel title="Regional signals" eyebrow={selected ? "Selected region" : "Locations by record count"}>
        <RegionalList regions={snapshot.states} selected={selected} onSelect={setSelected} />
        <div className="mt-5 rounded-3xl bg-gradient-to-br from-mint/70 to-sky/60 p-4 text-sm">
          <strong className="text-ink">{detail ? detail.state : snapshot.states[0]?.state ?? "No mapped locations"}</strong>
          <p className="mt-1 text-xs text-ink/70">
            {detail
              ? `${detail.posts.toLocaleString()} records with this location · sentiment mix: ${detail.sentiment}.`
              : snapshot.states[0]
                ? `${snapshot.states[0].state} carries the largest share of located records. Tap a state to drill in.`
                : "No record in this selection carries a mappable location."}
          </p>
        </div>
        {snapshot.unmappedLocations.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Non-mappable scopes</p>
            {snapshot.unmappedLocations.map((u) => (
              <p key={u.name} className="flex justify-between text-xs font-semibold"><span className="text-muted-foreground">{u.name}</span><strong className="text-ink">{u.count}</strong></p>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function AnalyticsView({ snapshot }: { snapshot: IntelSnapshot }) {
  const edgeKinds = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of snapshot.network.edges) map.set(e.kind, (map.get(e.kind) ?? 0) + e.weight);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [snapshot.network.edges]);

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Platform Distribution" eyebrow={`${snapshot.totals.posts} records`}><PlatformDonut snapshot={snapshot} />
        <div className="mt-4 flex items-center gap-3 rounded-3xl bg-gradient-to-r from-mint/70 to-sky/50 p-3 text-xs font-semibold text-ink">
          <span className="pop-3d flex h-8 w-8 items-center justify-center rounded-full bg-white text-success"><TrendingUp className="h-4 w-4" /></span>
          Present on {snapshot.totals.platforms} of 4 dataset lanes.
        </div>
      </Panel>
      <Panel title="Sentiment labels" eyebrow="As annotated in the datasets"><SentimentDonut snapshot={snapshot} />
        <div className="mt-4 rounded-3xl bg-gradient-to-r from-blush/70 to-lavender/60 p-4 text-sm text-ink">
          Negative-labelled records make up <strong className="text-primary">{snapshot.totals.negativeShare.toFixed(1)}%</strong> of the {snapshot.totals.withSentiment} labelled records.
        </div>
      </Panel>
      <Panel title="Records per date" eyebrow="Volume and negative-sentiment volume">
        {snapshot.timeline.length === 0 ? <Empty>No dated records.</Empty> : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={snapshot.timeline}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <ChartTooltip contentStyle={{ borderRadius: 16, border: "1px solid var(--border)", background: "white" }} />
                <Bar dataKey="total" name="Records" fill="var(--primary)" radius={[8,8,0,0]} />
                <Bar dataKey="concerned" name="Negative" fill="var(--platform-telegram)" radius={[8,8,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>
      <Panel title="Emotion labels" eyebrow="Only the X and Reddit datasets carry an emotion field">
        {snapshot.emotions.length === 0 ? <Empty>No emotion labels in this selection.</Empty> : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={snapshot.emotions} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <ChartTooltip contentStyle={{ borderRadius: 16, border: "1px solid var(--border)", background: "white" }} />
                <Bar dataKey="count" name="Records" fill="var(--chart-anxiety)" radius={[0,8,8,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>
      <Panel title="Top accounts" eyebrow="Ranked on the engagement recorded in the datasets">
        <div className="space-y-2">
          {snapshot.influencers.map((a) => (
            <div key={a.key} className="flex items-center gap-3 rounded-3xl bg-white/70 p-3">
              <PlatformGlyph platform={a.platform} className="h-9 w-9" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-ink">{a.label}</p>
                <p className="text-[11px] text-muted-foreground">{a.handle} · {a.posts} records</p>
              </div>
              <span className="text-xs font-bold text-ink">{a.engagement === null ? "No metrics" : compact(a.engagement)}</span>
              {a.url && <a href={a.url} target="_blank" rel="noopener noreferrer" aria-label={`Open source for ${a.label}`} className="text-primary"><ExternalLink className="h-3.5 w-3.5" /></a>}
            </div>
          ))}
          {snapshot.influencers.length === 0 && <Empty>No accounts in this selection.</Empty>}
        </div>
      </Panel>
      <Panel title="Topics & narrative stages" eyebrow="Counted from the topic and stage fields">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Topics</p>
            {snapshot.topics.slice(0, 8).map((t) => (
              <p key={t.name} className="flex justify-between gap-2 text-xs font-semibold"><span className="truncate text-muted-foreground">{t.name}</span><strong className="text-ink">{t.count}</strong></p>
            ))}
            {snapshot.topics.length === 0 && <Empty>No topics.</Empty>}
          </div>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Narrative stages</p>
            {snapshot.stages.slice(0, 8).map((t) => (
              <p key={t.name} className="flex justify-between gap-2 text-xs font-semibold"><span className="truncate text-muted-foreground">{t.name}</span><strong className="text-ink">{t.count}</strong></p>
            ))}
            {snapshot.stages.length === 0 && <Empty>No stages.</Empty>}
          </div>
        </div>
      </Panel>
      <Panel title="Relationship evidence" eyebrow="How accounts in this selection are actually linked" className="xl:col-span-2">
        <div className="grid gap-3 sm:grid-cols-3">
          {edgeKinds.map(([kind, n]) => (
            <div key={kind} className="rounded-3xl bg-gradient-to-br from-white to-sky/40 p-4">
              <p className="font-display text-sm font-extrabold text-ink">{kind}</p>
              <p className="mt-1 text-xs text-muted-foreground">{n} links between accounts</p>
            </div>
          ))}
          {edgeKinds.length === 0 && <Empty>No relationship evidence in this selection.</Empty>}
        </div>
        <Note className="mt-4 block text-right" rotate={-4}>Multiple platforms. A bigger picture.</Note>
      </Panel>
    </div>
  );
}

function AlertRow({ alert }: { alert: IntelSnapshot["alerts"][number] }) {
  return (
    <div className="flex items-start gap-3 rounded-3xl bg-white/70 p-3">
      <span className={cn("pop-3d mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl",
        alert.level === "High" ? "bg-blush text-risk" : alert.level === "Medium" ? "bg-peach text-ink" : "bg-mint text-success")}>
        <AlertTriangle className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs font-bold text-ink">{alert.title}</p>
          <span className="shrink-0 text-[10px] text-muted-foreground">{alert.time}</span>
        </div>
        <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{alert.detail}</p>
      </div>
      <span className={cn("shrink-0 self-center rounded-full px-2.5 py-1 text-[10px] font-bold",
        alert.level === "High" ? "bg-risk-soft text-risk" : alert.level === "Medium" ? "bg-peach text-ink" : "bg-success-soft text-success")}>{alert.level}</span>
    </div>
  );
}

function AlertsView({ snapshot }: { snapshot: IntelSnapshot }) {
  const alerts = snapshot.alerts;
  const [selected, setSelected] = useState(0);
  const activeAlert = alerts[selected] ?? alerts[0];
  if (!activeAlert) {
    return <Panel title="Alerts & Reports" eyebrow="Derived from the datasets"><Empty>No alert conditions in this selection.</Empty></Panel>;
  }
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <Panel title="Alerts & Reports" eyebrow="Flagged key events, volume peaks and bridge accounts">
        <div className="space-y-3">
          {alerts.map((a, i) => (
            <button key={`${a.title}-${i}`} onClick={() => setSelected(i)}
              className={cn("w-full rounded-3xl border p-4 text-left transition",
                selected === i ? "border-primary/50 bg-gradient-to-br from-blush/60 to-peach/40 shadow-[0_18px_32px_-22px_var(--primary)]" : "border-white/70 bg-white/70 hover:bg-white")}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-sm font-extrabold text-ink">{a.title}</span>
                <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold", a.level === "High" ? "bg-risk-soft text-risk" : a.level === "Medium" ? "bg-peach text-ink" : "bg-success-soft text-success")}>{a.level}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{a.detail}</p>
              <p className="mt-3 text-xs font-bold text-primary">Signal: {a.signal}</p>
            </button>
          ))}
        </div>
      </Panel>
      <Panel title="Why this alert fired" eyebrow="Explainable detection">
        <div className="pop-3d flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blush to-peach text-risk"><ShieldAlert /></div>
        <h3 className="mt-4 font-display text-xl font-extrabold text-ink">{activeAlert.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{activeAlert.detail} Derived from the {snapshot.totals.posts} records in the current selection.</p>
        <div className="mt-5 space-y-3">
          <MiniMetric label="Primary signal" value={activeAlert.signal} />
          <MiniMetric label="Dated" value={activeAlert.time} />
          <MiniMetric label="Severity" value={activeAlert.level} />
        </div>
        {activeAlert.url && (
          <a href={activeAlert.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
            Open source record <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <Note className="mt-6 block text-center" rotate={-4}>Be aware. Be prepared. Be safer.</Note>
      </Panel>
    </div>
  );
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 0);
}

const csv = (rows: (string | number | null)[][]) =>
  rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");

function ReportsView({ snapshot }: { snapshot: IntelSnapshot }) {
  const [open, setOpen] = useState(0);
  const reports = useMemo(() => [
    {
      title: `Narrative brief — ${snapshot.query}`,
      detail: `${snapshot.totals.posts} records across ${snapshot.totals.platforms} platforms`,
      tone: "from-blush/70 to-peach/50",
      lines: [
        ...snapshot.topics.slice(0, 6).map((t) => `Topic “${t.name}” — ${t.count} records`),
        ...snapshot.stages.slice(0, 4).map((s) => `Narrative stage “${s.name}” — ${s.count} records`),
      ],
      rows: () => [
        ["id", "platform", "account", "handle", "date", "sentiment", "topic", "narrative_stage", "engagement", "source_url", "summary"],
        ...snapshot.posts.map((p) => [p.id, p.platform, p.author, p.handle, p.time, p.sentimentRaw, p.topic, p.narrativeStage, p.engagement, p.url ?? "No source URL in dataset", p.text]),
      ],
      file: "nexus-records",
    },
    {
      title: "Network analysis export",
      detail: `${snapshot.network.nodes.length} accounts, ${snapshot.network.communities} connected groups, ${snapshot.network.connections} evidence links`,
      tone: "from-sky/70 to-lavender/50",
      lines: snapshot.network.edges.length
        ? snapshot.network.edges.slice(0, 8).map((e) => `${e.from} ↔ ${e.to} — ${e.kind} (×${e.weight})`)
        : ["No relationship evidence in the current selection."],
      rows: () => [
        ["from", "to", "evidence", "weight"],
        ...snapshot.network.edges.map((e) => [e.from, e.to, e.kind, e.weight]),
      ],
      file: "nexus-network",
    },
    {
      title: "Sentiment summary",
      detail: `${snapshot.totals.withSentiment} labelled records · ${snapshot.totals.negativeShare.toFixed(1)}% negative`,
      tone: "from-mint/70 to-sky/50",
      lines: snapshot.sentimentMix.length
        ? snapshot.sentimentMix.map((s) => `${s.name} — ${s.count} records (${s.value}%)`)
        : ["No sentiment labels in the current selection."],
      rows: () => [["sentiment", "records", "share_percent"], ...snapshot.sentimentMix.map((s) => [s.name, s.count, s.value])],
      file: "nexus-sentiment",
    },
    {
      title: "Geographic spread pack",
      detail: `${snapshot.states.length} mapped regions, ${snapshot.unmappedLocations.length} non-mappable scopes`,
      tone: "from-lavender/70 to-blush/50",
      lines: snapshot.states.length
        ? snapshot.states.slice(0, 8).map((s) => `${s.state} — ${s.posts} records · ${s.sentiment}`)
        : ["No mappable locations in the current selection."],
      rows: () => [["region", "records", "sentiment_mix"], ...snapshot.states.map((s) => [s.state, s.posts, s.sentiment])],
      file: "nexus-geography",
    },
  ], [snapshot]);

  const active = reports[Math.min(open, reports.length - 1)]!;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
      <Panel title="Reports" eyebrow="Built from the records matching your current filters">
        <div className="grid gap-3 sm:grid-cols-2">
          {reports.map((r, i) => (
            <button key={r.title} onClick={() => setOpen(i)}
              className={cn("rounded-3xl bg-gradient-to-br p-4 text-left transition hover:-translate-y-0.5", r.tone, open === i && "ring-2 ring-primary/40")}>
              <span className="pop-3d mb-3 flex h-9 w-9 items-center justify-center rounded-2xl bg-white/85 text-ink"><FileText className="h-4 w-4" /></span>
              <p className="font-display text-sm font-extrabold text-ink">{r.title}</p>
              <p className="mt-1 text-xs text-ink/70">{r.detail}</p>
            </button>
          ))}
        </div>
        <div className="mt-5 rounded-3xl bg-white/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-sm font-extrabold text-ink">{active.title}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" className="rounded-full" onClick={() => download(`${active.file}.csv`, csv(active.rows()), "text/csv")}>Download CSV</Button>
              <Button size="sm" className="rounded-full" onClick={() => download(`${active.file}.json`, JSON.stringify(active.rows(), null, 2), "application/json")}>Download JSON</Button>
            </div>
          </div>
          <ul className="mt-3 space-y-1.5">
            {active.lines.map((l, i) => <li key={i} className="text-xs text-muted-foreground">• {l}</li>)}
          </ul>
          <p className="mt-3 text-[11px] text-muted-foreground">{active.rows().length - 1} data rows in this export.</p>
        </div>
      </Panel>
      <Panel title="Dataset provenance" eyebrow="What this workspace is built on">
        <div className="space-y-2">
          {snapshot.sources.map((s) => (
            <div key={s.platform} className="rounded-2xl bg-muted/80 p-3">
              <p className="text-xs font-bold text-ink">{s.platform} · {s.count} records</p>
              {s.note && <p className="mt-0.5 text-[11px] text-muted-foreground">{s.note}</p>}
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Summaries are paraphrased in the source datasets; the Instagram, Reddit and parts of the Telegram data are labelled synthetic or demo records by their own provenance fields. Every card links back to the URL supplied by the dataset.
        </p>
        <Note className="mt-6 block text-center" rotate={-3}>From signals to safer societies.</Note>
      </Panel>
    </div>
  );
}

function ReplayView({ snapshot }: { snapshot: IntelSnapshot }) {
  const events = snapshot.replay;
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const last = Math.max(0, events.length - 1);
  const event = events[Math.min(step, last)];

  useEffect(() => {
    if (!playing || events.length === 0) return;
    const id = window.setInterval(() => {
      setStep((s) => {
        if (s >= last) { setPlaying(false); return s; }
        return s + 1;
      });
    }, 1800 / speed);
    return () => window.clearInterval(id);
  }, [playing, speed, last, events.length]);

  if (!event) {
    return <Panel title="Narrative emergence replay" eyebrow="Key events from the datasets"><Empty>No key events in this selection.</Empty></Panel>;
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Panel title="Narrative emergence replay" eyebrow={`${events.length} dataset milestones`}
        action={<span className="rounded-full bg-risk-soft px-3 py-1.5 text-xs font-bold text-risk">{event.date}</span>}>
        <div className="relative h-[500px] overflow-hidden rounded-3xl bg-gradient-to-br from-white via-sky/35 to-lavender/45">
          <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)", backgroundSize: "26px 26px" }} />
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {events.slice(1).map((e, i) => {
              const prev = events[i]!;
              return <line key={e.id} x1={prev.x} y1={prev.y} x2={e.x} y2={e.y} stroke="var(--primary)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" strokeDasharray="5 5" opacity={i + 1 <= step ? 0.6 : 0.15} />;
            })}
          </svg>
          {events.map((e, i) => (
            <div key={e.id} className={cn("absolute z-10 flex flex-col items-center transition-all duration-500", i <= step ? "scale-100 opacity-100" : "scale-75 opacity-25")} style={{ left: `${e.x}%`, top: `${e.y}%` }}>
              <span className={cn("rounded-full ring-4 transition", i === step ? "ring-primary/35" : "ring-transparent")}><PlatformGlyph platform={e.platform} className="h-12 w-12 [&_svg]:h-5 [&_svg]:w-5" /></span>
              <span className="mt-2 max-w-[160px] truncate rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-ink shadow-sm">{e.date} · {e.label}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-3">
            <Button size="icon" variant="secondary" className="rounded-full" aria-label="Restart replay" onClick={() => { setStep(0); setPlaying(false); }}><RotateCcw /></Button>
            <Button size="icon" variant="secondary" className="rounded-full" aria-label="Previous event" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}><SkipBack /></Button>
            <Button size="icon" className="rounded-full" onClick={() => { if (step >= last) setStep(0); setPlaying(!playing); }} aria-label={playing ? "Pause replay" : "Play replay"}>{playing ? <Pause /> : <Play />}</Button>
            <Button size="icon" variant="secondary" className="rounded-full" aria-label="Next event" onClick={() => setStep((s) => Math.min(last, s + 1))} disabled={step === last}><SkipForward /></Button>
            <div className="flex-1 px-2"><Slider value={[step]} min={0} max={last} step={1} onValueChange={(v) => { setPlaying(false); setStep(v[0] ?? 0); }} /></div>
            <span className="w-24 text-right font-display text-sm font-extrabold text-ink">{event.date}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Speed</span>
            {[0.5, 1, 2].map((s) => (
              <button key={s} onClick={() => setSpeed(s)} className={cn("rounded-full px-3 py-1.5 text-xs font-bold transition", speed === s ? "bg-gradient-to-r from-primary to-blush text-primary-foreground" : "bg-white/70 text-muted-foreground hover:text-ink")}>{s}×</button>
            ))}
            <span className="ml-auto flex gap-1">
              {events.map((e, i) => (
                <button key={e.id} aria-label={`Jump to ${e.label}`} onClick={() => { setPlaying(false); setStep(i); }}
                  className={cn("h-2.5 w-2.5 rounded-full transition", i <= step ? "bg-primary" : "bg-muted")} />
              ))}
            </span>
          </div>
        </div>
      </Panel>
      <Panel title="Event detail" eyebrow={`Step ${Math.min(step, last) + 1} of ${events.length}`}>
        <div className="pop-3d flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky to-lavender text-ink"><Clock3 /></div>
        <h3 className="mt-4 font-display text-xl font-extrabold text-ink">{event.label}</h3>
        <p className="mt-1 text-xs font-bold text-primary">{event.date} · {event.handle}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{event.detail}</p>
        <div className="mt-5 space-y-3">
          <MiniMetric label="Platform" value={event.platform} />
          <MiniMetric label="Engagement so far" value={compact(event.engagementSoFar)} />
          <MiniMetric label="Accounts so far" value={String(event.accountsSoFar)} />
          <MiniMetric label="Records so far" value={event.postsSoFar.toLocaleString()} />
        </div>
        {event.url && (
          <a href={event.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
            Open source <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <Button className="mt-5 w-full rounded-full" onClick={() => setStep((s) => (s >= last ? 0 : s + 1))}>{step >= last ? "Replay from start" : "Next event"} <ArrowRight /></Button>
        <Note className="mt-6 block text-center" rotate={-4}>Walk the narrative, minute by minute.</Note>
      </Panel>
    </div>
  );
}
