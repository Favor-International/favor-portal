"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowUpRight, Newspaper } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FIELD_FEED_URL } from "@/lib/give-links";

// Live "From the Field" widget. Fetches the favorintl.org field-updates feed
// (a static, CORS-enabled JSON that rebuilds whenever new stories publish) and
// renders the latest posts, linking out to the full stories on the site.

interface FieldUpdate {
  title: string;
  excerpt: string;
  url: string;
  image: string | null;
  date: string;
  tag: string | null;
}

export function FromTheField({ limit = 4 }: { limit?: number }) {
  const [updates, setUpdates] = useState<FieldUpdate[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(FIELD_FEED_URL, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { updates?: FieldUpdate[] } | null) => {
        if (!cancelled) setUpdates(data?.updates?.slice(0, limit) ?? []);
      })
      .catch(() => {
        if (!cancelled) setUpdates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [limit]);

  // Hide entirely if the feed is unavailable — never show a broken shell.
  if (updates !== null && updates.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Newspaper className="h-4 w-4 text-[#2b4d24]" aria-hidden="true" /> From the field
        </CardTitle>
        <a
          href="https://favorintl.org/stories/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-[#2b4d24] hover:underline"
        >
          All stories
        </a>
      </CardHeader>
      <CardContent>
        {updates === null ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="h-16 w-16 shrink-0 animate-pulse rounded-lg bg-[#eef0ea]" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-[#eef0ea]" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-[#eef0ea]" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-[#f0ece3]">
            {updates.map((u) => (
              <li key={u.url}>
                <a
                  href={u.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex gap-3 py-3 first:pt-0 last:pb-0"
                >
                  {u.image ? (
                    <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg">
                      <Image
                        src={u.image}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover transition group-hover:scale-105"
                        unoptimized
                      />
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1">
                    {u.tag ? (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-[#e1a730]">{u.tag}</span>
                    ) : null}
                    <span className="flex items-start gap-1">
                      <span className="line-clamp-1 text-sm font-semibold text-[#1a1a1a] group-hover:text-[#2b4d24]">
                        {u.title}
                      </span>
                      <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#a8b0a0] group-hover:text-[#2b4d24]" aria-hidden="true" />
                    </span>
                    <span className="line-clamp-2 text-xs leading-relaxed text-[#6f7766]">{u.excerpt}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
