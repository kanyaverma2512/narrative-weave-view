import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { INDIA_VIEWBOX, indiaStates, projectIndia } from "@/data/india-map";

export type StateActivity = { state: string; posts: number; sentiment: string };
export type MapCity = { name: string; lon: number; lat: number; posts: number };

/* Regional and city activity are always supplied by the dataset analytics layer. */


/** Aliases: map data uses older state names. */
const alias: Record<string, string> = {
  Orissa: "Odisha",
  Uttaranchal: "Uttarakhand",
  "Andhra Pradesh": "Telangana",
  "Jammu and Kashmir": "Jammu & Kashmir",
};

export function IndiaMap({
  selected,
  onSelect,
  className,
  regions,
  cities: cityData,
}: {
  selected?: string | null;
  onSelect?: (state: string | null) => void;
  className?: string;
  /** Regional activity derived from the datasets. */
  regions?: StateActivity[];
  /** City markers derived from the datasets. */
  cities?: MapCity[];
}) {
  const [hover, setHover] = useState<{ name: string; posts: number | undefined; sentiment: string | undefined; x: number; y: number } | null>(null);

  const activity = regions ?? [];
  const markers = cityData ?? [];
  const maxPosts = useMemo(() => Math.max(1, ...activity.map((s) => s.posts)), [activity]);
  const maxCity = useMemo(() => Math.max(1, ...markers.map((c) => c.posts)), [markers]);

  const activityFor = (name: string) => {
    const key = alias[name] ?? name;
    return activity.find((s) => s.state === key || s.state === name);
  };

  function fillFor(posts: number | undefined) {
    if (!posts) return "var(--muted)";
    const t = posts / maxPosts;
    if (t > 0.7) return "color-mix(in oklch, var(--primary) 78%, var(--background))";
    if (t > 0.45) return "color-mix(in oklch, var(--primary) 52%, var(--background))";
    if (t > 0.22) return "var(--peach)";
    if (t > 0.1) return "var(--sky)";
    return "var(--mint)";
  }

  const cities = useMemo(() => markers.map((c) => ({ ...c, p: projectIndia(c.lon, c.lat) })), [markers]);

  return (
    <div className={cn("relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky/40 via-surface to-mint/40 p-2", className)}>
      <svg viewBox={INDIA_VIEWBOX} className="h-full w-full" role="img" aria-label="Interactive map of India showing conversation activity by state">
        <defs>
          <filter id="mapLift" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="oklch(0.45 0.1 300)" floodOpacity="0.22" />
          </filter>
          <radialGradient id="cityGlow">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g filter="url(#mapLift)">
          {indiaStates.map((s) => {
            const act = activityFor(s.name);
            const isSelected = selected === s.name;
            return (
              <path
                key={s.name}
                d={s.d}
                fill={fillFor(act?.posts)}
                stroke="var(--background)"
                strokeWidth={isSelected ? 3.5 : 1.6}
                className={cn(
                  "cursor-pointer transition-[opacity,filter] duration-200",
                  selected && !isSelected ? "opacity-55" : "opacity-100",
                )}
                onMouseEnter={() => setHover({ name: alias[s.name] ?? s.name, posts: act?.posts, sentiment: act?.sentiment, x: s.c[0], y: s.c[1] })}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect?.(isSelected ? null : s.name)}
              />
            );
          })}
        </g>

        {cities.map((c) => (
          <g key={c.name} className="pointer-events-none">
            <circle cx={c.p[0]} cy={c.p[1]} r={Math.max(14, (c.posts / maxCity) * 34)} fill="url(#cityGlow)" />
            <circle cx={c.p[0]} cy={c.p[1]} r={Math.max(3.2, (c.posts / maxCity) * 7)} fill="var(--primary)" stroke="var(--background)" strokeWidth="1.6" />
            <text x={c.p[0] + 10} y={c.p[1] + 4} fontSize="13" fontWeight="700" fill="var(--ink, #2b2340)">
              {c.name}
            </text>
          </g>
        ))}

        {hover && (
          <g className="pointer-events-none">
            <rect x={hover.x - 74} y={hover.y - 46} width="148" height="40" rx="12" fill="var(--popover)" stroke="var(--primary)" strokeOpacity="0.4" opacity="0.96" />
            <text x={hover.x} y={hover.y - 30} textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--ink, #2b2340)">
              {hover.name}
            </text>
            <text x={hover.x} y={hover.y - 14} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">
              {hover.posts ? `${hover.posts.toLocaleString()} posts · ${hover.sentiment}` : "No location signals"}
            </text>
          </g>
        )}
      </svg>

      <div className="absolute bottom-3 right-3 flex items-center gap-2 rounded-2xl bg-surface/90 px-3 py-2 text-[10px] font-bold shadow-sm">
        <span className="text-muted-foreground">Low</span>
        <span className="h-2 w-24 rounded-full bg-gradient-to-r from-mint via-peach to-primary" />
        <span className="text-primary">High</span>
      </div>
    </div>
  );
}
