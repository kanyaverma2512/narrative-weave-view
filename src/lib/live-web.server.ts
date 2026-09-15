/**
 * Live web collectors — public, key-free sources only.
 *  - Reddit search   : https://www.reddit.com/search.rss (Atom)
 *  - Google News RSS : https://news.google.com/rss/search
 *  - Telegram preview: https://t.me/s/<channel> (public channel HTML)
 *
 * Every item keeps the real URL returned by the source. Nothing is invented:
 * if a source fails or returns nothing, it is reported as unavailable.
 */
export type LiveWebItem = {
  id: string;
  source: string;
  sourceKind: "Reddit" | "News" | "Telegram";
  author: string;
  title: string;
  summary: string | null;
  published: string | null;
  url: string | null;
};

export type LiveWebSourceStatus = {
  name: string;
  kind: LiveWebItem["sourceKind"];
  status: "ok" | "empty" | "error";
  count: number;
  message?: string;
};

export type LiveWebResult = {
  query: string;
  fetchedAt: string;
  items: LiveWebItem[];
  sources: LiveWebSourceStatus[];
};

const UA = "Mozilla/5.0 (compatible; NexusIntel/1.0; +https://lovable.dev)";
const TELEGRAM_CHANNELS = ["indiatoday", "ndtv", "ANI_news"];

async function text(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

const strip = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tag = (block: string, name: string) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m?.[1] ? strip(m[1]) : "";
};

const blocks = (xml: string, name: string) => xml.split(`<${name}`).slice(1).map((b) => b.split(`</${name}>`)[0] ?? "");

async function fromReddit(query: string) {
  const xml = await text(`https://www.reddit.com/search.rss?q=${encodeURIComponent(query)}&sort=new&limit=25`);
  if (xml === null) return { items: [] as LiveWebItem[], failed: true };
  const items = blocks(xml, "entry").flatMap((b, i): LiveWebItem[] => {
    const title = tag(b, "title");
    if (!title) return [];
    const author = tag(b, "name") || "reddit user";
    const sub = b.match(/r\/([A-Za-z0-9_]+)/)?.[1];
    const url = b.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? null;
    const body = strip(tag(b, "content")).slice(0, 280);
    return [{
      id: `live-reddit-${i}`,
      source: sub ? `r/${sub}` : "Reddit",
      sourceKind: "Reddit",
      author,
      title,
      summary: body || null,
      published: tag(b, "updated") || tag(b, "published") || null,
      url,
    }];
  });
  return { items, failed: false };
}

async function fromNews(query: string) {
  const xml = await text(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`);
  if (xml === null) return { items: [] as LiveWebItem[], failed: true };
  const items = blocks(xml, "item").flatMap((b, i): LiveWebItem[] => {
    const title = tag(b, "title");
    if (!title) return [];
    const source = tag(b, "source") || "News";
    const url = tag(b, "link") || null;
    return [{
      id: `live-news-${i}`,
      source,
      sourceKind: "News",
      author: source,
      title,
      summary: null,
      published: tag(b, "pubDate") || null,
      url,
    }];
  });
  return { items, failed: false };
}

async function fromTelegram(query: string) {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
  const pages = await Promise.all(TELEGRAM_CHANNELS.map(async (c) => [c, await text(`https://t.me/s/${c}`)] as const));
  if (pages.every(([, html]) => html === null)) return { items: [] as LiveWebItem[], failed: true };
  const items: LiveWebItem[] = [];
  let i = 0;
  for (const [channel, html] of pages) {
    if (!html) continue;
    const messages = html.split('class="tgme_widget_message_text').slice(1, 40);
    for (const raw of messages) {
      const body = strip(raw.split("</div>")[0] ?? "").replace(/^js-message_text[">\s]*/, "");
      if (body.length < 40) continue;
      const lower = body.toLowerCase();
      if (terms.length && !terms.some((t) => lower.includes(t))) continue;
      items.push({
        id: `live-tg-${i++}`,
        source: `@${channel}`,
        sourceKind: "Telegram",
        author: `@${channel}`,
        title: body.slice(0, 140),
        summary: body.slice(0, 400),
        published: null,
        url: `https://t.me/s/${channel}`,
      });
    }
  }
  return { items, failed: false };
}

export async function collectLiveWeb(query: string): Promise<LiveWebResult> {
  const [reddit, news, telegram] = await Promise.all([fromReddit(query), fromNews(query), fromTelegram(query)]);
  const lanes: { name: string; kind: LiveWebItem["sourceKind"]; res: { items: LiveWebItem[]; failed: boolean } }[] = [
    { name: "Reddit search", kind: "Reddit", res: reddit },
    { name: "Google News", kind: "News", res: news },
    { name: "Telegram public channels", kind: "Telegram", res: telegram },
  ];
  return {
    query,
    fetchedAt: new Date().toISOString(),
    items: lanes.flatMap((l) => l.res.items),
    sources: lanes.map((l) => ({
      name: l.name,
      kind: l.kind,
      status: l.res.failed ? "error" : l.res.items.length ? "ok" : "empty",
      count: l.res.items.length,
      message: l.res.failed ? "Source could not be reached" : l.res.items.length ? undefined : "No current results for this query",
    })),
  };
}
