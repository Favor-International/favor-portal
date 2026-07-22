"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useGiving } from "@/hooks/use-giving";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Download, History, ArrowRight, RefreshCw } from "lucide-react";
import { RecurringManager } from "@/components/giving/recurring-manager";
import { GiveCta } from "@/components/giving/give-cta";
import { PortalPageSkeleton } from "@/components/portal/portal-page-skeleton";
import { formatCurrency, formatDateShort, giftYear } from "@/lib/utils";
import { toast } from "sonner";

export default function GivingPage() {
  return (
    <Suspense fallback={<PortalPageSkeleton />}>
      <GivingPageContent />
    </Suspense>
  );
}

function GivingPageContent() {
  const { user } = useAuth();
  const { gifts, totalGiven, ytdGiven, isLoading } = useGiving(user?.id);
  const [refreshing, setRefreshing] = useState(false);

  async function refreshFromBlackbaud() {
    setRefreshing(true);
    try {
      await fetch("/api/giving/refresh", { method: "POST" });
      toast.success("Pulled your latest giving from Blackbaud");
      window.location.reload();
    } catch {
      setRefreshing(false);
      toast.error("Could not refresh right now");
    }
  }

  if (isLoading) {
    return <PortalPageSkeleton />;
  }

  const lifetime = Math.max(user?.lifetimeGivingTotal ?? 0, totalGiven);
  const mostRecent = gifts[0];

  function downloadGivingSummary() {
    const year = new Date().getFullYear();
    const yearGifts = gifts.filter((g) => giftYear(g.date) === year);
    const text = [
      `FAVOR INTERNATIONAL — ${year} GIVING SUMMARY`,
      "=".repeat(48),
      "",
      `Donor: ${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim(),
      `Email: ${user?.email ?? ""}`,
      "",
      `Total given in ${year}: ${formatCurrency(ytdGiven)}`,
      `Number of gifts in ${year}: ${yearGifts.length}`,
      `Lifetime giving: ${formatCurrency(lifetime)}`,
      "",
      "Favor International, Inc.",
      "11268 Winthrop Main Street #102, Riverview, FL 33578",
      "EIN: 47-5225697 — 501(c)(3) public charity",
      "",
      "This is a personal giving summary. Your official tax receipts are issued",
      "by Blackbaud, Favor's donation processor, at the time of each gift.",
    ].join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `favor-giving-summary-${year}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Giving summary downloaded");
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <nav className="mb-2 flex items-center gap-1 text-xs text-[#999999]">
            <Link href="/dashboard" className="hover:text-[#666666]">Home</Link>
            <span>/</span>
            <span className="font-medium text-[#1a1a1a]">Giving</span>
          </nav>
          <h1 className="font-serif text-3xl font-semibold text-[#1a1a1a]">Your giving</h1>
          <p className="mt-1 text-sm text-[#6f7766]">
            Manage your monthly partnership, give again, and download your records.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshFromBlackbaud}
          disabled={refreshing}
          className="shrink-0 self-start"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {/* Monthly-first push */}
      <GiveCta />

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Lifetime giving", value: formatCurrency(lifetime) },
          { label: "This year", value: formatCurrency(ytdGiven) },
          { label: "Gifts recorded", value: String(gifts.length) },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <p className="text-xs text-[#8b957b]">{s.label}</p>
              <p className="mt-1 text-xl font-semibold text-[#1a1a1a]">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Live recurring management */}
      <RecurringManager />

      {/* Most recent gift + records */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8b957b]">Most recent gift</p>
            {mostRecent ? (
              <div className="mt-2 flex items-center justify-between">
                <div>
                  <p className="text-2xl font-semibold text-[#1a1a1a]">{formatCurrency(mostRecent.amount)}</p>
                  <p className="text-sm text-[#6f7766]">
                    {mostRecent.designation} · {formatDateShort(mostRecent.date)}
                  </p>
                </div>
                <Badge variant={mostRecent.isRecurring ? "default" : "secondary"}>
                  {mostRecent.isRecurring ? "Recurring" : "One-time"}
                </Badge>
              </div>
            ) : (
              <p className="mt-2 text-sm text-[#6f7766]">No gifts yet. Your first gift will appear here.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-2 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8b957b]">Your records</p>
            <Button variant="outline" className="h-auto justify-start py-3" asChild>
              <Link href="/giving/history" className="flex items-center gap-3">
                <History className="h-4 w-4 text-[#2b4d24]" />
                <span className="text-left text-sm font-medium">Full giving history</span>
                <ArrowRight className="ml-auto h-4 w-4 text-[#999999]" />
              </Link>
            </Button>
            <Button variant="outline" className="h-auto justify-start py-3" onClick={downloadGivingSummary}>
              <Download className="h-4 w-4 text-[#2b4d24]" />
              <span className="ml-3 text-left text-sm font-medium">Download giving summary</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-[#8b957b]">
        <Heart className="h-3.5 w-3.5 text-[#e1a730]" /> Every gift is processed securely by Blackbaud. Favor never sees your card number.
      </p>
    </div>
  );
}
