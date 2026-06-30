"use client";

import { Suspense, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useGiving } from "@/hooks/use-giving";
import { useGrants } from "@/hooks/use-grants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Download, Repeat, Calendar, ArrowRight, TrendingUp, Target } from "lucide-react";
import Link from "next/link";
import { SectionHeader } from "@/components/portal/section-header";
import { EmptyState } from "@/components/portal/empty-state";
import { GiveNowDialog } from "@/components/portal/give-now-dialog";
import { PortalPageSkeleton } from "@/components/portal/portal-page-skeleton";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";

export default function GivingPage() {
  return (
    <Suspense fallback={<PortalPageSkeleton />}>
      <GivingPageContent />
    </Suspense>
  );
}

function GivingPageContent() {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const { gifts, recurringGifts, totalGiven, ytdGiven, isLoading } = useGiving(user?.id, refreshKey);
  const { grants, isLoading: isGrantsLoading } = useGrants(user?.id);
  const userType = user?.constituentType ?? "individual";
  const searchParams = useSearchParams();
  const viewParam = (searchParams.get("view") ?? "").toLowerCase();

  if (isLoading || isGrantsLoading) {
    return <PortalPageSkeleton />;
  }

  const mostRecentGift = gifts[0];
  const roleGivingPanel = (() => {
    switch (userType) {
      case "foundation": {
        const activeGrants = grants.filter((g) => g.status === "active");
        const totalGranted = activeGrants.reduce((sum, g) => sum + g.amount, 0);
        const nextReport = activeGrants.find((g) => g.nextReportDue)?.nextReportDue;
        return {
          title: "Grant Stewardship",
          items: [
            { label: "Active Grants", value: `${activeGrants.length}`, description: "Currently funded initiatives" },
            { label: "Total Granted", value: formatCurrency(totalGranted), description: "Active grant commitments" },
            { label: "Next Report Due", value: nextReport ? new Date(nextReport).toLocaleDateString() : "None scheduled", description: "Upcoming reporting deadline" },
          ],
          action: { label: "View grant timeline", href: "/giving?view=grants" },
        };
      }
      case "daf": {
        const dafTotal = gifts
          .filter((g) => g.designation.toLowerCase().includes("daf"))
          .reduce((sum, g) => sum + g.amount, 0);
        return {
          title: "DAF Giving",
          items: [
            { label: "DAF Giving YTD", value: formatCurrency(dafTotal), description: "Based on portal activity" },
            { label: "Recommendation Status", value: "Ready", description: "Next grant checklist prepared" },
            { label: "Support Contact", value: user?.rddAssignment ?? "Partner Care", description: "DAF coordination" },
          ],
          action: { label: "Open DAF checklist", href: "/giving?view=daf" },
        };
      }
      case "church":
        return {
          title: "Church Partner Giving",
          items: [
            { label: "Congregation Participation", value: "Growing", description: "Monthly giving is up 8%" },
            { label: "Mission Sunday", value: "In planning", description: "Resources ready to download" },
            { label: "Material Requests", value: "Ready", description: "Brochures and prayer guides available" },
          ],
          action: { label: "Open church resources", href: "/content?tag=church" },
        };
      case "ambassador":
        return {
          title: "Ambassador Giving",
          items: [
            { label: "Campaign Momentum", value: "Rising", description: "Engagement up 12% this month" },
            { label: "Next Outreach", value: "Feb 18", description: "Partner spotlight live session" },
            { label: "Assets Ready", value: "6 new", description: "Fresh stories and graphics" },
          ],
          action: { label: "View ambassador kit", href: "/content?tag=ambassador" },
        };
      case "volunteer":
        return {
          title: "Volunteer Support",
          items: [
            { label: "Active Tasks", value: "3", description: "Assignments in progress" },
            { label: "Next Training", value: "Feb 20", description: "Volunteer welcome session" },
            { label: "Resources", value: "Updated", description: "Orientation toolkit ready" },
          ],
          action: { label: "Open volunteer hub", href: "/content?tag=volunteer" },
        };
      case "major_donor":
        return {
          title: "Stewardship Focus",
          items: [
            { label: "Strategic Initiatives", value: "3 active", description: "Priority expansion projects" },
            { label: "Briefing Packet", value: "Ready", description: "Financial summary prepared" },
            { label: "RDD Contact", value: user?.rddAssignment ?? "Partner Care", description: "Schedule an update" },
          ],
          action: { label: "View stewardship packet", href: "/content?tag=stewardship" },
        };
      default:
        return {
          title: "Giving Focus",
          items: [
            { label: "Suggested Designation", value: "Where Most Needed", description: "Flexible impact support" },
            { label: "Next Gift", value: "Ready", description: "Make a new gift anytime" },
            { label: "Impact Reports", value: "Q4 2025", description: "Latest report ready" },
          ],
          action: { label: "View impact report", href: "/content?type=report" },
        };
    }
  })();
  const highlightPanel =
    (viewParam === "grants" && userType === "foundation") ||
    (viewParam === "daf" && userType === "daf");

  function downloadTaxReceipt() {
    const year = new Date().getFullYear() - 1;
    const text = [
      `FAVOR INTERNATIONAL - ${year} ANNUAL TAX RECEIPT`,
      "=".repeat(48),
      "",
      `Donor: ${user?.firstName} ${user?.lastName}`,
      `Email: ${user?.email}`,
      "",
      `Total Gifts in ${year}: ${formatCurrency(ytdGiven)}`,
      `Number of Gifts: ${gifts.filter((g) => new Date(g.date).getFullYear() === year).length}`,
      "",
      "Favor International, Inc.",
      "3433 Lithia Pinecrest Rd #356, Valrico, FL 33596",
      "EIN: XX-XXXXXXX",
      "501(c)(3) Non-Profit Organization",
      "",
      "All contributions are tax-deductible to the extent allowed by law.",
    ].join("\n");

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `favor-tax-receipt-${year}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Tax receipt downloaded");
  }

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <nav className="mb-2 flex items-center gap-1 text-xs text-[#999999]">
            <Link href="/dashboard" className="hover:text-[#666666]">Home</Link>
            <span>/</span>
            <span className="font-medium text-[#1a1a1a]">Giving</span>
          </nav>
          <h1 className="font-serif text-3xl font-semibold text-[#1a1a1a]">
            Your Giving
          </h1>
          <p className="mt-1 text-sm text-[#666666]">
            Track your gifts, manage recurring donations, and see your impact.
          </p>
        </div>
        <GiveNowDialog onGiftComplete={() => setRefreshKey((k) => k + 1)} />
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Lifetime Giving", value: formatCurrency(totalGiven), icon: Heart },
          { label: "Year to Date", value: formatCurrency(ytdGiven), icon: Calendar },
          { label: "Monthly Average", value: formatCurrency(Math.round((ytdGiven) / (new Date().getMonth() + 1))), icon: TrendingUp },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2b4d24]/5">
                <stat.icon className="h-5 w-5 text-[#2b4d24]" />
              </div>
              <div>
                <p className="text-xs text-[#999999]">{stat.label}</p>
                <p className="text-xl font-semibold text-[#1a1a1a]">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          {/* Most Recent Gift */}
          {mostRecentGift ? (
            <section>
              <SectionHeader title="Most Recent Gift" />
              <Card className="mt-4">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-semibold text-[#1a1a1a]">
                        ${mostRecentGift.amount.toLocaleString()}
                      </p>
                      <p className="text-sm text-[#666666]">
                        {mostRecentGift.designation} &middot;{" "}
                        {new Date(mostRecentGift.date).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={mostRecentGift.isRecurring ? "default" : "secondary"}>
                      {mostRecentGift.isRecurring ? "Recurring" : "One-time"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </section>
          ) : (
            <EmptyState
              icon={Heart}
              title="No gifts yet"
              description="Make your first gift to Favor International and see it here."
            />
          )}

          {/* Quick Actions */}
          <section>
            <SectionHeader title="Quick Actions" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Button variant="outline" className="justify-start h-auto py-3" asChild>
                <Link href="/giving/history" className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-[#2b4d24]" />
                  <div className="text-left">
                    <p className="text-sm font-medium">View Full History</p>
                    <p className="text-xs text-[#666666]">All gifts and receipts</p>
                  </div>
                  <ArrowRight className="ml-auto h-4 w-4 text-[#999999]" />
                </Link>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={downloadTaxReceipt}
              >
                <Download className="h-4 w-4 text-[#2b4d24]" />
                <div className="text-left ml-3">
                  <p className="text-sm font-medium">Download Tax Receipt</p>
                  <p className="text-xs text-[#666666]">{new Date().getFullYear() - 1} annual receipt</p>
                </div>
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3" asChild>
                <Link href="/giving/recurring" className="flex items-center gap-3">
                  <Repeat className="h-4 w-4 text-[#2b4d24]" />
                  <div className="text-left">
                    <p className="text-sm font-medium">Manage Recurring</p>
                    <p className="text-xs text-[#666666]">Edit or pause gifts</p>
                  </div>
                  <ArrowRight className="ml-auto h-4 w-4 text-[#999999]" />
                </Link>
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3" asChild>
                <Link href="/giving/impact" className="flex items-center gap-3">
                  <TrendingUp className="h-4 w-4 text-[#2b4d24]" />
                  <div className="text-left">
                    <p className="text-sm font-medium">View Impact</p>
                    <p className="text-xs text-[#666666]">See your impact</p>
                  </div>
                  <ArrowRight className="ml-auto h-4 w-4 text-[#999999]" />
                </Link>
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3" asChild>
                <Link href="/giving/goals" className="flex items-center gap-3">
                  <Target className="h-4 w-4 text-[#2b4d24]" />
                  <div className="text-left">
                    <p className="text-sm font-medium">Giving Goals</p>
                    <p className="text-xs text-[#666666]">Set and track targets</p>
                  </div>
                  <ArrowRight className="ml-auto h-4 w-4 text-[#999999]" />
                </Link>
              </Button>
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {roleGivingPanel && (
            <Card className={`glass-pane ${highlightPanel ? "ring-1 ring-[#2b4d24]/30" : ""}`}>
              <CardHeader className="pb-3">
                <CardTitle className="font-serif text-lg">{roleGivingPanel.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {roleGivingPanel.items.map((item) => (
                  <div key={item.label} className="rounded-lg glass-inset p-3">
                    <p className="text-xs text-[#999999]">{item.label}</p>
                    <p className="text-lg font-semibold text-[#1a1a1a]">{item.value}</p>
                    <p className="text-xs text-[#666666]">{item.description}</p>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={roleGivingPanel.action.href}>{roleGivingPanel.action.label}</Link>
                </Button>
              </CardContent>
            </Card>
          )}
          {/* Recurring Gifts */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-serif flex items-center gap-2 text-lg">
                <Repeat className="h-4 w-4 text-[#2b4d24]" />
                Recurring Gifts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recurringGifts.length > 0 ? (
                <div className="space-y-3">
                  {recurringGifts.map((gift) => (
                    <div
                      key={gift.id}
                      className="flex items-center justify-between rounded-lg glass-inset p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-[#1a1a1a]">
                          ${gift.amount.toLocaleString()}/{gift.frequency}
                        </p>
                        <p className="text-xs text-[#999999]">
                          Next: {new Date(gift.nextChargeDate).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[#2b4d24] text-[10px]">
                        {gift.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <Repeat className="mx-auto h-8 w-8 text-[#c5ccc2]" />
                  <p className="mt-2 text-sm text-[#666666]">No active recurring gifts</p>
                </div>
              )}
              <Button variant="outline" size="sm" className="w-full mt-4" asChild>
                <Link href="/giving/recurring">Manage Recurring Gifts</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Impact */}
          <Link href="/giving/impact" className="block">
            <Card className="bg-linear-to-br from-[#2b4d24] to-[#3d6633] text-white cursor-pointer hover:opacity-95 transition-opacity">
              <CardContent className="space-y-4 p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-white/60">Your Impact</p>
                <div className="text-center">
                  <p className="text-3xl font-bold">1,247</p>
                  <p className="text-sm text-white/70">Lives impacted this year</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-lg glass-hero p-3">
                    <p className="text-lg font-semibold">12</p>
                    <p className="text-[10px] text-white/60">Communities</p>
                  </div>
                  <div className="rounded-lg glass-hero p-3">
                    <p className="text-lg font-semibold">4</p>
                    <p className="text-[10px] text-white/60">Countries</p>
                  </div>
                </div>
                <div className="w-full mt-2 py-2 text-center text-sm bg-white/20 rounded-md">
                  View Full Impact →
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
